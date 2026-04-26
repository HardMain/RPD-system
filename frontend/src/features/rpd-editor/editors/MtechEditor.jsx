import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function MtechEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ room_type: "", equipment: "", quantity: "" });
  const add = async () => {
    try { await api.addMaterialTech(rpdId, { ...form, quantity: form.quantity ? +form.quantity : null }); setShowAdd(false); setForm({ room_type: "", equipment: "", quantity: "" }); await reload(); } catch { }
  };
  const del = async (id) => { await api.deleteMaterialTech(id); await reload(); };

  return <div>
    {rpd.material_tech?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Тип помещения", "Оборудование", "Кол-во", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{rpd.material_tech.map(m => <tr key={m.id_material_tech}>
        <td style={td}>{m.room_type}</td>
        <td style={td}>{m.equipment}</td>
        <td style={{ ...td, textAlign: "center" }}>{m.quantity ?? "—"}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(m.id_material_tech)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
      </tr>)}</tbody>
    </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>МТО не добавлено</div>}
    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <input placeholder="Тип помещения" value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))} style={{ width: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
          <input placeholder="Оборудование" value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
          <input type="number" min="0" placeholder="Кол-во" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} style={{ width: 70, padding: "6px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />
          <Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>✕</Btn>
        </div>}
    </div>}
  </div>;
}
