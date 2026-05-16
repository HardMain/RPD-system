import { useEffect, useMemo, useState } from "react";
import { T, F, hdr, tcell, iconBtn, pageContainer, pageToolbar, pageScroll, dataTable, toolbarSearch } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { FilterChip } from "../components/FilterChip.jsx";
import { PlusIcon, DownloadIcon, EyeIcon, PencilIcon } from "../components/icons.jsx";
import { STATUSES, StatusBadge } from "../components/StatusBadge.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { userCan } from "../api/client.js";

const COLS = [
  { key: "direction_code", label: "Направление", align: "left", sortable: true, accessor: r => r.direction_code || "" },
  { key: "discipline_name", label: "Дисциплина", align: "left", sortable: true, accessor: r => r.discipline_name || "" },
  { key: "academic_year", label: "Год", align: "center", sortable: true, accessor: r => r.academic_year || "" },
  { key: "total_hours", label: "Часы", align: "center", sortable: true, accessor: r => r.total_hours ?? 0 },
  { key: "semester", label: "Семестр", align: "center", sortable: true, accessor: r => r.semester || "" },
  { key: "developer", label: "Разработчик", align: "left", sortable: true, accessor: r => (r.developer_names && r.developer_names[0]) || "" },
  { key: "comment", label: "Комментарий", align: "left", sortable: true, accessor: r => r.comment || "" },
  { key: "status", label: "Статус", align: "left", sortable: true, accessor: r => r.status || "" },
  { key: "actions", label: "", align: "center", sortable: false },
];

const FILTER_STATE_KEY = "rpdListPage.filter.v1";

