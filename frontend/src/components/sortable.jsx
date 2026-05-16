import { useState } from "react";
import { T, hdr } from "../styles/index.js";

export function useSort(defaultKey, defaultDir = "asc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

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

export function SortTh({ sortKey, sort, onSort, children, style, align = "left" }) {
  const base = { ...hdr, textAlign: align, ...style };
  if (!sortKey || !sort || !onSort) return <th style={base}>{children}</th>;
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return <th
    onClick={() => onSort(sortKey)}
    style={{ ...base, cursor: "pointer", userSelect: "none", color: active ? T.accent : undefined }}
    title="Кликните для сортировки"
  >{children}{arrow}</th>;
}
