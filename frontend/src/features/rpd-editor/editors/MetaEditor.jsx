import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { Modal } from "../../../components/Modal.jsx";
import { Badge } from "../../../components/Badge.jsx";
import { TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

/**
 * Раздел «Метаинформация» — данные РПД, не входящие в печатную форму
 * (комментарий, разработчики и т.п.). Аналог вкладки «Основные данные» в АРМ.
 */
export function MetaEditor() {
  const { rpd, rpdId, isEdit, canEdit, editTexts, setEditTexts, reload } = useRpdEditor();

  // Сумма ЗЕТ из всех привязанных БУП-дисциплин (как «Общая трудоёмкость» в АРМ).
  const totalZet = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.zet || 0), 0);
  const totalHours = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.total_hours || 0), 0);

  // Имя РПД формируется автоматически: <год> <дисциплина> (<всего часов>)
  const rpdName = `${rpd.academic_year} ${rpd.discipline_name}`
    + (totalHours ? ` (${totalHours} ч)` : "");

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Field label="Дисциплина">
      <ReadOnlyValue>{rpd.discipline_name}</ReadOnlyValue>
    </Field>

    <Field label="Наименование РПД">
      <ReadOnlyValue>{rpdName}</ReadOnlyValue>
    </Field>

    <Field label="Общая трудоёмкость">
      <ReadOnlyValue>
        {totalZet > 0 ? `${totalZet} ЗЕ` : "—"}
        {totalHours > 0 && <span style={{ color: T.textMuted, marginLeft: 8 }}>· {totalHours} ч</span>}
      </ReadOnlyValue>
    </Field>

    <Field label="Комментарий к РПД">
      {isEdit && canEdit ? (
        <textarea
          value={editTexts.comment || ""}
          onChange={e => setEditTexts(p => ({ ...p, comment: e.target.value }))}
          placeholder="Произвольная заметка для разработчика. В печатную форму не попадает."
          style={{ width: "100%", minHeight: 80, padding: "8px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, resize: "vertical", boxSizing: "border-box" }}
        />
      ) : (
        <ReadOnlyValue placeholder="—">{rpd.comment}</ReadOnlyValue>
      )}
    </Field>

    <BupDisciplineLinks rpdId={rpdId} canEdit={isEdit && canEdit} reload={reload} bupDisciplines={rpd.bup_disciplines || []} />

    <DeveloperEditor rpdId={rpdId} developers={rpd.developers || []} canEdit={isEdit && canEdit} reload={reload} />

    <Field label="Статус">
      <Badge status={rpd.status} />
    </Field>

    <Field label="Автор РПД">
      <ReadOnlyValue>{rpd.author_name || "—"}</ReadOnlyValue>
    </Field>
  </div>;
}


// ─── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return <div>
    <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>{label}</div>
    {children}
  </div>;
}

function ReadOnlyValue({ children, placeholder }) {
  const empty = children === null || children === undefined || children === "" || (typeof children === "string" && !children.trim());
  return <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 13, color: empty ? T.textMuted : T.text, fontStyle: empty ? "italic" : "normal" }}>
    {empty ? (placeholder || "—") : children}
  </div>;
}


// ─── Bup-Discipline links ──────────────────────────────────────────────────

