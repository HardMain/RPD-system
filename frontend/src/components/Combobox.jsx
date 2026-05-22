import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, dropdownPopup, dropdownItem } from "../styles/index.js";
import { useDropdownAnchor } from "../hooks/useDropdownAnchor.js";
import { ExpandableTextarea } from "./ExpandableTextarea.jsx";

export function Combobox({
  value,
  onCommit,
  fetchSuggestions,
  placeholder,
  textarea = false,
  collapsedMaxHeight = 70,
  style,
  title,
  resetKey,
}) {
  const [local, setLocal] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const lastSyncedRef = useRef(value || "");
  const debRef = useRef(null);

  const coords = useDropdownAnchor(wrapRef, open, { observeResize: true });

  useEffect(() => {
    const next = value || "";
    if (local === lastSyncedRef.current) setLocal(next);
    lastSyncedRef.current = next;
  }, [value]);

  useEffect(() => { setItems([]); }, [resetKey]);

  useEffect(() => { if (!open) setItems([]); }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const arr = await fetchSuggestions(local);
        const cur = (local || "").trim().toLowerCase();
        const filtered = (arr || []).filter(s => (s || "").toLowerCase() !== cur).slice(0, 50);
        setItems(filtered);
      } catch { setItems([]); }
    }, 150);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [open, local, resetKey]);


  function commitIfChanged(v) {
    if (v !== (value || "")) onCommit(v);
  }
  function handleBlur() {
    setOpen(false);
    commitIfChanged(local);
  }
  function pick(s) {
    setLocal(s);
    setOpen(false);
    commitIfChanged(s);
  }

  const sharedProps = {
    value: local,
    onChange: (e) => { setLocal(e.target.value); if (!open) setOpen(true); },
    onFocus: () => setOpen(true),
    onBlur: handleBlur,
    placeholder,
    title,
    style,
  };

  return <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
    {textarea
      ? <ExpandableTextarea {...sharedProps} collapsedMaxHeight={collapsedMaxHeight} />
      : <input type="text" {...sharedProps} />}
    {open && coords && items.length > 0 && createPortal(
      <div ref={popupRef} style={dropdownPopup({ left: coords.left, top: coords.top, width: coords.width, maxHeight: 240 })}>
        {items.map((s, i) => (
          <button key={i} type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s)}
            style={dropdownItem({ padding: "7px 10px", lineHeight: 1.35, borderBottom: i < items.length - 1 })}
            onMouseEnter={e => e.currentTarget.style.background = T.bg}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {s}
          </button>
        ))}
      </div>,
      document.body,
    )}
  </div>;
}
