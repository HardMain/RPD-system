import { useEffect, useMemo, useState } from "react";
import { T, F } from "../styles/index.js";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100, 200];

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

  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 4px", fontSize: 12, fontFamily: F, flexWrap: "wrap" }}>
    <span style={{ color: T.textMuted }}>
      {total === 0
        ? <>Записей нет</>
        : <>Показано <b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{from}–{to}</b> из <b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{total}</b></>}
    </span>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <PgBtn onClick={() => onPageChange(1)} disabled={page <= 1} title="Первая страница">«</PgBtn>
      <PgBtn onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Предыдущая">‹</PgBtn>
      {pageButtons(page, totalPages).map((p, i) =>
        p === "…"
          ? <span key={`gap-${i}`} style={{ padding: "0 4px", color: T.textMuted }}>…</span>
          : <PgBtn key={p} onClick={() => onPageChange(p)} active={p === page}>{p}</PgBtn>
      )}
      <PgBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Следующая">›</PgBtn>
      <PgBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Последняя страница">»</PgBtn>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textMuted }}>
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
      minWidth: 28, height: 26, padding: "0 8px",
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
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out = [];
  out.push(1);
  if (page > 3) out.push("…");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (page < totalPages - 2) out.push("…");
  out.push(totalPages);
  return out;
}
