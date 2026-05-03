import { useEffect, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { SOFTWARE_TYPES } from "../catalogs.js";

/**
 * 6.4 «Лицензионное и свободно распространяемое программное обеспечение».
 * Шапка 1:1 с rpd_template.docx (TABLE 14): «Вид ПО | Наименование ПО».
 * На бэке колонка вида исторически называется `license_type`, переиспользуется
 * под «Вид ПО» — на UI это видно из дропдауна с SOFTWARE_TYPES.
 *
 * Inline-редактирование: значения правятся прямо в ячейках, сохранение по
 * onBlur. Пустую строку (без названия) удаляем без подтверждения.
 */
export function SoftwareEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.software || [];

  async function addRow() {
    try { await api.addSoftware(rpdId, { name: "", license_type: null }); await reload(); } catch {}
  }
  async function delRow(item) {
    const filled = (item.name || "").trim() || (item.license_type || "").trim();
    if (filled && !confirm("Удалить запись?")) return;
    try { await api.deleteSoftware(item.id_software); await reload(); } catch {}
  }
  // PUT принимает SoftwareCreate целиком — шлём актуальное состояние всей строки.
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
        <tbody>
          {items.map(item => (
            <SoftwareRow
              key={item.id_software}
              item={item}
              editable={editable}
              onSave={(patch) => saveRow(item, patch)}
              onDelete={() => delRow(item)}
            />
          ))}
        </tbody>
      </table>
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


function SoftwareRow({ item, editable, onSave, onDelete }) {
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

  return <tr>
    <td style={{ ...td, padding: 4 }}>
      <Dropdown
        value={item.license_type || ""}
        options={typeOptions}
        onChange={changeType}
        placeholder="Выбрать вид ПО"
        clearLabel="Не выбрано"
      />
    </td>
    <td style={{ ...td, padding: 4, position: "relative", overflow: "visible" }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
        placeholder="Например, LibreOffice 7.5"
        style={inlineInput}
      />
      <button onClick={onDelete} title="Удалить запись" style={trashBtn}><TrashIcon /></button>
    </td>
  </tr>;
}


// ─── Styles ─────────────────────────────────────────────────────────────────

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

const trashBtn = {
  position: "absolute",
  left: "calc(100% + 8px)",
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: 4,
  color: T.textMuted,
  display: "inline-flex",
};