function BupDisciplineLinks({ rpdId, canEdit, reload, bupDisciplines }) {
  const [showAttach, setShowAttach] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function detach(bd) {
    if (!confirm(`Открепить «${bd.code || bd.bup_name}» от РПД?\n\nВведённые планируемые результаты по индикаторам этой дисциплины БУПа в РПД останутся — удалите их вручную, если нужно.`)) return;
    setBusyId(bd.id_bup_discipline);
    try { await api.detachBupDiscipline(rpdId, bd.id_bup_discipline); await reload(); }
    catch (e) { alert(e?.response?.data?.detail || e.message); }
    setBusyId(null);
  }

  return <Field label="Привязанные дисциплины БУПа">
    {bupDisciplines.length === 0
      ? <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>Не привязана</div>
      : <div style={{ border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden" }}>
        {bupDisciplines.map(b => (
          <div key={b.id_bup_discipline} style={{ padding: "8px 12px", fontSize: 13, borderBottom: "1px solid " + T.borderLight, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontWeight: 700, minWidth: 80 }}>{b.code || "—"}</span>
            <div style={{ flex: 1 }}>
              <div>{b.bup_name}</div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
                сем. {b.semester || "—"} · {b.control_form || "—"} · {b.total_hours ?? "—"} ч · {b.zet ?? "—"} ЗЕ
              </div>
            </div>
            {canEdit && (
              <button onClick={() => detach(b)} disabled={busyId === b.id_bup_discipline}
                title="Открепить дисциплину БУПа от РПД"
                style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
      </div>
    }
    {canEdit && <div style={{ marginTop: 6 }}>
      <Btn small onClick={() => setShowAttach(true)}>+ Добавить дисциплину БУПа</Btn>
    </div>}
    {showAttach && <AttachBupDisciplineModal
      rpdId={rpdId}
      excludeIds={new Set(bupDisciplines.map(b => b.id_bup_discipline))}
      onClose={() => setShowAttach(false)}
      onAttached={async () => { setShowAttach(false); await reload(); }}
    />}
  </Field>;
}


function AttachBupDisciplineModal({ rpdId, excludeIds, onClose, onAttached }) {
  const [bups, setBups] = useState([]);
  const [bupId, setBupId] = useState("");
  const [bupDetail, setBupDetail] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getBups().then(r => setBups(r.data)).catch(() => setBups([]));
  }, []);

  useEffect(() => {
    if (!bupId) { setBupDetail(null); return; }
    api.getBup(bupId).then(r => setBupDetail(r.data)).catch(() => setBupDetail(null));
    setPicked(new Set());
  }, [bupId]);

  const disciplines = useMemo(() => (bupDetail?.disciplines || [])
    .filter(d => !excludeIds.has(d.id_bup_discipline)), [bupDetail, excludeIds]);

  function toggle(id) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function commit() {
    if (picked.size === 0) return;
    setBusy(true);
    try {
      for (const bd of picked) {
        await api.attachBupDiscipline(rpdId, bd);
      }
      await onAttached();
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    }
    setBusy(false);
  }

  return <Modal width={620} onClose={onClose}>
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Прикрепить дисциплину БУПа к РПД</div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>БУП</label>
        <select value={bupId} onChange={e => setBupId(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F }}>
          <option value="">— Выбрать БУП —</option>
          {bups.map(b => <option key={b.id_bup} value={b.id_bup}>
            {b.year ? b.year + " " : ""}{b.name} ({b.direction_code} {b.direction_name})
          </option>)}
        </select>
      </div>

      {bupDetail && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>
            Дисциплины БУПа (уже привязанные не показаны)
          </label>
          <div style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 320, overflow: "auto", background: T.surface }}>
            {disciplines.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
                Все дисциплины этого БУПа уже привязаны к РПД, либо БУП пуст.
              </div>
            )}
            {disciplines.map(d => {
              const checked = picked.has(d.id_bup_discipline);
              return <label key={d.id_bup_discipline}
                style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + T.borderLight, cursor: "pointer", background: checked ? T.accentLight : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(d.id_bup_discipline)} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div><b>{d.code}</b> · {d.discipline_name}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
                    Сем. {d.semester || "—"} · {d.control_form || "—"} · {d.total_hours ?? "—"} ч
                  </div>
                </div>
              </label>;
            })}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Выбрано: {picked.size}</div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onClose}>Отмена</Btn>
        <Btn primary onClick={commit} disabled={picked.size === 0 || busy}>
          {busy ? "Прикрепляю…" : "Прикрепить"}
        </Btn>
      </div>
    </div>
  </Modal>;
}


// ─── Developer picker ──────────────────────────────────────────────────────

function DeveloperEditor({ rpdId, developers, canEdit, reload }) {
  const [showPicker, setShowPicker] = useState(false);
  const max = 2;

  async function handleDelete(id) {
    if (!confirm("Убрать разработчика?")) return;
    try { await api.removeDeveloper(id); await reload(); } catch {}
  }

  return <Field label="Разработчики РПД">
    <div style={{ border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden" }}>
      {developers.length === 0 && <div style={{ padding: "8px 12px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>Не указаны</div>}
      {developers.map((d, i) => (
        <div key={d.id_rpd_developer} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: i < developers.length - 1 ? "1px solid " + T.borderLight : "none", fontSize: 13 }}>
          <span style={{ width: 110, color: T.textMuted, fontSize: 12 }}>Разработчик {i + 1}</span>
          <span style={{ flex: 1 }}>{d.full_name}</span>
          {canEdit && <button onClick={() => handleDelete(d.id_rpd_developer)} title="Убрать" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><TrashIcon /></button>}
        </div>
      ))}
      {canEdit && developers.length < max && (
        showPicker
          ? <DeveloperPicker
              excludeIds={developers.map(d => d.id_user)}
              onPick={async (uid) => {
                try { await api.addDeveloper(rpdId, uid); setShowPicker(false); await reload(); } catch {}
              }}
              onCancel={() => setShowPicker(false)}
            />
          : <div style={{ padding: 8, borderTop: developers.length > 0 ? "1px solid " + T.borderLight : "none" }}>
              <Btn small onClick={() => setShowPicker(true)}>+ Добавить разработчика</Btn>
            </div>
      )}
    </div>
  </Field>;
}

function DeveloperPicker({ excludeIds, onPick, onCancel }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef(null);

  function search(v) {
    setQ(v); setLoading(true);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const r = await api.searchUsers(v);
        setItems((r.data || []).filter(u => !excludeIds.includes(u.id_user)));
      } catch { setItems([]); }
      setLoading(false);
    }, 200);
  }

  useEffect(() => { search(""); /* eslint-disable-line */ }, []);

  return <div style={{ padding: 10, borderTop: "1px solid " + T.borderLight, background: T.bg }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      <input
        autoFocus
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="Поиск по ФИО…"
        style={{ flex: 1, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F }}
      />
      <Btn small onClick={onCancel}>Отмена</Btn>
    </div>
    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.surface }}>
      {loading && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Поиск…</div>}
      {!loading && items.length === 0 && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Никого не нашлось</div>}
      {!loading && items.map(u => (
        <button key={u.id_user} onClick={() => onPick(u.id_user)}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{u.role}{u.department ? " · " + u.department : ""}</div>
        </button>
      ))}
    </div>
  </div>;
}
