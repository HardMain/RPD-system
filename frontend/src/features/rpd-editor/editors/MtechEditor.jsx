import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

export function MtechEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.material_tech || [];
  const tbodyRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function addRow() {
    try { await api.addMaterialTech(rpdId, { room_type: "", equipment: "", quantity: null }); await reload(); } catch {}
  }
  async function performDelete(item) {
    if (!item) return;
    try { await api.deleteMaterialTech(item.id_material_tech); await reload(); } catch {}
  }
  function delRow(item) {
    const filled = (item.room_type || "").trim() || (item.equipment || "").trim() || item.quantity != null;
    if (filled) { setPendingDelete(item); return; }
    performDelete(item);
  }
  function delById(id) {
    const item = items.find(it => String(it.id_material_tech) === String(id));
    if (item) delRow(item);
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
      <div style={{ position: "relative" }}>
      <div className="table-scroll">
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
        <tbody ref={tbodyRef}>
          {items.map(item => (
            <MtechRow
              key={item.id_material_tech}
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
    {pendingDelete && <ConfirmDeleteModal
      title="Удалить запись?"
      message="Запись содержит данные. После удаления восстановить её будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
    />}
  </div>;
}

function MtechRow({ item, editable, onSave }) {
  const [roomType, setRoomType] = useState(item.room_type || "");
  const [equipment, setEquipment] = useState(item.equipment || "");
  const [quantity, setQuantity] = useState(item.quantity == null ? "" : String(item.quantity));

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

  return <tr data-trash-row data-trash-id={item.id_material_tech}>
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
      <ExpandableTextarea
        value={equipment}
        onChange={e => setEquipment(e.target.value)}
        onBlur={commitEquip}
        placeholder="Например, Учебная аудитория с проектором, ноутбуками…"
        collapsedMaxHeight={70}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <input
        type="number"
        min="0"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        onBlur={commitQty}
        placeholder="—"
        style={inlineNumber}
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

const inlineTextarea = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F, lineHeight: 1.45,
  background: T.surface,
  minHeight: 32,
  boxSizing: "border-box",
  outline: "none",
};

const inlineNumber = {
  width: "auto",
  fieldSizing: "content",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
};

