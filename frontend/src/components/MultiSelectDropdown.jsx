import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F } from "../theme.js";

export function MultiSelectDropdown({ value, onChange, options, placeholder = "Не выбрано", disabled = false, title }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return; }
    const place = () => {
      const el = wrapRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ left: r.left, top: r.bottom + 2, width: r.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  function toggle(opt) {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  }

  const display = selected.length === 0 ? "" : selected.join(", ");
  const empty = !display;

  return <div ref={wrapRef} style={{ position: "relative", width: "100%" }} title={title}>
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (!disabled) setOpen(o => !o); }}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "6px 26px 6px 10px",
        border: "1px solid " + T.borderLight,
        borderRadius: 4,
        background: disabled ? "transparent" : T.surface,
        fontSize: 13,
        fontFamily: F,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "break-word",
        lineHeight: 1.35,
        position: "relative",
        color: empty ? T.textMuted : T.text,
        fontStyle: empty ? "italic" : "normal",
        boxSizing: "border-box",
        outline: "none",
      }}
    >
      {display || placeholder}
      {!disabled && <span style={{
        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
        color: T.textMuted, fontSize: 16, fontWeight: 700,
        pointerEvents: "none", lineHeight: 1,
      }}>▾</span>}
    </button>
    {open && coords && createPortal(
      <div ref={popupRef} style={{
        position: "fixed",
        left: coords.left, top: coords.top, width: coords.width,
        background: T.surface,
        border: "1px solid " + T.border,
        borderRadius: 4,
        boxShadow: "0 6px 20px rgba(0,0,0,.14)",
        zIndex: 1100,
        maxHeight: 280,
        overflowY: "auto",
        padding: "4px 0",
      }}>
        {(options || []).map(opt => {
          const checked = selected.includes(opt);
          return <label
            key={opt}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontFamily: F, fontSize: 13,
              color: T.text, lineHeight: 1.35,
              background: checked ? T.accentLight : "transparent",
            }}
            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = T.bg; }}
            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              style={{ margin: 0, accentColor: T.accent, flexShrink: 0 }}
            />
            <span style={{ wordBreak: "normal", overflowWrap: "break-word" }}>{opt}</span>
          </label>;
        })}
      </div>,
      document.body
    )}
  </div>;
}
