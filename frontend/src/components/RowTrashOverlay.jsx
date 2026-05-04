import { useEffect, useRef, useState } from "react";
import { T } from "../theme.js";
import { TrashIcon } from "./icons.jsx";

export function RowTrashOverlay({ tbodyRef, onDelete, title = "Удалить", right = -30 }) {
  const [rows, setRows] = useState([]);
  const overlayRef = useRef(null);

  useEffect(() => {
    const tbody = tbodyRef.current;
    const overlay = overlayRef.current;
    if (!tbody || !overlay) return;

    const recompute = () => {
      const trs = Array.from(tbody.querySelectorAll(":scope > tr[data-trash-row]"));
      const overlayTop = overlay.getBoundingClientRect().top;
      const next = trs.map(tr => {
        const r = tr.getBoundingClientRect();
        return {
          id: tr.getAttribute("data-trash-id") || "",
          top: r.top - overlayTop + r.height / 2,
        };
      });
      setRows(next);
    };

    recompute();

    const ro = new ResizeObserver(recompute);
    ro.observe(tbody);
    const trs = Array.from(tbody.querySelectorAll(":scope > tr[data-trash-row]"));
    for (const tr of trs) ro.observe(tr);

    const mo = new MutationObserver(recompute);
    mo.observe(tbody, { childList: true, subtree: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });

  return <div ref={overlayRef} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 0, pointerEvents: "none" }}>
    {rows.map(row => (
      <button
        key={row.id}
        type="button"
        onClick={() => onDelete(row.id)}
        title={title}
        style={{
          position: "absolute",
          right,
          top: row.top,
          transform: "translateY(-50%)",
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: 4,
          color: T.textMuted,
          display: "inline-flex",
          pointerEvents: "auto",
        }}
      ><TrashIcon /></button>
    ))}
  </div>;
}
