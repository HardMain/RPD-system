import { useRef, memo } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { SOFTWARE_TYPES } from "../catalogs.js";
import { useRowEditor } from "../hooks/useRowEditor.jsx";

const fetchSoftwareSuggestions = async (q, licenseType) => {
  if (!licenseType) return [];
  const r = await api.getSuggestions("software_name", { q, source_type: licenseType });
  return r.data?.items || [];
};

function SoftwareEditorBase() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.software || [];
  const tbodyRef = useRef(null);
  const { addRow, saveRow, delById, confirmModal } = useRowEditor({
    items, editable, reload, idKey: "id_software",
    autoAddWhenEmpty: true,
    add: () => api.addSoftware(rpdId, { name: "", license_type: null }),
    update: (item, patch) => api.updateSoftware(item.id_software, {
      name: patch.name ?? item.name ?? "",
      license_type: patch.license_type !== undefined ? patch.license_type : (item.license_type ?? null),
    }),
    remove: (item) => api.deleteSoftware(item.id_software),
    isFilled: (item) => !!((item.name || "").trim() || (item.license_type || "").trim()),
  });

  return <div>
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
              deletable={items.length > 1}
              onSave={(patch) => saveRow(item, patch)}
              disciplineId={rpd.id_discipline}
            />
          ))}
        </tbody>
      </table>
      </div>
      {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить запись" />}
    </div>
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={addRow}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
    {confirmModal}
  </div>;
}

function SoftwareRow({ item, editable, deletable = true, onSave, disciplineId }) {
  function changeType(v) {
    if ((v || null) === (item.license_type || null)) return;
    onSave({ license_type: v || null });
  }
  function commitName(v) {
    if (v === (item.name || "")) return;
    onSave({ name: v });
  }

  if (!editable) {
    return <tr>
      <td style={td}>{item.license_type || ""}</td>
      <td style={td}>{item.name || ""}</td>
    </tr>;
  }

  const typeOptions = SOFTWARE_TYPES.map(s => ({ value: s, label: s }));

  const trashProps = deletable ? { "data-trash-row": "", "data-trash-id": item.id_software } : {};
  return <tr {...trashProps}>
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
      <Combobox
        value={item.name || ""}
        onCommit={commitName}
        fetchSuggestions={(q) => fetchSoftwareSuggestions(q, item.license_type)}
        resetKey={item.license_type || ""}
        placeholder={item.license_type ? "Начните вводить или выберите из подсказок" : "Сначала выберите вид ПО для подсказок"}
        textarea
        collapsedMaxHeight={64}
        style={inlineTextarea}
      />
    </td>
  </tr>;
}

export const SoftwareEditor = memo(SoftwareEditorBase);
