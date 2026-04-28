import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function TopicsEditor({ kind }) {
  // kind: "lab" | "practice"
  const { rpd, isEdit, canEdit, reload } = useRpdEditor();
  const [addingFor, setAddingFor] = useState(null);
  const [form, setForm] = useState({ title: "" });
  const add = async (sectionId) => {
    if (!form.title.trim()) return;
    try { await api.addTopic(sectionId, { topic_type: kind, title: form.title }); setAddingFor(null); setForm({ title: "" }); await reload(); } catch { }
  };
  const del = async (id) => { try { await api.deleteTopic(id); await reload(); } catch { } };

  if (!rpd.sections?.length) return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Сначала добавьте разделы дисциплины (раздел 4)</div>;

  return <div>{rpd.sections.map(s => {
    const topics = (s.topics || []).filter(t => t.topic_type === kind);
    return <div key={s.id_section} style={{ marginBottom: 16, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Раздел {s.section_number}. {s.title}</div>
      {topics.length > 0 ? topics.map((t, i) => <div key={t.id_topic} style={{ display: "flex", alignItems: "center", padding: "6px 12px", marginLeft: 16, borderLeft: "2px solid " + T.accent, marginBottom: 4, fontSize: 12 }}>
        <span style={{ width: 24, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{i + 1}.</span>
        <span style={{ flex: 1 }}>{t.title}</span>
        {isEdit && canEdit && <button onClick={() => del(t.id_topic)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}
      </div>) : <div style={{ fontSize: 11, color: T.textMuted, marginLeft: 16, marginBottom: 8 }}>Тем нет</div>}
      {isEdit && canEdit && (addingFor === s.id_section
        ? <div style={{ marginTop: 8, marginLeft: 16, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder={kind === "lab" ? "Название лабораторной работы" : "Название практического занятия"} value={form.title} onChange={e => setForm({ title: e.target.value })} style={{ flex: 1, minWidth: 200, padding: "5px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12 }} />
            <Btn small primary onClick={() => add(s.id_section)}>OK</Btn>
            <Btn small onClick={() => { setAddingFor(null); setForm({ title: "" }); }}>✕</Btn>
          </div>
        : <Btn small onClick={() => { setAddingFor(s.id_section); setForm({ title: "" }); }} style={{ marginLeft: 16 }}><PlusIcon /> Добавить тему</Btn>)}
    </div>;
  })}</div>;
}
