import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T, F } from "../theme.js";
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
}) {
  const [local, setLocal] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const lastSyncedRef = useRef(value || "");
  const debRef = useRef(null);

  useEffect(() => {
    const next = value || "";
    if (local === lastSyncedRef.current) setLocal(next);
    lastSyncedRef.current = next;
  }, [value]);

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
  }, [open, local]);

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return; }
    const el = wrapRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      setCoords({ left: r.left, top: r.bottom + 2, width: r.width });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

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
      <div ref={popupRef} style={{
        position: "fixed", left: coords.left, top: coords.top, width: coords.width,
        background: T.surface, border: "1px solid " + T.border, borderRadius: 4,
        boxShadow: "0 6px 20px rgba(0,0,0,.14)", zIndex: 1100, maxHeight: 240, overflowY: "auto",
      }}>
        {items.map((s, i) => (
          <button key={i} type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "7px 10px", border: "none",
              borderBottom: i < items.length - 1 ? "1px solid " + T.borderLight : "none",
              background: "transparent", cursor: "pointer", fontFamily: F, fontSize: 13,
              color: T.text, lineHeight: 1.35, whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word",
            }}
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
