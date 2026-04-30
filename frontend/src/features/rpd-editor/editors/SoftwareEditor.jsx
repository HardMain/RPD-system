import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { SOFTWARE_TYPES } from "../catalogs.js";

/**
 * Раздел 6.3 — «Лицензионное и свободно распространяемое ПО».
 * Два поля: «Вид ПО» (license_type на бэке) и «Наименование ПО» (name).
 */
export function SoftwareEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const initial = { license_type: "", name: "" };
  const [form, setForm] = useState(initial);

  const add = async () => {
    if (!form.name.trim()) return;
    try {
      await api.addSoftware(rpdId, { name: form.name.trim(), license_type: form.license_type || null });
      setShowAdd(false); setForm(initial); await reload();
    } catch { }
  };
  const del = async (id) => { await api.deleteSoftware(id); await reload(); };

  const typeOptions = SOFTWARE_TYPES.map(s => ({ value: s, label: s }));

  return <div>
    {rpd.software?.length > 0 ? <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>
        <th style={th}>Вид ПО</th>
        <th style={th}>Наименование ПО</th>
        {isEdit && canEdit && <th style={th} />}
      </tr></thead>
      <tbody>{rpd.software.map(s => <tr key={s.id_software}>
        <td style={td}>{s.license_type || "—"}</td>
        <td style={td}>{s.name}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}>
          <button onClick={() => del(s.id_software)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>
        </td>}
      </tr>)}</tbody>
    </table></div> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>ПО не добавлено</div>}

    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Вид ПО</div>
            <Dropdown
              value={form.license_type}
              options={typeOptions}
              onChange={v => setForm(p => ({ ...p, license_type: v }))}
              placeholder="Выбрать вид ПО"
              clearLabel="Не выбрано"
            />
          </div>
          <div style={{ flex: "2 1 280px", minWidth: 200 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Наименование ПО</div>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Например, LibreOffice 7.5"
              style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <Btn small primary onClick={add}>Добавить</Btn>
          <Btn small onClick={() => { setShowAdd(false); setForm(initial); }}>✕</Btn>
        </div>}
    </div>}
  </div>;
}
