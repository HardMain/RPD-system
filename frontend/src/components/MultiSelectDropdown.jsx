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

export function MultiSelectDropdown({ value, onChange, options, placeholder = "Не выбрано", disabled = false, title, separator = ", ", maxHeight = null, searchable = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const searchRef = useRef(null);

  useDismiss(open, () => { setOpen(false); setQuery(""); }, [wrapRef, popupRef]);
  const coords = useDropdownAnchor(wrapRef, open);

  const showSearch = searchable && (options || []).length > 3;
  const filteredOptions = showSearch && query.trim()
    ? (options || []).filter(o => (o || "").toLowerCase().includes(query.trim().toLowerCase()))
    : (options || []);

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    if (!open) setQuery("");
  }, [open, showSearch]);

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

  const display = localSelected.length === 0 ? "" : localSelected.join(separator);
  const empty = !display;

  const popupContentWidth = (options || []).reduce(
    (a, opt) => Math.max(a, Math.ceil(_measure(opt))),
    0,
  ) + 16 + 8 + 20 + 14;

  const triggerStyle = dropdownTrigger({ disabled, empty, wrap: true });
  const labelStyle = maxHeight != null ? {
    display: "block",
    maxHeight,
    overflowY: "auto",
    paddingRight: 4,
  } : null;

  return <div ref={wrapRef} style={{ position: "relative", width: "100%" }} title={title}>
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (!disabled) setOpen(o => !o); }}
      style={triggerStyle}
    >
      <span style={labelStyle || undefined}>{display || placeholder}</span>
      {!disabled && <span style={dropdownChevron(16)}>▾</span>}
    </button>
    {open && coords && createPortal(
      <div ref={popupRef} style={dropdownPopup({ left: coords.left, top: coords.top, width: Math.max(coords.width, popupContentWidth), maxHeight: 280, padding: "4px 0" })}>
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
        {filteredOptions.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
            {query.trim() ? "Ничего не найдено" : "Нет вариантов"}
          </div>
        ) : filteredOptions.map(opt => {
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
