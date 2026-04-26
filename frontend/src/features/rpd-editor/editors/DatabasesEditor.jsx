import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function DatabasesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", url: "" });
  const add = async () => {
    if (!form.name.trim()) return;
    try { await api.addDatabase(rpdId, form); setShowAdd(false); setForm({ name: "", url: "" }); await reload(); } catch { }
  };
  const del = async (id) => { try { await api.deleteDatabase(id); await reload(); } catch { } };

  return <div>
    {rpd.databases?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Наименование", "Ссылка", isEdit && canEdit ? "" : null].filter(x => x !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{rpd.databases.map(d => <tr key={d.id_database}>
        <td style={td}>{d.name}</td>
        <td style={{ ...td, fontSize: 11, color: T.blue, wordBreak: "break-all" }}>{d.url || "—"}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(d.id_database)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
      </tr>)}</tbody>
    </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>БД не добавлены — в шаблон будет вставлен стандартный перечень ПНИПУ</div>}
    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
          <input placeholder="Наименование (например, eLIBRARY.RU)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
          <input placeholder="Ссылка / «локальная сеть»" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
        </div>}
    </div>}
  </div>;
}
