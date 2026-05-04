import { useEffect, useRef, useState } from "react";
import { T, F } from "../../theme.js";

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

  const fontSize = compact ? 12 : 13;

  const buttonStyle = compact
    ? { padding: "4px 28px 4px 12px", fontWeight: 600, borderRadius: 5 }
    : { padding: "6px 26px 6px 10px", borderRadius: 4 };

  return <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }} title={title}>
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      style={{
        width: "100%",
        textAlign: "left",
        ...buttonStyle,
        border: "1px solid " + T.border,
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
