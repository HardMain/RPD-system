import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F, dropdownTrigger, dropdownChevron, dropdownPopup, dropdownItem } from "../styles/index.js";
import { useDismiss } from "../hooks/useDismiss.js";
import { useDropdownAnchor } from "../hooks/useDropdownAnchor.js";

export function Dropdown({ value, onChange, options, placeholder = "—", disabled = false, title, clearLabel, searchable = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const searchRef = useRef(null);

  useDismiss(open, () => { setOpen(false); setQuery(""); }, [wrapRef, popupRef]);
  const coords = useDropdownAnchor(wrapRef, open);

  const opts = (options || []).map(o => ({ value: o.value, label: o.label ?? o.value }));
  const current = opts.find(o => o.value === value);
  const display = current?.label ?? "";
  const empty = !display;

  const showSearch = searchable && opts.length > 3;
  const filtered = showSearch && query.trim()
    ? opts.filter(o => (o.label || "").toLowerCase().includes(query.trim().toLowerCase()))
    : opts;

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    if (!open) setQuery("");
  }, [open, showSearch]);

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
      <div ref={popupRef} style={dropdownPopup({ left: coords.left, top: coords.top, width: coords.width, maxHeight: 280 })}>
        {showSearch && (
          <div style={{ padding: 6, borderBottom: "1px solid " + T.borderLight, background: T.surface, position: "sticky", top: 0 }}>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск…"
              style={{ width: "100%", padding: "5px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, fontFamily: F, boxSizing: "border-box", outline: "none" }}
            />
          </div>
        )}
        {clearLabel && !query.trim() && (
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
        {filtered.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
            {query.trim() ? "Ничего не найдено" : "Нет вариантов"}
          </div>
        ) : filtered.map(o => {
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
