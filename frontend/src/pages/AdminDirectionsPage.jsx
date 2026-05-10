import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { TrashIcon, UploadIcon, PencilIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function DirectionsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const inputRefs = useRef({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [fgosFilter, setFgosFilter] = useState("all");

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListDirections().then(r => setItems(r.data)).catch(() => { if (!silent) setItems([]); }).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function uploadFor(directionId, file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setErrorMsg("Ожидается PDF-файл."); return; }
    setBusyId(directionId);
    try { await api.adminUploadFgos(directionId, file); reload(); }
    catch (e) { setErrorMsg("Ошибка загрузки: " + (e?.response?.data?.detail || e.message)); }
    setBusyId(null);
  }

  async function performRemove(d) {
    if (!d) return;
    setBusyId(d.id_direction);
    try { await api.adminRemoveFgos(d.id_direction); reload(); }
    catch { setErrorMsg("Не удалось открепить файл ФГОС."); }
    setBusyId(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(d => {
      if (q) {
        const matches = (d.code || "").toLowerCase().includes(q)
          || (d.name || "").toLowerCase().includes(q)
          || (d.profile || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (fgosFilter === "with") return !!d.fgos_file_id;
      if (fgosFilter === "without") return !d.fgos_file_id;
      return true;
    });
  }, [items, search, fgosFilter]);

  const counts = useMemo(() => ({
    all: items.length,
    with: items.filter(d => d.fgos_file_id).length,
    without: items.filter(d => !d.fgos_file_id).length,
  }), [items]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(filtered, { defaultPageSize: 50, storageKey: "adminDirections.pageSize" });

  return <>
    <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        Добавить запись
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
        Направления подтягиваются автоматически при импорте БУПов. Здесь к каждому можно прикрепить PDF-файл ФГОС.
      </div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по коду, названию, профилю…"
        style={{
          flex: 1, minWidth: 220, maxWidth: 360,
          padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4,
          fontSize: 13, fontFamily: F, outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <FilterChip label="Все" count={counts.all} active={fgosFilter === "all"} onClick={() => setFgosFilter("all")} />
        <FilterChip label="С ФГОС" count={counts.with} active={fgosFilter === "with"} onClick={() => setFgosFilter(prev => prev === "with" ? "all" : "with")} />
        <FilterChip label="Без ФГОС" count={counts.without} active={fgosFilter === "without"} onClick={() => setFgosFilter(prev => prev === "without" ? "all" : "without")} />
      </div>
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filtered.length} {filtered.length === items.length ? "" : `из ${items.length}`}
      </span>
    </div>

    <div className="table-scroll">
      {loading
        ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : filtered.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>{items.length === 0 ? "Направлений нет — они подтянутся при импорте БУПов." : "Ничего не нашлось."}</div>
          : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
            <thead><tr style={{ background: T.surface }}>
              <th style={hdr}>Код</th>
              <th style={hdr}>Наименование</th>
              <th style={hdr}>Профиль</th>
              <th style={hdr}>Файл ФГОС</th>
              <th style={{ ...hdr, textAlign: "center", width: 80 }} />
            </tr></thead>
            <tbody>
              {pageItems.map(d => {
                const busy = busyId === d.id_direction;
                return <tr key={d.id_direction}
                    onDoubleClick={() => setEditing(d)}
                    style={{ background: T.surface, cursor: "pointer" }}
                    title="Двойной клик — редактировать">
                  <td style={{ ...tcell, fontWeight: 600 }}>{d.code}</td>
                  <td style={tcell}>{d.name}</td>
                  <td style={{ ...tcell, color: d.profile ? T.text : T.textMuted }}>{d.profile || "—"}</td>
                  <td style={tcell}>
                    {d.fgos_file_id
                      ? <a href={api.fileUrl(d.fgos_file_id)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: T.accent, fontWeight: 600 }}>{d.fgos_file_name}</a>
                      : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не загружен</span>}
                  </td>
                  <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }} onDoubleClick={e => e.stopPropagation()}>
                    <input
                      ref={el => (inputRefs.current[d.id_direction] = el)}
                      type="file" accept="application/pdf" style={{ display: "none" }}
                      onChange={e => { uploadFor(d.id_direction, e.target.files?.[0]); e.target.value = ""; }}
                    />
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(d); }} title="Редактировать" style={{ ...iconBtn, cursor: "pointer", color: T.textMuted }}><PencilIcon /></button>
                      <button onClick={d.fgos_file_id ? (e) => { e.stopPropagation(); setPendingDelete(d); } : undefined} disabled={!d.fgos_file_id} title={d.fgos_file_id ? "Открепить файл ФГОС" : "Файл не загружен"} style={{ ...iconBtn, cursor: d.fgos_file_id ? "pointer" : "not-allowed", opacity: d.fgos_file_id ? 1 : 0.35 }}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>}
    </div>
    {!loading && (
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={setPageSize} />
    )}

    {editing && <DirectionEditModal
      direction={editing}
      busy={busyId === editing.id_direction}
      onClose={() => setEditing(null)}
      onUpload={async (file) => { await uploadFor(editing.id_direction, file); setEditing(null); }}
      onDetach={() => { setPendingDelete(editing); setEditing(null); }}
      onError={setErrorMsg}
    />}
    {pendingDelete && <ConfirmDeleteModal
      title="Открепить файл ФГОС?"
      message={`Файл «${pendingDelete.fgos_file_name || "—"}» будет отвязан от направления «${pendingDelete.code} ${pendingDelete.name}». Сам файл в общем хранилище останется и его можно будет прикрепить заново.`}
      confirmLabel="Открепить"
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performRemove(d); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function DirectionEditModal({ direction, busy, onClose, onUpload, onDetach, onError }) {
  const fileRef = useRef(null);

  function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError && onError("Ожидается PDF-файл.");
      return;
    }
    onUpload(file);
  }

  return <Modal width={520} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      Направление и файл ФГОС
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <ReadOnlyField label="Код" value={direction.code} />
      <ReadOnlyField label="Наименование" value={direction.name} />
      <ReadOnlyField label="Профиль" value={direction.profile || "—"} />
      <div>
        <div style={miniLabel}>Файл ФГОС</div>
        <div style={{ padding: "10px 12px", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.bg }}>
          {direction.fgos_file_id
            ? <a href={api.fileUrl(direction.fgos_file_id)} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600, fontSize: 13 }}>
                {direction.fgos_file_name || "файл.pdf"}
              </a>
            : <span style={{ color: T.textMuted, fontStyle: "italic", fontSize: 13 }}>Файл не загружен</span>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePick} />
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small onClick={() => fileRef.current?.click()} disabled={busy}>
          <UploadIcon /> {direction.fgos_file_id ? "Заменить файл" : "Загрузить файл"}
        </Btn>
      </div>
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "space-between", gap: 10 }}>
      <Btn danger onClick={onDetach} disabled={!direction.fgos_file_id || busy}>
        Открепить ФГОС
      </Btn>
      <Btn onClick={onClose}>Закрыть</Btn>
    </div>
  </Modal>;
}

function ReadOnlyField({ label, value }) {
  return <div>
    <div style={miniLabel}>{label}</div>
    <div style={{ padding: "8px 12px", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.bg, fontSize: 13, color: T.text }}>{value}</div>
  </div>;
}

function FilterChip({ label, count, active, onClick }) {
  return <button
    type="button"
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 12,
      border: "1px solid " + (active ? T.accent : T.border),
      background: active ? T.accentLight : T.surface,
      color: active ? T.accent : T.text,
      fontSize: 12, fontWeight: active ? 700 : 500,
      cursor: "pointer", fontFamily: F,
      whiteSpace: "nowrap",
    }}
  >
    {label}
    <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>({count})</span>
  </button>;
}

const miniLabel = { fontSize: 11, color: T.textMuted, marginBottom: 4 };
