import { useEffect, useMemo, useState } from "react";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";
import { Input } from "../../components/Input.jsx";

/**
 * Создание РПД (макета).
 *
 * Поток как в АРМ ПНИПУ:
 *   1) выбираем логическую дисциплину (например «Базы данных» в направлении
 *      09.03.04 «Программная инженерия»);
 *   2) показываем все БУП-инстансы этой дисциплины (одна и та же дисциплина
 *      обычно встречается в нескольких БУПах одного направления — разные годы,
 *      профили, факультеты), выбираем те, на которые этот макет распространяется.
 *
 * Бэк гарантирует, что все выбранные БУП-инстансы относятся к одной логической
 * дисциплине (см. валидацию в create_rpd). Создатель — зав. кафедрой / УМУ /
 * админ (ограничено на уровне UI в RpdListPage).
 */
export function CreateRpdModal({ onClose, onCreated }) {
  const [disciplines, setDisciplines] = useState([]);
  const [discFilter, setDiscFilter] = useState("");
  const [discId, setDiscId] = useState(null);

  const [bupDisciplines, setBupDisciplines] = useState([]);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdIds, setBdIds] = useState(new Set());

  const [archiveRpds, setArchiveRpds] = useState([]);
  const [year, setYear] = useState("2025/2026");
  const [baseId, setBaseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getDisciplines().then(r => setDisciplines(r.data || [])).catch(() => setDisciplines([]));
    api.getRpds({ status: "Согласовано" }).then(r => setArchiveRpds(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!discId) { setBupDisciplines([]); setBdIds(new Set()); return; }
    setBdLoading(true);
    setBdIds(new Set());
    api.getBupDisciplinesByDiscipline(discId)
      .then(r => setBupDisciplines(r.data || []))
      .catch(() => setBupDisciplines([]))
      .finally(() => setBdLoading(false));
  }, [discId]);

  const filteredDisciplines = useMemo(() => {
    if (!discFilter.trim()) return disciplines;
    const q = discFilter.toLowerCase();
    return disciplines.filter(d => (d.name || "").toLowerCase().includes(q));
  }, [disciplines, discFilter]);

  function toggleBd(id) {
    setBdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllBd() {
    setBdIds(prev => prev.size === bupDisciplines.length ? new Set() : new Set(bupDisciplines.map(b => b.id_bup_discipline)));
  }

  // Multi-БУП имеет смысл только для БУПов с одинаковой нагрузкой (часы / семестр /
  // форма контроля) — это разные редакции одной и той же дисциплины. Если различаются —
  // должны быть отдельные РПД. Подсчитываем расхождение клиентом, чтобы дать мгновенную
  // обратную связь и заблокировать «Создать»; та же проверка дублируется на бэке.
  const PARAM_LABELS = {
    total_hours: "общие часы",
    lecture_hours: "часы лекций",
    practice_hours: "часы практик",
    lab_hours: "часы лабораторных",
    ksr_hours: "часы КСР",
    self_study_hours: "часы СРС",
    zet: "ЗЕ",
    semester: "семестр",
    control_form: "форма контроля",
  };
  const selectedBds = useMemo(
    () => bupDisciplines.filter(b => bdIds.has(b.id_bup_discipline)),
    [bupDisciplines, bdIds]
  );
  const mismatch = useMemo(() => {
    if (selectedBds.length < 2) return null;
    const ref = selectedBds[0];
    for (const bd of selectedBds.slice(1)) {
      for (const [key, label] of Object.entries(PARAM_LABELS)) {
        if (bd[key] !== ref[key]) {
          return { label, a: ref[key], b: bd[key] };
        }
      }
    }
    return null;
  }, [selectedBds]);

  const canSubmit = !!discId && bdIds.size > 0 && !mismatch;

  async function go() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await api.createRpd({
        bup_discipline_ids: Array.from(bdIds),
        academic_year: year,
        based_on_rpd_id: baseId ? +baseId : null,
      });
      onCreated(r.data);
    } catch (e) {
      alert("Не удалось создать РПД: " + (e?.response?.data?.detail || e.message));
    }
    setSubmitting(false);
  }

  const labelStyle = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };
  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, boxSizing: "border-box" };

  return <Modal onClose={onClose} width={680}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.borderLight }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Создание РПД</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
        Сначала выбирается дисциплина, затем — БУПы, в которых она читается. Один макет покрывает все выбранные БУП-инстансы.
      </div>
    </div>

    <div style={{ padding: 20 }}>
      <Input label="Учебный год" value={year} onChange={e => setYear(e.target.value)} />

      {/* ── Шаг 1: дисциплина ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Дисциплина</label>
        <input
          value={discFilter}
          onChange={e => setDiscFilter(e.target.value)}
          placeholder="Поиск по названию или направлению…"
          style={{ ...inputStyle, marginBottom: 6 }}
        />
        <div style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 200, overflow: "auto", background: T.surface }}>
          {filteredDisciplines.length === 0 && (
            <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
              {disciplines.length === 0 ? "Дисциплин пока нет — попросите администратора загрузить XLS-файл БУПа." : "Ничего не нашлось."}
            </div>
          )}
          {filteredDisciplines.map(d => {
            const picked = d.id_discipline === discId;
            return <button
              key={d.id_discipline}
              type="button"
              onClick={() => setDiscId(d.id_discipline)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 12px", border: "none", borderBottom: "1px solid " + T.borderLight,
                background: picked ? T.accentLight : "transparent",
                cursor: "pointer", fontFamily: F, fontSize: 13,
                color: picked ? T.accent : T.text, fontWeight: picked ? 600 : 400,
              }}
            >
              {d.name}
            </button>;
          })}
        </div>
      </div>

      {/* ── Шаг 2: БУП-инстансы дисциплины ───────────────────────────── */}
      {discId && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>БУП-дисциплины (выберите одну или несколько)</label>
            <div style={{ flex: 1 }} />
            {bupDisciplines.length > 0 && (
              <button type="button" onClick={toggleAllBd}
                style={{ border: "none", background: "none", color: T.accent, cursor: "pointer", fontSize: 12, fontFamily: F, padding: 0 }}>
                {bdIds.size === bupDisciplines.length ? "Снять все" : "Выбрать все"}
              </button>
            )}
          </div>
          <div style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 240, overflow: "auto", background: T.surface }}>
            {bdLoading && <div style={{ padding: 14, fontSize: 13, color: T.textMuted }}>Загружаю…</div>}
            {!bdLoading && bupDisciplines.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
                Эта дисциплина не встречается ни в одном БУПе. Попросите администратора загрузить соответствующий БУП.
              </div>
            )}
            {!bdLoading && bupDisciplines.map(bd => {
              const checked = bdIds.has(bd.id_bup_discipline);
              const bupTitle = `${bd.bup_year ? bd.bup_year + " " : ""}${bd.bup_name || "БУП"}`;
              return <label key={bd.id_bup_discipline}
                style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + T.borderLight, cursor: "pointer", background: checked ? T.accentLight : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleBd(bd.id_bup_discipline)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div><b>{bupTitle}</b>{bd.code ? ` · ${bd.code}` : ""}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
                    {bd.direction_code ? `${bd.direction_code} ${bd.direction_name || ""}` : ""}
                    {bd.bup_profile ? ` · ${bd.bup_profile}` : ""}
                    {bd.semester ? ` · сем. ${bd.semester}` : ""}
                    {bd.control_form ? ` · ${bd.control_form}` : ""}
                    {bd.total_hours != null ? ` · ${bd.total_hours} ч` : ""}
                    {bd.zet != null ? ` · ${bd.zet} ЗЕ` : ""}
                  </div>
                </div>
              </label>;
            })}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Выбрано: {bdIds.size}</div>
          {mismatch && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "#fde8e8", border: "1px solid " + T.red, borderRadius: 4, fontSize: 12, color: T.red, lineHeight: 1.4 }}>
              У выбранных БУПов различается «{mismatch.label}» ({mismatch.a ?? "—"} ≠ {mismatch.b ?? "—"}). Один макет РПД покрывает только БУПы с одинаковой нагрузкой — для разной нагрузки создайте отдельные РПД (можно скопировать содержимое через «На основе архивной» ниже).
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>На основе архивной РПД (необязательно)</label>
        <select value={baseId} onChange={e => setBaseId(e.target.value)} style={inputStyle}>
          <option value="">— Не копировать —</option>
          {archiveRpds.map(r => <option key={r.id_rpd} value={r.id_rpd}>{r.discipline_name} ({r.academic_year})</option>)}
        </select>
      </div>
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid " + T.borderLight }}>
      <Btn primary onClick={go} disabled={submitting || !canSubmit}>{submitting ? "Создание…" : "Создать"}</Btn>
      <Btn onClick={onClose}>Закрыть</Btn>
    </div>
  </Modal>;
}
