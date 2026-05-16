import { useRef, useState } from "react";
import { T, F, dropdownChevron, dropdownItem } from "../../styles/index.js";
import { useDismiss } from "../../hooks/useDismiss.js";

export function BupDropdown({ bds, value, onChange, compact = false, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useDismiss(open, () => setOpen(false), [ref]);

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
      <span style={dropdownChevron(compact ? 14 : 16)}>▾</span>
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
            style={dropdownItem({ picked, fontSize })}
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
