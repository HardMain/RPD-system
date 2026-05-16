import { useEffect, useMemo, useState } from "react";
import { T, F } from "../styles/index.js";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100, 200];

const PAGE_CELL = 28;
const PAGE_GAP = 16;
const PAGE_WINDOW = 3;
const numsWidth = (n) => PAGE_CELL * n + 4 * Math.max(0, n - 1);

export function usePagination(items, options = {}) {
  const { defaultPageSize = 50, storageKey } = options;
  const initialSize = (() => {
    if (!storageKey) return defaultPageSize;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : defaultPageSize;
    } catch { return defaultPageSize; }
  })();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialSize);

  const setPageSize = (n) => {
    setPageSizeRaw(n);
    setPage(1);
    if (storageKey) {
      try { sessionStorage.setItem(storageKey, String(n)); } catch {}
    }
  };

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, pageSize, setPageSize, total, totalPages, pageItems };
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = DEFAULT_PAGE_SIZES }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, padding: "10px 4px", fontSize: 12, fontFamily: F }}>
    <span style={{ color: T.textMuted, justifySelf: "start", whiteSpace: "nowrap" }}>
      {total === 0
        ? <>Записей нет</>
        : <>Показано <b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{from}–{to}</b> из <b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{total}</b></>}
    </span>
    <div style={{ display: "flex", alignItems: "center", justifySelf: "center" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <PgBtn onClick={() => onPageChange(1)} disabled={page <= 1} title="Первая страница">«</PgBtn>
        <PgBtn onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Предыдущая">‹</PgBtn>
      </div>
      <div style={{ width: PAGE_GAP, flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 4, width: numsWidth(Math.min(totalPages, PAGE_WINDOW)), justifyContent: "center" }}>
        {pageButtons(page, totalPages).map(p =>
          <PgBtn key={p} onClick={() => onPageChange(p)} active={p === page}>{p}</PgBtn>
        )}
      </div>
      <div style={{ width: PAGE_GAP, flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 4 }}>
        <PgBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Следующая">›</PgBtn>
        <PgBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Последняя страница">»</PgBtn>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMuted, justifySelf: "end", whiteSpace: "nowrap" }}>
      <span>На странице:</span>
      <select value={pageSize} onChange={e => onPageSizeChange(+e.target.value)}
        style={{ padding: "3px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, fontFamily: F, background: T.surface, color: T.text, cursor: "pointer" }}>
        {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  </div>;
}

function PgBtn({ children, onClick, disabled, active, title }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={title}
    style={{
      width: PAGE_CELL, height: 26, padding: 0, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: "1px solid " + (active ? T.accent : T.border),
      borderRadius: 4,
      background: active ? T.accent : (disabled ? T.bg : T.surface),
      color: active ? "#fff" : (disabled ? T.textLight : T.text),
      fontSize: 12, fontWeight: active ? 700 : 500,
      fontFamily: F, fontVariantNumeric: "tabular-nums",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.55 : 1,
    }}>{children}</button>;
}

function pageButtons(page, totalPages) {
  let start = Math.max(1, page - 1);
  const end = Math.min(totalPages, start + (PAGE_WINDOW - 1));
  start = Math.max(1, end - (PAGE_WINDOW - 1));
  const out = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
}
