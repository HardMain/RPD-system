import { useEffect, useState } from "react";
import { T, hdr } from "../styles/index.js";
import { ResizeHandle } from "../hooks/useColumnWidths.jsx";

export function useSort(defaultKey, defaultDir = "asc", storageKey) {
  const [sort, setSort] = useState(() => {
    if (storageKey) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const v = JSON.parse(raw);
          if (v && typeof v.key === "string" && (v.dir === "asc" || v.dir === "desc")) return v;
        }
      } catch {}
    }
    return { key: defaultKey, dir: defaultDir };
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(sort));
    } catch {}
  }, [storageKey, sort]);

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" });
  }

  function sortItems(items, accessors) {
    const acc = accessors && accessors[sort.key];
    if (!acc) return items;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...items].sort((a, b) => {
      const va = acc(a), vb = acc(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), "ru", { numeric: true, sensitivity: "base" }) * dir;
    });
  }

  return { sort, toggleSort, sortItems };
}

export function SortTh({ sortKey, sort, onSort, children, style, align = "center", onResize, width }) {
  const base = { ...hdr, textAlign: align, position: "relative", padding: 0, ...(width != null ? { width } : null), ...style };
  const sortable = sortKey && sort && onSort;
  const active = sortable && sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  const inner = { padding: "10px 12px", paddingRight: onResize ? 18 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: align };
  return <th style={base}>
    <div style={inner}>
      {sortable
        ? <span
            onClick={() => onSort(sortKey)}
            style={{ cursor: "pointer", userSelect: "none", color: active ? T.accent : undefined }}
            title="Кликните для сортировки"
          >{children}{arrow}</span>
        : <>{children}{arrow}</>}
    </div>
    {onResize && <ResizeHandle onMouseDown={onResize} />}
  </th>;
}
