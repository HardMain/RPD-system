import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { T } from "../theme.js";
import { ChevronDownIcon, ChevronUpIcon } from "./icons.jsx";

/**
 * Обёртка над <textarea>, заменяющая native resize-handle на компактную
 * иконку-«стрелку» в правом-верхнем углу поля. В свёрнутом виде высота
 * капается через maxHeight (видны первые 3-4 строки + скролл при
 * необходимости). В развёрнутом — height = scrollHeight (текст влезает).
 *
 * Кнопка живёт прямо в углу textarea, поле остаётся «единым целым» — ни
 * шапки сверху, ни зарезервированного места справа. Native scrollbar
 * textarea НЕ пересекается с кнопкой благодаря классу
 * `.expandable-field-sm`: webkit-track имеет `margin-top: 28px`, поэтому
 * physical scroll-track начинается ниже нижней границы кнопки.
 */
export const ExpandableTextarea = forwardRef(function ExpandableTextarea(
  { value, onChange, onBlur, placeholder, disabled, style, collapsedMaxHeight = 110, wrapperStyle, iconColor },
  externalRef,
) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const innerRef = useRef(null);
  const setRef = (node) => {
    innerRef.current = node;
    if (typeof externalRef === "function") externalRef(node);
    else if (externalRef) externalRef.current = node;
  };

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (expanded) el.style.height = el.scrollHeight + "px";
    else el.style.height = "";
  }, [expanded, value]);

  // Видимость иконки = текст не помещается (есть вертикальный скролл).
  // Пересчёт срабатывает не только при изменении value, но и при изменении
  // ширины самой textarea — иначе при сжатии колонки таблицы текст начинает
  // переноситься и появляется скролл, а кнопка не показывается.
  useLayoutEffect(() => {
    if (expanded) { setOverflows(true); return; }
    const el = innerRef.current;
    if (!el) { setOverflows(false); return; }
    const recompute = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, expanded]);

  const showIcon = overflows;

  return <div style={{ position: "relative", ...wrapperStyle }}>
    <textarea
      ref={setRef}
      className="expandable-field-sm"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        ...style,
        maxHeight: expanded ? "none" : collapsedMaxHeight,
        overflow: expanded ? "hidden" : "auto",
        resize: "none",
        paddingRight: showIcon ? ((style?.paddingRight ?? 6) + 24) : (style?.paddingRight ?? 6),
        boxSizing: "border-box",
      }}
    />
    {showIcon && (
      // Прижата к углу textarea: top/right: 1 (не налезть на 1px-border),
      // без верхнего и правого бордера — визуально сливается с углом.
      // Скруглён только верхне-правый (как у textarea) и слабо нижне-левый.
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setExpanded(e => !e)}
        title={expanded ? "Свернуть" : "Развернуть"}
        aria-label={expanded ? "Свернуть" : "Развернуть"}
        style={{
          position: "absolute",
          top: 1,
          right: 1,
          width: 22,
          height: 22,
          padding: 0,
          border: "none",
          borderBottom: "1px solid " + T.borderLight,
          borderLeft: "1px solid " + T.borderLight,
          borderRadius: "0 4px 0 3px",
          background: T.surface,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor || T.textMuted,
          lineHeight: 0,
          zIndex: 2,
        }}
      >
        {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
    )}
  </div>;
});
