import { Btn } from "../../components/Btn.jsx";
import { useRpdEditor } from "./RpdEditorContext.jsx";

export function GenButton({ skey }) {
  const { generating, genBatch, genBusy, autoFill, cancelGeneration } = useRpdEditor();
  if (generating === skey && !genBatch) {
    return <Btn small danger onClick={cancelGeneration} style={{ flexShrink: 0 }}>✕ Отменить</Btn>;
  }
  return <Btn small primary onClick={() => autoFill(skey)} disabled={genBusy} style={{ flexShrink: 0 }}>
    {generating === skey ? "Генерация..." : "Сгенерировать"}
  </Btn>;
}
