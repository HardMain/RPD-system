import { T } from "../../styles/index.js";
import { useRpdEditor } from "./RpdEditorContext.jsx";

function box(border, bg) {
  return {
    padding: 20,
    textAlign: "center",
    color: border,
    fontSize: 13,
    fontWeight: 600,
    border: "1px dashed " + border,
    borderRadius: 6,
    background: bg,
  };
}

export function GenPlaque({ skey, keys, children }) {
  const { generating, genResult } = useRpdEditor();
  const ks = keys || (skey ? [skey] : []);
  if (generating && ks.includes(generating)) {
    return <div style={box(T.accent, T.accentLight)}>Генерация содержания с помощью LLM…</div>;
  }
  if (genResult && ks.includes(genResult.key)) {
    if (genResult.ok) {
      return <div style={box(T.green, T.greenLight)}>✓ Раздел сгенерирован</div>;
    }
    if (genResult.reason === "cancelled") {
      return <div style={box(T.textMuted, T.bg)}>✕ Генерация отменена — содержимое не изменено</div>;
    }
    const msg = genResult.reason === "llm"
      ? "✗ LLM сейчас недоступен — попробуйте позже. Содержимое не изменено"
      : "✗ Модель не вернула применимый результат. Содержимое не изменено";
    return <div style={box(T.red, T.redBg)}>{msg}</div>;
  }
  return children;
}
