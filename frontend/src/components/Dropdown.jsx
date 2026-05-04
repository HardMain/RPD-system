import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F } from "../theme.js";

export function Dropdown({ value, onChange, options, placeholder = "—", disabled = false, title, clearLabel }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

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

  const opts = (options || []).map(o => ({ value: o.value, label: o.label ?? o.value }));
  const current = opts.find(o => o.value === value);
  const display = current?.label ?? "";
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
        left: coords.left,
        top: coords.top,
        width: coords.width,
        background: T.surface,
        border: "1px solid " + T.border,
        borderRadius: 4,
        boxShadow: "0 6px 20px rgba(0,0,0,.14)",
        zIndex: 1100,
        maxHeight: 240,
        overflowY: "auto",
      }}>
        {clearLabel && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 10px",
              border: "none", borderBottom: "1px solid " + T.borderLight,
              background: "transparent",
              cursor: "pointer", fontFamily: F, fontSize: 13,
              color: T.textMuted, fontStyle: "italic",
              lineHeight: 1.4,
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.bg}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {clearLabel}
          </button>
        )}
        {opts.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>Нет вариантов</div>
        ) : opts.map(o => {
          const picked = o.value === value;
          return <button
            key={o.value}
            type="button"
            onClick={() => { onChange(o.value); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 10px",
              border: "none", borderBottom: "1px solid " + T.borderLight,
              background: picked ? T.accentLight : "transparent",
              cursor: "pointer", fontFamily: F, fontSize: 13,
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
            {o.label}
          </button>;
        })}
      </div>,
      document.body
    )}
  </div>;
}
