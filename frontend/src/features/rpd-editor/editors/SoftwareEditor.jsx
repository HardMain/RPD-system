import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function SoftwareEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", license_type: "", purpose: "" });
  const add = async () => { try { await api.addSoftware(rpdId, form); setShowAdd(false); setForm({ name: "", license_type: "", purpose: "" }); await reload(); } catch { } };
  const del = async (id) => { await api.deleteSoftware(id); await reload(); };

  return <div>
    {rpd.software?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["ПО", "Лицензия", "Назначение", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{rpd.software.map(s => <tr key={s.id_software}>
        <td style={td}>{s.name}</td>
        <td style={td}>{s.license_type}</td>
        <td style={td}>{s.purpose}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(s.id_software)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
      </tr>)}</tbody>
    </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>ПО не добавлено</div>}
    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <input placeholder="Название ПО" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 150, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
          <input placeholder="Лицензия" value={form.license_type} onChange={e => setForm(p => ({ ...p, license_type: e.target.value }))} style={{ width: 120, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
          <input placeholder="Назначение" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} style={{ width: 150, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
          <Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>✕</Btn>
        </div>}
    </div>}
  </div>;
}
