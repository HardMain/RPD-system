import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, dropdownTrigger, dropdownChevron, dropdownPopup, dropdownItem } from "../styles/index.js";
import { useDismiss } from "../hooks/useDismiss.js";
import { useDropdownAnchor } from "../hooks/useDropdownAnchor.js";

export function Dropdown({ value, onChange, options, placeholder = "—", disabled = false, title, clearLabel }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  useDismiss(open, () => setOpen(false), [wrapRef, popupRef]);
  const coords = useDropdownAnchor(wrapRef, open);

  const opts = (options || []).map(o => ({ value: o.value, label: o.label ?? o.value }));
  const current = opts.find(o => o.value === value);
  const display = current?.label ?? "";
  const empty = !display;

  return <div ref={wrapRef} style={{ position: "relative", width: "100%" }} title={title}>
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (!disabled) setOpen(o => !o); }}
      style={dropdownTrigger({ disabled, empty, wrap: true })}
    >
      {display || placeholder}
      {!disabled && <span style={dropdownChevron(16)}>▾</span>}
    </button>
    {open && coords && createPortal(
      <div ref={popupRef} style={dropdownPopup({ left: coords.left, top: coords.top, width: coords.width, maxHeight: 240 })}>
        {clearLabel && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            style={{ ...dropdownItem({}), color: T.textMuted, fontStyle: "italic" }}
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
            style={dropdownItem({ picked })}
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
