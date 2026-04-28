import { useEffect, useState, useRef, useCallback } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function OutcomesEditor() {
  const { rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [rows, setRows] = useState([]);
  const [tools, setTools] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reloadRows = useCallback(async () => {
    try {
      const r = await api.getOutcomesTable(rpdId);
      setRows(r.data);
      setLoaded(true);
    } catch { setLoaded(true); }
  }, [rpdId]);

  useEffect(() => {
    reloadRows();
    api.getAssessmentTools().then(r => setTools(r.data)).catch(() => setTools([]));
  }, [reloadRows]);

  // Сохранение по blur — отправляем upsert и обновляем локальную строку.
  async function saveRow(idx, patch) {
    const row = rows[idx];
    const next = { ...row, ...patch };
    setRows(prev => prev.map((r, i) => i === idx ? next : r));
    try {
      const r = await api.upsertOutcome(rpdId, {
        id_indicator: row.id_indicator,
        outcome_text: next.outcome_text || "",
        assessment_tool: next.assessment_tool || "",
      });
      // backend вернёт id_outcome=0 если запись была удалена
      const id_outcome = r.data.id_outcome || null;
      setRows(prev => prev.map((rr, i) => i === idx ? { ...rr, id_outcome } : rr));
      // Сообщаем родителю что РПД изменилась — чтобы PDF мог перерисоваться
      reload?.();
    } catch (e) {
      // Откат при ошибке
      setRows(prev => prev.map((r, i) => i === idx ? row : r));
      alert("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
  }

  if (!loaded) return null;

  if (rows.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      Для этой РПД не закреплено ни одной компетенции с индикаторами. Это значит, что РПД не привязана к дисциплине БУПа, либо у компетенций ещё не заполнены индикаторы.
    </div>;
  }

  // Без tableLayout:fixed — браузер сам распределяет ширину как в остальных таблицах
  // редактора (раздел 3 и т.д.). Колонки сужаются ровно до самого длинного слова в столбце,
  // не уже — то есть «Компетенция» / «Индикатор» не разваливаются на «Компетен / ция».
  // colgroup с процентами — это подсказки для auto-layout, относительные веса при широком
  // контейнере; min-content поведение (= ширина самого длинного слова) браузер обеспечит сам.
  const wrap = { wordBreak: "normal", overflowWrap: "break-word" };
  return <div>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col style={{ width: "12%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "26%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "22%" }} />
      </colgroup>
      <thead><tr>
        <th style={{ ...th, ...wrap }}>Компетенция</th>
        <th style={{ ...th, ...wrap }}>Индикатор</th>
        <th style={{ ...th, ...wrap }}>Описание индикатора</th>
        <th style={{ ...th, ...wrap }}>Планируемый результат обучения</th>
        <th style={{ ...th, ...wrap }}>Средство оценки</th>
      </tr></thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.id_indicator}>
            <td style={{ ...td, ...wrap }}><b>{r.competency_code}</b></td>
            <td style={{ ...td, ...wrap }}>{r.indicator_code}</td>
            <td style={{ ...td, ...wrap }}>{r.indicator_description}</td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <OutcomeTextarea
                value={r.outcome_text || ""}
                disabled={!isEdit || !canEdit}
                onSave={v => saveRow(idx, { outcome_text: v })}
              />
            </td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <AssessmentToolPicker
                value={r.assessment_tool || ""}
                tools={tools}
                disabled={!isEdit || !canEdit}
                onSave={v => saveRow(idx, { assessment_tool: v })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}


function OutcomeTextarea({ value, disabled, onSave }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  if (disabled) {
    return <div style={{ padding: "6px 8px", whiteSpace: "pre-wrap", fontSize: 13, color: value ? T.text : T.textMuted, fontStyle: value ? "normal" : "italic" }}>{value || "—"}</div>;
  }
  return <textarea
    value={local}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => { if (local !== value) onSave(local); }}
    placeholder="Знать… / Уметь… / Владеть…"
    style={{ width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, resize: "vertical", boxSizing: "border-box", background: T.surface, outline: "none" }}
  />;
}


function AssessmentToolPicker({ value, tools, disabled, onSave }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef(null);
  useEffect(() => { setLocal(value); }, [value]);
  if (disabled) {
    return <div style={{ padding: "6px 8px", fontSize: 13, color: value ? T.text : T.textMuted, fontStyle: value ? "normal" : "italic" }}>{value || "—"}</div>;
  }
  const filtered = local
    ? tools.filter(t => t.name.toLowerCase().includes(local.toLowerCase()))
    : tools;
  function commit(v) {
    setLocal(v);
    setOpen(false);
    if (v !== value) onSave(v);
  }
  return <div style={{ position: "relative" }}>
    <input
      ref={inputRef}
      value={local}
      onChange={e => { setLocal(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => { setTimeout(() => setOpen(false), 150); if (local !== value) onSave(local); }}
      placeholder="—"
      style={{ width: "100%", padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, boxSizing: "border-box", background: T.surface, outline: "none" }}
    />
    {open && filtered.length > 0 && (
      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: "1px solid " + T.border, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 50, maxHeight: 220, overflowY: "auto" }}>
        {filtered.map(t => (
          <div key={t.id_assessment_tool}
            onMouseDown={() => commit(t.name)}
            style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13 }}
            onMouseEnter={e => e.currentTarget.style.background = T.bg}
            onMouseLeave={e => e.currentTarget.style.background = ""}>
            {t.name}
          </div>
        ))}
      </div>
    )}
  </div>;
}
