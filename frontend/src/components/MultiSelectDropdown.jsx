import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F } from "../theme.js";

let _measureCtx = null;
function _measure(s) {
  if (typeof document === "undefined") return (s || "").length * 7;
  if (!_measureCtx) {
    _measureCtx = document.createElement("canvas").getContext("2d");
    if (_measureCtx) _measureCtx.font = `13px ${F}`;
  }
  return _measureCtx ? _measureCtx.measureText(s || "").width : (s || "").length * 7;
}

export function MultiSelectDropdown({ value, onChange, options, placeholder = "Не выбрано", disabled = false, title }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  const propValue = Array.isArray(value) ? value : [];
  const propKey = propValue.join("|");
  const [localSelected, setLocalSelected] = useState(propValue);
  const localKeyRef = useRef(propKey);
  const localSelectedRef = useRef(propValue);
  useEffect(() => {
    if (propKey !== localKeyRef.current) {
      localKeyRef.current = propKey;
      localSelectedRef.current = propValue;
      setLocalSelected(propValue);
    }
  }, [propKey]);

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
      setCoords({ left: r.left, top: r.bottom + 2, btnWidth: r.width });
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
    const prev = localSelectedRef.current;
    const next = prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt];
    localSelectedRef.current = next;
    localKeyRef.current = next.join("|");
    setLocalSelected(next);
    onChange(next);
  }

  const display = localSelected.length === 0 ? "" : localSelected.join(", ");
  const empty = !display;

  const popupContentWidth = (options || []).reduce(
    (a, opt) => Math.max(a, Math.ceil(_measure(opt))),
    0,
  ) + 16 + 8 + 20 + 14;

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
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
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
        left: coords.left, top: coords.top,
        width: Math.max(coords.btnWidth, popupContentWidth),
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
          const checked = localSelected.includes(opt);
          return <label
            key={opt}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontFamily: F, fontSize: 13,
              color: T.text, lineHeight: 1.35,
              background: checked ? T.accentLight : "transparent",
              whiteSpace: "nowrap",
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
            <span>{opt}</span>
          </label>;
        })}
      </div>,
      document.body
    )}
  </div>;
}
