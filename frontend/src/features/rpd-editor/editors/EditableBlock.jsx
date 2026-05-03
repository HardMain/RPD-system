import { useLayoutEffect, useRef, useState } from "react";
import { T, F } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

/**
 * Текстовый блок раздела (1.1 «Цели и задачи», 1.2, 1.3, 5.1, 5.2 и т.п.).
 *
 * В режиме редактирования отрисован как textarea, правки уезжают в БД сразу
 * после потери фокуса (по-английски — onBlur).
 *
 * Высота: по умолчанию ~4 строки (компактный вид). Если текст длиннее —
 * справа от заголовка появляется кнопка «Раскрыть»: она через ref выставляет
 * inline-высоту textarea равной scrollHeight (полная высота содержимого).
 * Кнопка превращается в «Скрыть» — возвращает компактный размер.
 *
 * Без отдельной CSS-переменной expanded textarea не может вырасти под текст:
 * у textarea «авто-высота» (без inline `height`) считается по атрибуту rows,
 * а не по реальному содержимому. Поэтому нужно либо field-sizing: content
 * (новая CSS-фича, не везде поддерживается), либо ручная установка height
 * через JS — мы выбираем второе.
 */
const COLLAPSED_HEIGHT = 110; // ~4 строки при fontSize 13 и lineHeight 1.7

export function EditableBlock({ skey, label, fieldKey }) {
  const { isEdit, canEdit, generating, autoFill, editTexts, setEditTexts, saveField } = useRpdEditor();
  const val = editTexts[fieldKey] || "";
  const editable = isEdit && canEdit;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const taRef = useRef(null);
  const divRef = useRef(null);

  // Применяем высоту: в развёрнутом режиме — равна высоте текста (scrollHeight),
  // в компактном — снимаем inline height, тогда вступает CSS maxHeight.
  // Запускается также при наборе текста: чтобы в развёрнутом режиме textarea
  // подрастала вместе с содержимым.
  useLayoutEffect(() => {
    if (!editable) return;
    const el = taRef.current;
    if (!el) return;
    if (expanded) {
      // scrollHeight измеряется корректно даже когда maxHeight капает
      // высоту: это «реальная» высота содержимого включая прокручиваемое.
      el.style.height = el.scrollHeight + "px";
    } else {
      el.style.height = ""; // вернуть управление CSS (maxHeight = COLLAPSED_HEIGHT)
    }
  }, [expanded, val, editable, generating]);

  // Видимость кнопки «Раскрыть/Скрыть»: в компактном виде показываем, только
  // если содержимое реально не помещается в видимую часть. В развёрнутом —
  // всегда (юзер должен иметь возможность свернуть обратно).
  useLayoutEffect(() => {
    if (expanded) { setOverflows(true); return; }
    const el = editable ? taRef.current : divRef.current;
    if (!el) { setOverflows(false); return; }
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [val, expanded, editable, generating]);

  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {editable && (
        <Btn small primary onClick={() => autoFill(skey)} disabled={!!generating}>
          {generating === skey ? "Генерация..." : "Автозаполнить"}
        </Btn>
      )}
      <div style={{ flex: 1 }} />
      {overflows && generating !== skey && (
        <Btn small onClick={() => setExpanded(e => !e)}>
          {expanded ? "Скрыть" : "Раскрыть"}
        </Btn>
      )}
    </div>
    {generating === skey ? (
      <div style={{ padding: 20, textAlign: "center", color: T.accent, fontSize: 13, border: "1px dashed " + T.accent, borderRadius: 6, background: T.accentLight }}>
        Генерация содержания с помощью LLM...
      </div>
    ) : editable ? (
      <textarea
        ref={taRef}
        value={val}
        onChange={e => setEditTexts(p => ({ ...p, [fieldKey]: e.target.value }))}
        onBlur={() => saveField?.(fieldKey)}
        style={{
          width: "100%",
          minHeight: COLLAPSED_HEIGHT,
          // В компактном режиме maxHeight капает высоту — даже если intrinsic
          // больше, видим только COLLAPSED_HEIGHT. В развёрнутом снимаем кап,
          // и через ref выставляем inline height = scrollHeight.
          maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
          padding: 16,
          border: "1px solid " + T.borderLight,
          borderRadius: 6,
          background: "#fff",
          fontSize: 13,
          fontFamily: F,
          lineHeight: 1.7,
          overflow: expanded ? "hidden" : "auto",
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    ) : (
      <div
        ref={divRef}
        style={{
          padding: 16,
          border: "1px solid " + T.borderLight,
          borderRadius: 6,
          background: T.bg,
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          minHeight: COLLAPSED_HEIGHT,
          maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
          overflow: expanded ? "visible" : "auto",
          boxSizing: "border-box",
        }}
      >
        {val || <span style={{ color: T.textMuted }}>Не заполнено</span>}
      </div>
    )}
  </div>;
}
