import { useEffect, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function OutcomesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [comps, setComps] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ id_indicator: "", outcome_text: "", assessment_tool: "" });
  useEffect(() => { if (rpd?.id_discipline) api.getCompetenciesByDiscipline(rpd.id_discipline).then(r => setComps(r.data)).catch(() => { }); }, []);
  const used = new Set((rpd.learning_outcomes || []).map(o => o.id_indicator));
  const add = async () => {
    if (!form.id_indicator) return;
    try { await api.addOutcome(rpdId, { id_indicator: +form.id_indicator, outcome_text: form.outcome_text, assessment_tool: form.assessment_tool }); setShowAdd(false); setForm({ id_indicator: "", outcome_text: "", assessment_tool: "" }); await reload(); } catch { }
  };
  const del = async (id) => { try { await api.deleteOutcome(id); await reload(); } catch { } };

  return <div>
    {rpd.learning_outcomes?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Компетенция", "Индикатор", "Результат", "Средство оценки", isEdit && canEdit ? "" : null].filter(x => x !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{rpd.learning_outcomes.map(o => <tr key={o.id_outcome}>
        <td style={td}>{o.competency_code}</td>
        <td style={td}>{o.indicator_code}</td>
        <td style={td}>{o.outcome_text}</td>
        <td style={td}>{o.assessment_tool}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(o.id_outcome)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
      </tr>)}</tbody>
    </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Результаты обучения не добавлены</div>}
    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить результат</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
          <select value={form.id_indicator} onChange={e => setForm(p => ({ ...p, id_indicator: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, fontFamily: F }}>
            <option value="">— Выбрать индикатор —</option>
            {comps.map(c => c.indicators?.filter(i => !used.has(i.id_indicator)).map(i => <option key={i.id_indicator} value={i.id_indicator}>{c.code} / {i.code} — {i.description}</option>))}
          </select>
          <textarea placeholder="Планируемый результат обучения (знать/уметь/владеть)" value={form.outcome_text} onChange={e => setForm(p => ({ ...p, outcome_text: e.target.value }))} style={{ width: "100%", minHeight: 60, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, marginBottom: 8, resize: "vertical", boxSizing: "border-box" }} />
          <input placeholder="Средство оценки (Экзамен / Защита лабораторной работы / …)" value={form.assessment_tool} onChange={e => setForm(p => ({ ...p, assessment_tool: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
        </div>}
    </div>}
  </div>;
}
