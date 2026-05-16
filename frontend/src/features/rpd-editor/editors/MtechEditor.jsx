import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea, inlineNumber } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

const fetchEquipmentSuggestions = async (q) => {
  const r = await api.getSuggestions("equipment", { q });
  return r.data?.items || [];
};
const fetchRoomTypeSuggestions = async (q) => {
  const r = await api.getSuggestions("room_type", { q });
  return r.data?.items || [];
};

export function MtechEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.material_tech || [];
  const tbodyRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function addRow() {
    try { await api.addMaterialTech(rpdId, { room_type: "", equipment: "", quantity: 0 }); await reload(); } catch {}
  }
  async function performDelete(item) {
    if (!item) return;
    try { await api.deleteMaterialTech(item.id_material_tech); await reload(); } catch {}
  }
  function delRow(item) {
    const filled = (item.room_type || "").trim() || (item.equipment || "").trim() || (item.quantity ?? 0) > 0;
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
  const [quantity, setQuantity] = useState(item.quantity ?? 0);
  const qtyRef = useRef(item.quantity ?? 0);
  useEffect(() => {
    const next = item.quantity ?? 0;
    if (quantity === qtyRef.current) setQuantity(next);
    qtyRef.current = next;
  }, [item.quantity]);

  function commitRoom(v) {
    if (v === (item.room_type || "")) return;
    onSave({ room_type: v });
  }
  function commitEquip(v) {
    if (v === (item.equipment || "")) return;
    onSave({ equipment: v });
  }
  function commitQty() {
    const cur = +quantity || 0;
    const orig = item.quantity ?? 0;
    if (cur === orig) return;
    onSave({ quantity: cur });
  }

  if (!editable) {
    return <tr>
      <td style={td}>{item.room_type || ""}</td>
      <td style={td}>{item.equipment || ""}</td>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{item.quantity ?? 0}</td>
    </tr>;
  }

  return <tr data-trash-row data-trash-id={item.id_material_tech}>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.room_type || ""}
        onCommit={commitRoom}
        fetchSuggestions={fetchRoomTypeSuggestions}
        placeholder="Например, Лабораторные работы"
        textarea
        collapsedMaxHeight={64}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.equipment || ""}
        onCommit={commitEquip}
        fetchSuggestions={fetchEquipmentSuggestions}
        placeholder="Например, Учебная аудитория с проектором, ноутбуками…"
        textarea
        collapsedMaxHeight={70}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <input
        type="number"
        min="0"
        value={quantity ?? 0}
        onChange={e => setQuantity(e.target.value === "" ? 0 : +e.target.value)}
        onBlur={commitQty}
        style={inlineNumber}
      />
    </td>
  </tr>;
}


