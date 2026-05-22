import { useEffect, useRef, useState } from "react";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

export function useRowEditor({
  items,
  editable,
  reload,
  idKey,
  add,
  update,
  remove,
  isFilled,
  autoAddWhenEmpty = false,
  confirmTitle = "Удалить запись?",
  confirmMessage = "Запись содержит данные. После удаления восстановить её будет нельзя.",
}) {
  const [pendingDelete, setPendingDelete] = useState(null);

  async function addRow() {
    try { await add(); await reload(); } catch {}
  }
  async function performDelete(item) {
    if (!item) return;
    try { await remove(item); await reload(); } catch {}
  }
  function delRow(item) {
    if (isFilled(item)) { setPendingDelete(item); return; }
    performDelete(item);
  }
  function delById(id) {
    const item = items.find(it => String(it[idKey]) === String(id));
    if (item) delRow(item);
  }
  async function saveRow(item, patch) {
    try { await update(item, patch); await reload(); } catch {}
  }

  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (!autoAddWhenEmpty || !editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    if (items.length === 0) addRow();
  }, [editable]);

  const confirmModal = pendingDelete ? (
    <ConfirmDeleteModal
      title={confirmTitle}
      message={confirmMessage}
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
    />
  ) : null;

  return { addRow, saveRow, delById, confirmModal };
}
