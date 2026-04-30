import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { DATABASE_TYPES } from "../catalogs.js";

/**
 * Раздел 6.4 — «Профессиональные БД и ИСС».
 * Два поля: «Вид БД» (db_type) и «Наименование БД» (name).
 */
export function DatabasesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [showAdd, setShowAdd] = useState(false);
  const initial = { db_type: "", name: "" };
  const [form, setForm] = useState(initial);

  const add = async () => {
    if (!form.name.trim()) return;
    try {
      await api.addDatabase(rpdId, { name: form.name.trim(), db_type: form.db_type || null });
      setShowAdd(false); setForm(initial); await reload();
    } catch { }
  };
  const del = async (id) => { try { await api.deleteDatabase(id); await reload(); } catch { } };

  const typeOptions = DATABASE_TYPES.map(s => ({ value: s, label: s }));

  return <div>
    {rpd.databases?.length > 0 ? <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>
        <th style={th}>Вид БД</th>
        <th style={th}>Наименование БД</th>
        {isEdit && canEdit && <th style={th} />}
      </tr></thead>
      <tbody>{rpd.databases.map(d => <tr key={d.id_database}>
        <td style={td}>{d.db_type || "—"}</td>
        <td style={td}>{d.name}</td>
        {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}>
          <button onClick={() => del(d.id_database)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>
        </td>}
      </tr>)}</tbody>
    </table></div> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>БД не добавлены — в шаблон будет вставлен стандартный перечень ПНИПУ</div>}

    {isEdit && canEdit && <div style={{ marginTop: 8 }}>
      {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Вид БД</div>
            <Dropdown
              value={form.db_type}
              options={typeOptions}
              onChange={v => setForm(p => ({ ...p, db_type: v }))}
              placeholder="Выбрать вид БД"
              clearLabel="Не выбрано"
            />
          </div>
          <div style={{ flex: "2 1 280px", minWidth: 200 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Наименование БД</div>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Например, eLIBRARY.RU"
              style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <Btn small primary onClick={add}>Добавить</Btn>
          <Btn small onClick={() => { setShowAdd(false); setForm(initial); }}>✕</Btn>
        </div>}
    </div>}
  </div>;
}
