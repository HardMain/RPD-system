import { useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { PlanSummary } from "./PlanSummary.jsx";

export function SectionEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const initialForm = () => ({ section_number: (rpd.sections?.length || 0) + 1, title: "", brief_content: "", lecture_hours: 0, practice_hours: 0, lab_hours: 0, self_study_hours: 0 });
  const [form, setForm] = useState(initialForm);
  const addSec = async () => {
    try { await api.addSection(rpdId, form); setShowAdd(false); setForm({ ...initialForm(), section_number: (rpd.sections?.length || 0) + 2 }); await reload(); } catch { }
  };
  const delSec = async (id) => { if (confirm("Удалить раздел?")) { await api.deleteSection(id); await reload(); } };

  return <div>
    <PlanSummary bupDisciplines={rpd.bup_disciplines} sections={rpd.sections} />
    {rpd.sections?.length > 0 ? <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["#", "Раздел", "Лек", "Пр", "Лаб", "СРС", "Содержание", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{rpd.sections.map(s => <tr key={s.id_section}>
        <td style={{ ...td, textAlign: "center" }}>{s.section_number}</td>
        <td style={{ ...td, fontWeight: 600 }}>{s.title}</td>
        <td style={{ ...td, textAlign: "center" }}>{s.lecture_hours}</td>
        <td style={{ ...td, textAlign: "center" }}>{s.practice_hours}</td>
        <td style={{ ...td, textAlign: "center" }}>{s.lab_hours}</td>
        <td style={{ ...td, textAlign: "center" }}>{s.self_study_hours}</td>
        <td style={{ ...td, fontSize: 11 }}>{s.brief_content || ""}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => delSec(s.id_section)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
      </tr>)}</tbody>
    </table></div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Разделы не добавлены</div>}
    {isEdit && canEdit && <div style={{ marginTop: 12 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить раздел</Btn>
        : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input placeholder="Название" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F }} />
            {["lecture_hours", "practice_hours", "lab_hours", "self_study_hours"].map(k => <input key={k} type="number" placeholder={k.split("_")[0]} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: +e.target.value }))} style={{ width: 50, padding: "6px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, textAlign: "center" }} />)}
          </div>
          <input placeholder="Краткое содержание" value={form.brief_content} onChange={e => setForm(p => ({ ...p, brief_content: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={addSec}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
        </div>}
    </div>}
  </div>;
}
