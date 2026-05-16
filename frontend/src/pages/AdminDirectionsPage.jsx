import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F, hdr, tcell, iconBtn, formErrorBox, dataTable, adminAddPanel, adminToolbar, adminSearch, sectionLabel, modalTitleHeader, modalFooterWide } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { FilterChip } from "../components/FilterChip.jsx";
import { Modal } from "../components/Modal.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { useSort, SortTh } from "../components/sortable.jsx";

const DIR_ACCESSORS = {
  code: d => d.code || "",
  name: d => d.name || "",
  programs: d => (d.programs || []).map(p => p.profile).join(", "),
  fgos: d => d.fgos_file_name || "",
};
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
          || (d.programs || []).some(p => (p.profile || "").toLowerCase().includes(q));
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

  const { sort, toggleSort, sortItems } = useSort("code", "asc");
  const sorted = useMemo(() => sortItems(filtered, DIR_ACCESSORS), [filtered, sort]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(sorted, { defaultPageSize: 50, storageKey: "adminDirections.pageSize" });

  return <>
    <div style={adminAddPanel}>
      <div style={sectionLabel}>
        Добавить запись
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
        Направления подтягиваются автоматически при импорте БУПов. Здесь к каждому можно прикрепить PDF-файл ФГОС.
      </div>
    </div>

    <div style={adminToolbar}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по коду, названию, профилю…"
        style={adminSearch(360)}
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
          : <table style={{ ...dataTable, tableLayout: "fixed" }}>
            <thead><tr style={{ background: T.surface }}>
              <SortTh sortKey="code" sort={sort} onSort={toggleSort} style={{ width: 130 }}>Код</SortTh>
              <SortTh sortKey="name" sort={sort} onSort={toggleSort}>Наименование</SortTh>
              <SortTh sortKey="programs" sort={sort} onSort={toggleSort} style={{ width: 300 }}>Профили</SortTh>
              <SortTh sortKey="fgos" sort={sort} onSort={toggleSort} style={{ width: 220 }}>Файл ФГОС</SortTh>
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
                  <td style={tcell}>
                    {(d.programs && d.programs.length)
                      ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {d.programs.map(p => (
                            <span key={p.id_program} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: T.bg, color: T.text, border: "1px solid " + T.borderLight }}>{p.profile}</span>
                          ))}
                        </div>
                      : <span style={{ color: T.textMuted, fontStyle: "italic" }}>нет профилей</span>}
                  </td>
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
      onSaved={() => { setEditing(null); reload(); }}
      onChanged={reload}
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

function DirectionEditModal({ direction, busy, onClose, onUpload, onDetach, onSaved, onChanged, onError }) {
  const fileRef = useRef(null);
  const [code, setCode] = useState(direction.code || "");
  const [name, setName] = useState(direction.name || "");
  const [programs, setPrograms] = useState(direction.programs || []);
  const [newProgram, setNewProgram] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError && onError("Ожидается PDF-файл.");
      return;
    }
    onUpload(file);
  }

  async function save() {
    if (!code.trim()) { setErr("Код обязателен"); return; }
    if (!name.trim()) { setErr("Название обязательно"); return; }
    setErr("");
    setSaving(true);
    try {
      await api.adminUpdateDirection(direction.id_direction, {
        code: code.trim(), name: name.trim(),
      });
      onSaved();
    } catch (e) {
      const msg = "Не удалось сохранить: " + (e?.response?.data?.detail || e.message);
      setErr(msg);
      onError && onError(msg);
    }
    setSaving(false);
  }

  async function addProgram() {
    const v = newProgram.trim();
    if (!v) return;
    try {
      const r = await api.adminAddDirectionProgram(direction.id_direction, { profile: v });
      setPrograms(r.data.programs || []);
      setNewProgram("");
      setErr("");
      onChanged && onChanged();
    } catch (e) {
      setErr("Не удалось добавить профиль: " + (e?.response?.data?.detail || e.message));
    }
  }

  async function renameProgram(programId, value) {
    const v = value.trim();
    if (!v) return;
    try {
      const r = await api.adminUpdateDirectionProgram(programId, { profile: v });
      setPrograms(r.data.programs || []);
      setErr("");
      onChanged && onChanged();
    } catch (e) {
      setErr("Не удалось переименовать профиль: " + (e?.response?.data?.detail || e.message));
    }
  }

  async function deleteProgram(programId) {
    try {
      const r = await api.adminDeleteDirectionProgram(programId);
      setPrograms(r.data.programs || []);
      setErr("");
      onChanged && onChanged();
    } catch (e) {
      setErr("Не удалось удалить профиль: " + (e?.response?.data?.detail || e.message));
    }
  }

  return <Modal width={560} onClose={onClose}>
    <div style={modalTitleHeader}>
      Направление подготовки
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={miniLabel}>Код <span style={{ color: T.red }}>*</span></div>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="09.03.04" style={dirField} />
      </div>
      <div>
        <div style={miniLabel}>Наименование <span style={{ color: T.red }}>*</span></div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Программная инженерия" style={dirField} />
      </div>
      <div>
        <div style={miniLabel}>Профили (образовательные программы)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {programs.length === 0 && (
            <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
              Профилей пока нет — добавьте ниже или они подтянутся из БУПов.
            </div>
          )}
          {programs.map(p => (
            <ProgramRow key={p.id_program} program={p} onRename={renameProgram} onDelete={deleteProgram} />
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newProgram}
              onChange={e => setNewProgram(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addProgram(); }}
              placeholder="Новый профиль…"
              style={{ ...dirField, flex: 1 }}
            />
            <Btn small primary onClick={addProgram} disabled={!newProgram.trim()}>Добавить</Btn>
          </div>
        </div>
      </div>
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
          <UploadIcon /> {direction.fgos_file_id ? "Заменить файл ФГОС" : "Загрузить файл ФГОС"}
        </Btn>
      </div>
      {err && <div style={formErrorBox}>{err}</div>}
    </div>
    <div style={modalFooterWide("space-between")}>
      <Btn danger onClick={onDetach} disabled={!direction.fgos_file_id || busy}>
        Открепить ФГОС
      </Btn>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn primary onClick={save} disabled={saving || busy}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
        <Btn onClick={onClose}>Закрыть</Btn>
      </div>
    </div>
  </Modal>;
}

const miniLabel = { fontSize: 11, color: T.textMuted, marginBottom: 4 };
const dirField = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, boxSizing: "border-box", outline: "none" };

function ProgramRow({ program, onRename, onDelete }) {
  const [v, setV] = useState(program.profile || "");
  useEffect(() => { setV(program.profile || ""); }, [program.profile]);
  return <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if (t && t !== (program.profile || "")) onRename(program.id_program, t); }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={{ ...dirField, flex: 1 }}
    />
    <button onClick={() => onDelete(program.id_program)} title="Удалить профиль" style={{ ...iconBtn, cursor: "pointer" }}><TrashIcon /></button>
  </div>;
}
