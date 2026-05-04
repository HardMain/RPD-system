import { useMemo, useState } from "react";
import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";
import { DownloadIcon, EyeIcon } from "../components/icons.jsx";
import { StatusBadge } from "./RpdListPage.jsx";

/* В архиве лежат только согласованные РПД, поэтому фильтра по статусу нет.
   Поиск, сортировка по колонкам и цветной бэйдж статуса — те же, что на
   главной странице, чтобы UI был единообразным. Действия — только просмотр
   и скачивание PDF: редактировать архивную РПД нельзя. */
const COLS = [
  { key: "direction_code", label: "Направление", align: "left", sortable: true, accessor: r => r.direction_code || "" },
  { key: "discipline_name", label: "Дисциплина", align: "left", sortable: true, accessor: r => r.discipline_name || "" },
  { key: "academic_year", label: "Год", align: "center", sortable: true, accessor: r => r.academic_year || "" },
  { key: "total_hours", label: "Часы", align: "center", sortable: true, accessor: r => r.total_hours ?? 0 },
  { key: "semester", label: "Семестр", align: "center", sortable: true, accessor: r => r.semester || "" },
  { key: "author_name", label: "Автор", align: "left", sortable: true, accessor: r => r.author_name || "" },
  { key: "status", label: "Статус", align: "left", sortable: true, accessor: r => r.status || "" },
  { key: "actions", label: "", align: "center", sortable: false },
];

export function ArchivePage({ rpds, onOpen, onExportPdf }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "discipline_name", dir: "asc" });

  const archived = useMemo(() => rpds.filter(r => r.status === "Согласовано"), [rpds]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = !q ? archived : archived.filter(r =>
      (r.discipline_name || "").toLowerCase().includes(q) ||
      (r.direction_code || "").toLowerCase().includes(q) ||
      (r.direction_name || "").toLowerCase().includes(q) ||
      (r.academic_year || "").toLowerCase().includes(q) ||
      (r.author_name || "").toLowerCase().includes(q)
    );
    const col = COLS.find(c => c.key === sort.key);
    if (col && col.accessor) {
      const acc = col.accessor;
      const dir = sort.dir === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => {
        const va = acc(a), vb = acc(b);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), "ru") * dir;
      });
    }
    return list;
  }, [archived, query, sort]);

  function toggleSort(colKey) {
    setSort(prev => prev.key === colKey
      ? { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key: colKey, dir: "asc" });
  }

  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", flexShrink: 0, background: T.surface, borderBottom: "1px solid " + T.border, flexWrap: "wrap" }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Поиск: дисциплина, направление, год, автор"
        style={{
          flex: 1, minWidth: 220, maxWidth: 420,
          padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4,
          background: T.bg, fontSize: 13, fontFamily: F, color: T.text, outline: "none",
        }}
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          style={{ border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 12, fontFamily: F, textDecoration: "underline" }}
          title="Сбросить поиск"
        >Сбросить</button>
      )}
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filteredSorted.length} {filteredSorted.length === archived.length ? "РПД" : `из ${archived.length}`}
      </span>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
        <thead>
          <tr style={{ background: T.surface }}>
            {COLS.map(c => {
              const isActive = sort.key === c.key;
              const arrow = isActive ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
              const baseStyle = { ...hdr, textAlign: c.align, userSelect: "none" };
              if (!c.sortable) return <th key={c.key} style={baseStyle}>{c.label}</th>;
              return <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                style={{ ...baseStyle, cursor: "pointer", color: isActive ? T.accent : undefined }}
                title="Кликните для сортировки"
              >{c.label}{arrow}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {filteredSorted.length === 0 && (
            <tr><td colSpan={COLS.length} style={{ ...tcell, textAlign: "center", color: T.textMuted, fontStyle: "italic", padding: "40px 12px" }}>
              {archived.length === 0 ? "В архиве пусто" : "Ничего не найдено"}
            </td></tr>
          )}
          {filteredSorted.map(r => {
            const iconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 7px", borderRadius: 4, border: "1px solid " + T.border, background: T.surface, color: T.text, fontFamily: F };
            return <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
              <td style={tcell}>{r.direction_code}</td>
              <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
              <td style={{ ...tcell, textAlign: "center" }}>{r.academic_year}</td>
              <td style={{ ...tcell, textAlign: "center" }}>{r.total_hours || "-"}</td>
              <td style={{ ...tcell, textAlign: "center" }}>{r.semester || "-"}</td>
              <td style={tcell}>{r.author_name}</td>
              <td style={tcell}><StatusBadge status={r.status} /></td>
              <td style={{ ...tcell, textAlign: "center", width: 1, whiteSpace: "nowrap", padding: "10px 8px" }}>
                <div style={{ display: "inline-flex", gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); onOpen(r); }} title="Просмотр" style={{ ...iconBtn, cursor: "pointer" }}><EyeIcon /></button>
                  <button onClick={e => { e.stopPropagation(); onExportPdf && onExportPdf(r.id_rpd); }} title="Скачать PDF" style={{ ...iconBtn, cursor: "pointer" }}><DownloadIcon /></button>
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      </div>
    </div>
  </div>;
}
