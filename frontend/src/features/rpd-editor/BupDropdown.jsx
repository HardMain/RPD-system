import { useEffect, useRef, useState } from "react";
import { T, F } from "../../theme.js";

/**
 * Кастомный выпадающий список БУП-привязок. Используется в редакторе раздела 2
 * («Дисциплина БУП») и в PDF-тулбаре.
 *
 * Сделан вместо нативного `<select>` потому что:
 * - native-select раскрывается шире контейнера, если самый длинный option
 *   длиннее, и улетает за границу страницы;
 * - native-select не умеет переносить текст опции на несколько строк, у нас же
 *   подписи привязок длинные («2015 ЭТФ ПИ б (полный) · Б1.Б.08»).
 *
 * Этот дропдаун:
 * - в закрытом виде показывает текущую подпись с обрезкой по ellipsis,
 *   справа — стрелка ▾, текст не наезжает на стрелку (у кнопки правый паддинг);
 * - в раскрытом — попап шириной ровно как кнопка, длинные подписи переносятся
 *   по словам.
 */
export function BupDropdown({ bds, value, onChange, compact = false, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = bds.find(b => b.id_bup_discipline === value) || bds[0];
  if (!current) return null;
  const labelOf = (b) =>
    `${b.bup_year ? b.bup_year + " " : ""}${b.bup_name || "БУП"}${b.code ? ` · ${b.code}` : ""}`;

  const fontSize = compact ? 11 : 13;
  // В compact-режиме (PDF-тулбар) высота должна совпадать с другими кнопками
  // тулбара (24px у pdfToolBtn, ↻Обновить и Скачать). Фиксируем высоту и
  // выставляем line-height близкий к высоте, чтобы текст центрировался по вертикали.
  const buttonStyle = compact
    ? { height: 24, lineHeight: "22px", padding: "0 24px 0 10px" }
    : { padding: "6px 26px 6px 10px" };

  return <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }} title={title}>
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      style={{
        width: "100%",
        textAlign: "left",
        ...buttonStyle,
        border: "1px solid " + T.border,
        borderRadius: 4,
        background: T.surface,
        fontSize,
        fontFamily: F,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        position: "relative",
        color: T.text,
        boxSizing: "border-box",
      }}
    >
      {labelOf(current)}
      <span style={{
        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
        color: T.textMuted, fontSize: compact ? 14 : 16, fontWeight: 700,
        pointerEvents: "none", lineHeight: 1,
      }}>▾</span>
    </button>
    {open && (
      <div style={{
        position: "absolute",
        top: "calc(100% + 2px)",
        left: 0,
        right: 0,
        background: T.surface,
        border: "1px solid " + T.border,
        borderRadius: 4,
        boxShadow: "0 6px 20px rgba(0,0,0,.14)",
        zIndex: 100,
        maxHeight: 320,
        overflowY: "auto",
      }}>
        {bds.map(b => {
          const picked = b.id_bup_discipline === value;
          return <button
            key={b.id_bup_discipline}
            type="button"
            onClick={() => { onChange(b.id_bup_discipline); setOpen(false); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              border: "none",
              borderBottom: "1px solid " + T.borderLight,
              background: picked ? T.accentLight : "transparent",
              cursor: "pointer",
              fontFamily: F,
              fontSize,
              color: picked ? T.accent : T.text,
              fontWeight: picked ? 600 : 400,
              lineHeight: 1.4,
              wordBreak: "normal",
              overflowWrap: "break-word",
              whiteSpace: "normal",
            }}
            onMouseEnter={e => { if (!picked) e.currentTarget.style.background = T.bg; }}
            onMouseLeave={e => { if (!picked) e.currentTarget.style.background = "transparent"; }}
          >
            {labelOf(b)}
          </button>;
        })}
      </div>
    )}
  </div>;
}