function loadFilterState() {
  try {
    const raw = sessionStorage.getItem(FILTER_STATE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch { return null; }
}

export function RpdListPage({ rpds, onOpen, onEdit, onCreate, onExportPdf, user }) {
  const canCreate = userCan(user, "rpd.create");
  const canReview = userCan(user, "rpd.approve");
  const myReviewIds = useMemo(() => {
    if (!canReview || !user) return null;
    const set = new Set();
    for (const r of rpds) {
      if (r.status === "На согласовании" && r.current_reviewer_id === user.id_user) set.add(r.id_rpd);
    }
    return set;
  }, [rpds, canReview, user]);

  const initial = loadFilterState();
  const [query, setQuery] = useState(initial?.query ?? "");
  const [statusFilter, setStatusFilter] = useState(initial?.statusFilter ?? "all");
  const [sort, setSort] = useState(initial?.sort ?? { key: "discipline_name", dir: "asc" });

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify({ query, statusFilter, sort }));
    } catch {}
  }, [query, statusFilter, sort]);

  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rpds;
    return rpds.filter(r =>
      (r.discipline_name || "").toLowerCase().includes(q) ||
      (r.direction_code || "").toLowerCase().includes(q) ||
      (r.direction_name || "").toLowerCase().includes(q) ||
      (r.academic_year || "").toLowerCase().includes(q) ||
      (r.author_name || "").toLowerCase().includes(q)
    );
  }, [rpds, query]);

  const statusCounts = useMemo(() => {
    const counts = { all: queryFiltered.length, mine_to_review: 0 };
    for (const s of STATUSES) counts[s.value] = 0;
    for (const r of queryFiltered) {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
      if (myReviewIds && myReviewIds.has(r.id_rpd)) counts.mine_to_review += 1;
    }
    return counts;
  }, [queryFiltered, myReviewIds]);

  const filteredSorted = useMemo(() => {
    let list = queryFiltered;
    if (statusFilter === "mine_to_review") list = list.filter(r => myReviewIds && myReviewIds.has(r.id_rpd));
    else if (statusFilter !== "all") list = list.filter(r => r.status === statusFilter);
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
  }, [queryFiltered, statusFilter, sort, myReviewIds]);

  function toggleSort(colKey) {
    setSort(prev => prev.key === colKey
      ? { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key: colKey, dir: "asc" });
  }

  const isFiltered = !!query || statusFilter !== "all";

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(filteredSorted, { defaultPageSize: 50, storageKey: "rpdList.pageSize" });

  return <div style={pageContainer}>
    <div style={pageToolbar}>
      {canCreate ? <Btn small onClick={onCreate}><PlusIcon /> Создать РПД</Btn> : null}
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Поиск: дисциплина, направление, год, автор"
        style={toolbarSearch}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <FilterChip label="Все" count={statusCounts.all} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {STATUSES.map(s => {
          const chip = (
            <FilterChip
              key={s.value}
              label={s.value}
              count={statusCounts[s.value] || 0}
              active={statusFilter === s.value}
              color={s.color}
              bg={s.bg}
              onClick={() => setStatusFilter(prev => prev === s.value ? "all" : s.value)}
            />
          );
          if (s.value === "Согласовано" && canReview) {
            return [
              <FilterChip
                key="mine_to_review"
                label="Согласование"
                count={statusCounts.mine_to_review}
                active={statusFilter === "mine_to_review"}
                color={T.orange}
                bg={T.orangeLight}
                onClick={() => setStatusFilter(prev => prev === "mine_to_review" ? "all" : "mine_to_review")}
              />,
              chip,
            ];
          }
          return chip;
        })}
      </div>
      {isFiltered && (
        <button
          onClick={() => { setQuery(""); setStatusFilter("all"); }}
          style={{ border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 12, fontFamily: F, textDecoration: "underline" }}
          title="Сбросить поиск и фильтр статуса"
        >Сбросить</button>
      )}
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filteredSorted.length} {filteredSorted.length === rpds.length ? "РПД" : `из ${rpds.length}`}
      </span>
    </div>
    <div style={pageScroll}>
      <div className="table-scroll">
      <table style={dataTable}>
        <thead>
          <tr style={{ background: T.surface }}>
            {COLS.map((c) => {
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
              {rpds.length === 0 ? "Нет РПД" : "Ничего не найдено по текущим фильтрам"}
            </td></tr>
          )}
          {pageItems.map(r => {
            const canEdit = r.status === "Черновик" || r.status === "На доработке";
            const openByDblClick = (e) => {
              if (e.ctrlKey) onOpen(r);
              else if (canEdit) onEdit(r);
              else onOpen(r);
            };
            const openInBackground = (e) => {
              if (e.ctrlKey) onOpen(r, { skipFocus: true });
              else if (canEdit) onEdit(r, { skipFocus: true });
              else onOpen(r, { skipFocus: true });
            };
            return <tr key={r.id_rpd}
              onDoubleClick={openByDblClick}
              onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); openInBackground(e); } }}
              style={{ background: T.surface, cursor: "pointer" }}
              title="Двойной клик — редактор · Ctrl+двойной клик — просмотр · Колесико — фоновая вкладка (редактор) · Ctrl+колесико — фоновая (просмотр)"
            >
              <td style={{ ...tcell, color: r.direction_code ? T.text : T.textMuted }}>{r.direction_code || "—"}</td>
              <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
              <td style={{ ...tcell, textAlign: "center", color: r.academic_year ? T.text : T.textMuted }}>{r.academic_year || "—"}</td>
              <td style={{ ...tcell, textAlign: "center", color: r.total_hours ? T.text : T.textMuted }}>{r.total_hours || "—"}</td>
              <td style={{ ...tcell, textAlign: "center", color: r.semester ? T.text : T.textMuted }}>{r.semester || "—"}</td>
              <td style={{ ...tcell, color: (r.developer_names && r.developer_names.length) ? T.text : T.textMuted }}>
                {(r.developer_names && r.developer_names.length) ? r.developer_names.join(", ") : "—"}
              </td>
              <td style={{ ...tcell, color: r.comment ? T.text : T.textMuted, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.comment || ""}>
                {r.comment || "—"}
              </td>
              <td style={tcell}><StatusBadge status={r.status} /></td>
              <td style={{ ...tcell, textAlign: "center", width: 1, whiteSpace: "nowrap", padding: "10px 8px" }}>
                <div style={{ display: "inline-flex", gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); onOpen(r); }} title="Просмотр" style={{ ...iconBtn, cursor: "pointer" }}><EyeIcon /></button>
                  <button onClick={canEdit ? (e => { e.stopPropagation(); onEdit(r); }) : undefined} disabled={!canEdit} title={canEdit ? "Редактировать" : "Нельзя редактировать в текущем статусе"} style={{ ...iconBtn, cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.35 }}><PencilIcon /></button>
                  <button onClick={e => { e.stopPropagation(); onExportPdf(r.id_rpd); }} title="Скачать PDF" style={{ ...iconBtn, cursor: "pointer" }}><DownloadIcon /></button>
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  </div>;
}
