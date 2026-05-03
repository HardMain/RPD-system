import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

/**
 * Раздел 7 «Материально-техническое обеспечение». Шапка 1:1 с rpd_template.docx
 * (TABLE 15): «Вид занятий | Наименование необходимого основного оборудования
 * | Количество единиц». На бэке поле «Вид занятий» исторически называется
 * `room_type` — переиспользуется под template-семантику (см. backend
 * rpd_template_context.py: lesson_type ← room_type).
 */
export function MtechEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.material_tech || [];

  async function addRow() {
    try { await api.addMaterialTech(rpdId, { room_type: "", equipment: "", quantity: null }); await reload(); } catch {}
  }
  async function delRow(item) {
    const filled = (item.room_type || "").trim() || (item.equipment || "").trim() || item.quantity != null;
    if (filled && !confirm("Удалить запись?")) return;
    try { await api.deleteMaterialTech(item.id_material_tech); await reload(); } catch {}
  }
  async function saveRow(item, patch) {
    try {
      await api.updateMaterialTech(item.id_material_tech, {
        room_type: patch.room_type ?? item.room_type ?? "",
        equipment: patch.equipment !== undefined ? patch.equipment : (item.equipment ?? ""),
        quantity: patch.quantity !== undefined ? patch.quantity : (item.quantity ?? null),
      });
      await reload();
    } catch {}
  }

  return <div>
    {items.length > 0 ? (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "25%" }} />
          <col />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>Вид занятий</th>
            <th style={th}>Наименование необходимого основного оборудования</th>
            <th style={{ ...th, textAlign: "center" }}>Количество единиц</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <MtechRow
              key={item.id_material_tech}
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


function MtechRow({ item, editable, onSave, onDelete }) {
  const [roomType, setRoomType] = useState(item.room_type || "");
  const [equipment, setEquipment] = useState(item.equipment || "");
  const [quantity, setQuantity] = useState(item.quantity == null ? "" : String(item.quantity));
  // Защита от «отката» свежего ввода: useEffect больше не перезатирает буфер
  // безусловно — только если пользователь не успел напечатать что-то новое
  // (live-ввод сравнивается с предыдущим серверным значением через ref).
  const roomRef = useRef(item.room_type || "");
  const equipRef = useRef(item.equipment || "");
  const qtyRef = useRef(item.quantity == null ? "" : String(item.quantity));
  useEffect(() => {
    const next = item.room_type || "";
    if (roomType === roomRef.current) setRoomType(next);
    roomRef.current = next;
  }, [item.room_type]);
  useEffect(() => {
    const next = item.equipment || "";
    if (equipment === equipRef.current) setEquipment(next);
    equipRef.current = next;
  }, [item.equipment]);
  useEffect(() => {
    const next = item.quantity == null ? "" : String(item.quantity);
    if (quantity === qtyRef.current) setQuantity(next);
    qtyRef.current = next;
  }, [item.quantity]);

  function commitRoom() {
    if (roomType === (item.room_type || "")) return;
    onSave({ room_type: roomType });
  }
  function commitEquip() {
    if (equipment === (item.equipment || "")) return;
    onSave({ equipment });
  }
  function commitQty() {
    const n = quantity.trim() === "" ? null : Number(quantity);
    if (n === item.quantity) return;
    onSave({ quantity: n });
  }

  if (!editable) {
    return <tr>
      <td style={td}>{item.room_type || ""}</td>
      <td style={td}>{item.equipment || ""}</td>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{item.quantity ?? ""}</td>
    </tr>;
  }

  return <tr>
    <td style={{ ...td, padding: 4 }}>
      <input
        value={roomType}
        onChange={e => setRoomType(e.target.value)}
        onBlur={commitRoom}
        placeholder="Например, Лабораторные работы"
        style={inlineInput}
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <textarea
        value={equipment}
        onChange={e => setEquipment(e.target.value)}
        onBlur={commitEquip}
        placeholder="Например, Учебная аудитория с проектором, ноутбуками…"
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center", position: "relative", overflow: "visible" }}>
      <input
        type="number"
        min="0"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        onBlur={commitQty}
        placeholder="—"
        style={inlineNumber}
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

const inlineTextarea = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F, lineHeight: 1.45,
  background: T.surface,
  resize: "vertical",
  minHeight: 32,
  boxSizing: "border-box",
  outline: "none",
};

const inlineNumber = {
  width: "100%",
  padding: "4px 2px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
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
