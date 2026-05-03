import { useEffect, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { DATABASE_TYPES } from "../catalogs.js";

/**
 * 6.3 «Современные профессиональные базы данных и информационные справочные
 * системы». Шапка 1:1 с rpd_template.docx (TABLE 13): «Вид БД | Наименование БД».
 *
 * Если в РПД ни одной БД нет — backend подставляет в печатную форму стандартный
 * перечень ПНИПУ (см. rpd_template_context.py), поэтому в редакторе пустое
 * состояние не блокирует «Отправить на согласование».
 */
export function DatabasesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.databases || [];

  async function addRow() {
    try { await api.addDatabase(rpdId, { name: "", db_type: null }); await reload(); } catch {}
  }
  async function delRow(item) {
    const filled = (item.name || "").trim() || (item.db_type || "").trim();
    if (filled && !confirm("Удалить запись?")) return;
    try { await api.deleteDatabase(item.id_database); await reload(); } catch {}
  }
  async function saveRow(item, patch) {
    try {
      await api.updateDatabase(item.id_database, {
        name: patch.name ?? item.name ?? "",
        db_type: patch.db_type !== undefined ? patch.db_type : (item.db_type ?? null),
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
            <th style={th}>Вид БД</th>
            <th style={th}>Наименование БД</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <DatabaseRow
              key={item.id_database}
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


function DatabaseRow({ item, editable, onSave, onDelete }) {
  const [name, setName] = useState(item.name || "");
  useEffect(() => { setName(item.name || ""); }, [item.name]);

  function commitName() {
    if (name === (item.name || "")) return;
    onSave({ name });
  }
  function changeType(v) {
    if ((v || null) === (item.db_type || null)) return;
    onSave({ db_type: v || null });
  }

  if (!editable) {
    return <tr>
      <td style={td}>{item.db_type || ""}</td>
      <td style={td}>{item.name || ""}</td>
    </tr>;
  }

  const typeOptions = DATABASE_TYPES.map(s => ({ value: s, label: s }));

  return <tr>
    <td style={{ ...td, padding: 4 }}>
      <Dropdown
        value={item.db_type || ""}
        options={typeOptions}
        onChange={changeType}
        placeholder="Выбрать вид БД"
        clearLabel="Не выбрано"
      />
    </td>
    <td style={{ ...td, padding: 4, position: "relative", overflow: "visible" }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
        placeholder="Например, eLIBRARY.RU"
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
