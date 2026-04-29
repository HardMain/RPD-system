import { useEffect, useRef, useState } from "react";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { Btn } from "../../components/Btn.jsx";
import { Modal } from "../../components/Modal.jsx";
import { Badge } from "../../components/Badge.jsx";
import { TrashIcon } from "../../components/icons.jsx";

/**
 * Модальное окно «Свойства РПД» — собирает в одно место всё, что не относится
 * к содержимому печатной формы РПД: основная информация, привязанные дисциплины
 * БУПа (с файлом ФГОС), комментарий разработчика и список разработчиков.
 *
 * Дисциплины БУПа задаются ТОЛЬКО при создании РПД (как в АРМ ПНИПУ — там макет
 * РПД создаётся начальником ОУП, и поле «Дисциплина» автоматически заполняется
 * и недоступно для редактирования). Поэтому здесь они отображаются read-only.
 */
export function RpdMetaModal({ rpd, rpdId, isEdit, canEdit, editTexts, setEditTexts, reload, onClose }) {
  const totalZet = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.zet || 0), 0);
  const totalHours = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.total_hours || 0), 0);
  const rpdName = `${rpd.academic_year} ${rpd.discipline_name}` + (totalHours ? ` (${totalHours} ч)` : "");
  const editAllowed = isEdit && canEdit;

  return <Modal width={760} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Свойства РПД</div>
      <div style={{ flex: 1 }} />
      <Badge status={rpd.status} />
    </div>

    <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
      <Section title="Основные">
        <FieldGrid>
          <Field label="Дисциплина"><Ro>{rpd.discipline_name}</Ro></Field>
          <Field label="Учебный год"><Ro>{rpd.academic_year}</Ro></Field>
          <Field label="Наименование РПД" colSpan={2}><Ro>{rpdName}</Ro></Field>
          <Field label="Общая трудоёмкость">
            <Ro>
              {totalZet > 0 ? `${totalZet} ЗЕ` : "—"}
              {totalHours > 0 && <span style={{ color: T.textMuted, marginLeft: 8 }}>· {totalHours} ч</span>}
            </Ro>
          </Field>
          <Field label="Автор РПД"><Ro>{rpd.author_name || "—"}</Ro></Field>
        </FieldGrid>
      </Section>

      <Section title="Привязанные дисциплины БУПа">
        <BupDisciplinesTable bupDisciplines={rpd.bup_disciplines || []} disciplineName={rpd.discipline_name} />
        <Hint>
          Дисциплины БУПа задаются при создании РПД и после создания не редактируются. Если состав некорректный — создайте РПД заново.
        </Hint>
      </Section>

      <Section title="Комментарий к РПД">
        {editAllowed ? (
          <textarea
            value={editTexts.comment || ""}
            onChange={e => setEditTexts(p => ({ ...p, comment: e.target.value }))}
            placeholder="Произвольная заметка для разработчика. В печатную форму не попадает."
            style={{ width: "100%", minHeight: 80, padding: "8px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, resize: "vertical", boxSizing: "border-box", outline: "none" }}
          />
        ) : <Ro placeholder="—">{rpd.comment}</Ro>}
        {editAllowed && <Hint>Сохраняется по кнопке «Сохранить» в редакторе.</Hint>}
      </Section>

      <Section title="Разработчики">
        <DeveloperEditor rpdId={rpdId} developers={rpd.developers || []} canEdit={editAllowed} reload={reload} />
      </Section>
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid " + T.borderLight, position: "sticky", bottom: 0, background: T.surface }}>
      <Btn onClick={onClose}>Закрыть</Btn>
    </div>
  </Modal>;
}


// ─── Layout helpers ────────────────────────────────────────────────────────

function Section({ title, children }) {
  return <div>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>{title}</div>
    {children}
  </div>;
}

function FieldGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>{children}</div>;
}

function Field({ label, children, colSpan }) {
  return <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}

function Ro({ children, placeholder }) {
  const empty = children === null || children === undefined || children === "" || (typeof children === "string" && !children.trim());
  return <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 13, color: empty ? T.textMuted : T.text, fontStyle: empty ? "italic" : "normal", minHeight: 18 }}>
    {empty ? (placeholder || "—") : children}
  </div>;
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>{children}</div>;
}


// ─── BUP disciplines table (read-only) ─────────────────────────────────────

function BupDisciplinesTable({ bupDisciplines, disciplineName }) {
  if (bupDisciplines.length === 0) {
    return <div style={{ padding: "10px 14px", background: T.bg, borderRadius: 4, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
      Дисциплины БУПа не привязаны.
    </div>;
  }
  return <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={head}>План</th>
          <th style={head}>Индекс</th>
          <th style={head}>Дисциплина БУПа</th>
          <th style={head}>Направление</th>
          <th style={head}>Профиль</th>
          <th style={head}>Сем. / часы / ЗЕ</th>
          <th style={head}>ФГОС</th>
        </tr>
      </thead>
      <tbody>
        {bupDisciplines.map(b => (
          <tr key={b.id_bup_discipline}>
            <td style={cell}>{b.bup_name}</td>
            <td style={cell}><b>{b.code || "—"}</b></td>
            <td style={cell}>{disciplineName}</td>
            <td style={cell}>{b.direction_code ? `${b.direction_code} ${b.direction_name || ""}` : (b.direction_name || "—")}</td>
            <td style={cell}>{b.direction_profile || "—"}</td>
            <td style={cell}>
              {b.semester || "—"} · {b.total_hours ?? "—"} ч · {b.zet ?? "—"} ЗЕ
            </td>
            <td style={cell}>
              {b.fgos_file_id
                ? <a href={api.fileUrl(b.fgos_file_id)} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600 }}>
                    📄 {b.fgos_file_name || "Просмотр"}
                  </a>
                : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не прикреплён</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

const head = { padding: "8px 10px", borderBottom: "1px solid " + T.border, background: T.bg, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", textAlign: "left", wordBreak: "normal", overflowWrap: "break-word" };
const cell = { padding: "8px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 12, verticalAlign: "top", wordBreak: "normal", overflowWrap: "break-word" };


// ─── Developer editor ──────────────────────────────────────────────────────

function DeveloperEditor({ rpdId, developers, canEdit, reload }) {
  const [showPicker, setShowPicker] = useState(false);
  const max = 2;

  async function handleDelete(id) {
    if (!confirm("Убрать разработчика?")) return;
    try { await api.removeDeveloper(id); await reload(); } catch {}
  }

  return <div style={{ border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden" }}>
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
  </div>;
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
