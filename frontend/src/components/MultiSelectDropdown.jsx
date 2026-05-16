import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F, dropdownTrigger, dropdownChevron, dropdownPopup } from "../styles/index.js";
import { useDismiss } from "../hooks/useDismiss.js";
import { useDropdownAnchor } from "../hooks/useDropdownAnchor.js";

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
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  useDismiss(open, () => setOpen(false), [wrapRef, popupRef]);
  const coords = useDropdownAnchor(wrapRef, open);

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
      style={dropdownTrigger({ disabled, empty, wrap: false })}
    >
      {display || placeholder}
      {!disabled && <span style={dropdownChevron(16)}>▾</span>}
    </button>
    {open && coords && createPortal(
      <div ref={popupRef} style={dropdownPopup({ left: coords.left, top: coords.top, width: Math.max(coords.width, popupContentWidth), maxHeight: 280, padding: "4px 0" })}>
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
