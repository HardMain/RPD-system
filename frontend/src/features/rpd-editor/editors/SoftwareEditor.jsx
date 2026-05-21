import { useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { SOFTWARE_TYPES } from "../catalogs.js";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

const fetchSoftwareSuggestions = async (q, id_discipline) => {
  const params = { q };
  if (id_discipline) params.id_discipline = id_discipline;
  const r = await api.getSuggestions("software_name", params);
  return r.data?.items || [];
};

export function SoftwareEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.software || [];
  const tbodyRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function addRow() {
    try { await api.addSoftware(rpdId, { name: "", license_type: null }); await reload(); } catch {}
  }
  async function performDelete(item) {
    if (!item) return;
    try { await api.deleteSoftware(item.id_software); await reload(); } catch {}
  }
  function delRow(item) {
    const filled = (item.name || "").trim() || (item.license_type || "").trim();
    if (filled) { setPendingDelete(item); return; }
    performDelete(item);
  }
  function delById(id) {
    const item = items.find(it => String(it.id_software) === String(id));
    if (item) delRow(item);
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
              disciplineId={rpd.id_discipline}
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
    {pendingDelete && <ConfirmDeleteModal
      title="Удалить запись?"
      message="Запись содержит данные. После удаления восстановить её будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
    />}
  </div>;
}

function SoftwareRow({ item, editable, onSave, disciplineId }) {
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
      <Combobox
        value={item.name || ""}
        onCommit={commitName}
        fetchSuggestions={(q) => fetchSoftwareSuggestions(q, disciplineId)}
        placeholder="Например, LibreOffice 7.5"
        textarea
        collapsedMaxHeight={64}
        style={inlineTextarea}
      />
    </td>
  </tr>;
}
