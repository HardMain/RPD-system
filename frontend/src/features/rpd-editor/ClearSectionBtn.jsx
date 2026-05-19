import { useState } from "react";
import { Btn } from "../../components/Btn.jsx";
import { useRpdEditor } from "./RpdEditorContext.jsx";
import { ConfirmDeleteModal } from "./EditorModals.jsx";

export function ClearSectionBtn({ skey }) {
  const { clearSection, clearCount, generating, isEdit, canEdit } = useRpdEditor();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isEdit || !canEdit) return null;

  const disabled = !!generating || busy || clearCount(skey) === 0;

  return <>
    <Btn small danger disabled={disabled} onClick={() => setAsk(true)}>
      {busy ? "Очистка..." : "Очистить"}
    </Btn>
    {ask && <ConfirmDeleteModal
      title="Очистить раздел?"
      message="Всё содержимое этого раздела будет удалено без возможности восстановления."
      confirmLabel="Очистить"
      onClose={() => setAsk(false)}
      onConfirm={async () => {
        setAsk(false);
        setBusy(true);
        try { await clearSection(skey); } catch { }
        setBusy(false);
      }}
    />}
  </>;
}
