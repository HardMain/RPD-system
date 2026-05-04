import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { SOFTWARE_TYPES } from "../catalogs.js";

export function SoftwareEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.software || [];
  const tbodyRef = useRef(null);

  async function addRow() {
    try { await api.addSoftware(rpdId, { name: "", license_type: null }); await reload(); } catch {}
  }
  async function delRow(item) {
    const filled = (item.name || "").trim() || (item.license_type || "").trim();
    if (filled && !confirm("Удалить запись?")) return;
    try { await api.deleteSoftware(item.id_software); await reload(); } catch {}
  }
  async function delById(id) {
    const item = items.find(it => String(it.id_software) === String(id));
    if (item) await delRow(item);
  }

  async function saveRow(item, patch) {
    try {
      await api.updateSoftware(item.id_software, {
        name: patch.name ?? item.name ?? "",
        license_type: patch.license_type !== undefined ? patch.license_type : (item.license_type ?? null),
      });
      await reload();
    } catch {}
  }

  return <div>
    {items.length > 0 ? (
      <div style={{ position: "relative" }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "35%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>Вид ПО</th>
            <th style={th}>Наименование ПО</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {items.map(item => (
            <SoftwareRow
              key={item.id_software}
              item={item}
              editable={editable}
              onSave={(patch) => saveRow(item, patch)}
            />
          ))}
        </tbody>
      </table>
      </div>
      {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить запись" />}
      </div>
    ) : (
      <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
        Не используется
      </div>
    )}
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={addRow}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
  </div>;
}

function SoftwareRow({ item, editable, onSave }) {
  const [name, setName] = useState(item.name || "");
  useEffect(() => { setName(item.name || ""); }, [item.name]);

  function commitName() {
    if (name === (item.name || "")) return;
    onSave({ name });
  }
  function changeType(v) {
    if ((v || null) === (item.license_type || null)) return;
    onSave({ license_type: v || null });
  }

  if (!editable) {
    return <tr>
      <td style={td}>{item.license_type || ""}</td>
      <td style={td}>{item.name || ""}</td>
    </tr>;
  }

  const typeOptions = SOFTWARE_TYPES.map(s => ({ value: s, label: s }));

  return <tr data-trash-row data-trash-id={item.id_software}>
    <td style={{ ...td, padding: 4 }}>
      <Dropdown
        value={item.license_type || ""}
        options={typeOptions}
        onChange={changeType}
        placeholder="Выбрать вид ПО"
        clearLabel="Не выбрано"
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
        placeholder="Например, LibreOffice 7.5"
        style={inlineInput}
      />
    </td>
  </tr>;
}

const inlineInput = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};
