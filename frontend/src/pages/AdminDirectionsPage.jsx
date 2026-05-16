import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, hdr, tcell, iconBtn, formErrorBox, adminAddField, adminAddLabel, adminAddBtn, linkBtn, dataTable, adminAddPanel, adminToolbar, adminSearch, sectionLabel, modalTitleHeader, modalFooterWide } from "../styles/index.js";
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
import { TrashIcon, UploadIcon, PencilIcon, PlusIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function DirectionsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [pendingDir, setPendingDir] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListDirections().then(r => setItems(r.data)).catch(() => { if (!silent) setItems([]); }).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function uploadFor(directionId, file) {
    if (!file) return null;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setErrorMsg("Ожидается PDF-файл."); return null; }
    setBusyId(directionId);
    let updated = null;
    try { const res = await api.adminUploadFgos(directionId, file); updated = res.data; reload(); }
    catch (e) { setErrorMsg("Ошибка загрузки: " + (e?.response?.data?.detail || e.message)); }
    setBusyId(null);
    return updated;
  }

  async function detachFgos(d) {
    if (!d) return;
    setBusyId(d.id_direction);
    try {
      await api.adminRemoveFgos(d.id_direction);
      setEditing(prev => (prev && prev.id_direction === d.id_direction ? { ...prev, fgos_file_id: null, fgos_file_name: null } : prev));
      reload();
    }
    catch { setErrorMsg("Не удалось открепить файл ФГОС."); }
    setBusyId(null);
  }

  async function deleteDirection(d) {
    if (!d) return;
    setBusyId(d.id_direction);
    try { await api.adminDeleteDirection(d.id_direction); reload(); }
    catch (e) { setErrorMsg(e?.response?.data?.detail || "Не удалось удалить направление."); }
    setBusyId(null);
  }

  async function handleAdd() {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return;
    setAdding(true);
    try {
      await api.adminCreateDirection({ code, name });
      setNewCode("");
      setNewName("");
      reload();
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || "Не удалось добавить направление.");
    }
    setAdding(false);
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
      const hasProfile = (d.programs || []).length > 0;
      if (profileFilter === "with") return hasProfile;
      if (profileFilter === "without") return !hasProfile;
      return true;
    });
  }, [items, search, profileFilter]);

  const counts = useMemo(() => ({
    all: items.length,
    with: items.filter(d => (d.programs || []).length > 0).length,
    without: items.filter(d => (d.programs || []).length === 0).length,
  }), [items]);

  const { sort, toggleSort, sortItems } = useSort("code", "asc");
  const sorted = useMemo(() => sortItems(filtered, DIR_ACCESSORS), [filtered, sort]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(sorted, { defaultPageSize: 50, storageKey: "adminDirections.pageSize" });

  return <>
    <div style={adminAddPanel}>
      <div style={sectionLabel}>
        Добавить запись
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 160px" }}>
          <div style={adminAddLabel}>Код <span style={{ color: T.red }}>*</span></div>
          <input
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="09.03.04"
            style={adminAddField}
          />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 220 }}>
          <div style={adminAddLabel}>Наименование <span style={{ color: T.red }}>*</span></div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Программная инженерия"
            style={adminAddField}
          />
        </div>
        <Btn small primary onClick={handleAdd} disabled={adding || !newCode.trim() || !newName.trim()} style={adminAddBtn}>
          <PlusIcon /> Добавить
        </Btn>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", marginTop: 8 }}>
        Направления также подтягиваются автоматически при импорте БУПов. Профили и файл ФГОС добавляются в редактировании записи.
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
        <FilterChip label="Все" count={counts.all} active={profileFilter === "all"} onClick={() => setProfileFilter("all")} />
        <FilterChip label="С профилем" count={counts.with} active={profileFilter === "with"} onClick={() => setProfileFilter(prev => prev === "with" ? "all" : "with")} />
        <FilterChip label="Без профиля" count={counts.without} active={profileFilter === "without"} onClick={() => setProfileFilter(prev => prev === "without" ? "all" : "without")} />
      </div>
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filtered.length} {filtered.length === items.length ? "" : `из ${items.length}`}
      </span>
    </div>

    <div className="table-scroll">
      {loading
        ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : filtered.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>{items.length === 0 ? "Направлений нет — добавьте первое сверху или импортируйте БУП." : "Ничего не нашлось."}</div>
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
                      ? <button onClick={e => { e.stopPropagation(); api.openFile(d.fgos_file_id).catch(() => setErrorMsg("Не удалось открыть файл.")); }} style={linkBtn}>{d.fgos_file_name}</button>
                      : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не загружен</span>}
                  </td>
                  <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }} onDoubleClick={e => e.stopPropagation()}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(d); }} title="Редактировать" style={{ ...iconBtn, cursor: "pointer", color: T.textMuted }} disabled={busy}><PencilIcon /></button>
                      <button onClick={(e) => { e.stopPropagation(); setPendingDir(d); }} title="Удалить направление" style={{ ...iconBtn, cursor: "pointer" }} disabled={busy}><TrashIcon /></button>
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
      onUpload={async (file) => { const upd = await uploadFor(editing.id_direction, file); if (upd) setEditing(upd); }}
      onDetach={() => detachFgos(editing)}
      onDelete={() => { setPendingDir(editing); setEditing(null); }}
      onSaved={() => { setEditing(null); reload(); }}
      onChanged={reload}
      onError={setErrorMsg}
    />}
    {pendingDir && <ConfirmDeleteModal
      title="Удалить направление?"
      message={`Направление «${pendingDir.code} ${pendingDir.name}» будет удалено вместе со всеми его профилями${pendingDir.fgos_file_id ? " и прикреплённым файлом ФГОС" : ""}. Это действие необратимо.`}
      confirmLabel="Удалить"
      onClose={() => setPendingDir(null)}
      onConfirm={async () => { const d = pendingDir; setPendingDir(null); await deleteDirection(d); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function DirectionEditModal({ direction, busy, onClose, onUpload, onDetach, onDelete, onSaved, onChanged, onError }) {
  const fileRef = useRef(null);
  const [code, setCode] = useState(direction.code || "");
  const [name, setName] = useState(direction.name || "");
  const [programs, setPrograms] = useState(direction.programs || []);
  const [newProgram, setNewProgram] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [pendingProgram, setPendingProgram] = useState(null);

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

  return <>
    <Modal width={560} onClose={onClose}>
    <div style={modalTitleHeader}>
      Направление подготовки
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={adminAddLabel}>Код <span style={{ color: T.red }}>*</span></div>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="09.03.04" style={adminAddField} />
      </div>
      <div>
        <div style={adminAddLabel}>Наименование <span style={{ color: T.red }}>*</span></div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Программная инженерия" style={adminAddField} />
      </div>
      <div>
        <div style={adminAddLabel}>Профили (образовательные программы)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {programs.length === 0 && (
            <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
              Профилей пока нет — добавьте ниже или они подтянутся из БУПов.
            </div>
          )}
          {programs.map(p => (
            <ProgramRow key={p.id_program} program={p} onRename={renameProgram} onDelete={setPendingProgram} />
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newProgram}
              onChange={e => setNewProgram(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addProgram(); }}
              placeholder="Новый профиль…"
              style={{ ...adminAddField, flex: 1 }}
            />
            <Btn small primary onClick={addProgram} disabled={!newProgram.trim()}>Добавить</Btn>
          </div>
        </div>
      </div>
      <div>
        <div style={adminAddLabel}>Файл ФГОС</div>
        <div style={{ padding: "10px 12px", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.bg }}>
          {direction.fgos_file_id
            ? <button onClick={() => api.openFile(direction.fgos_file_id).catch(() => onError && onError("Не удалось открыть файл."))} style={{ ...linkBtn, fontSize: 13 }}>
                {direction.fgos_file_name || "файл.pdf"}
              </button>
            : <span style={{ color: T.textMuted, fontStyle: "italic", fontSize: 13 }}>Файл не загружен</span>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePick} />
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small onClick={() => fileRef.current?.click()} disabled={busy}>
          <UploadIcon /> {direction.fgos_file_id ? "Заменить файл ФГОС" : "Загрузить файл ФГОС"}
        </Btn>
        {direction.fgos_file_id && (
          <Btn small danger onClick={onDetach} disabled={busy}>
            Открепить ФГОС
          </Btn>
        )}
      </div>
      {err && <div style={formErrorBox}>{err}</div>}
    </div>
    <div style={modalFooterWide("space-between")}>
      <Btn danger onClick={onDelete} disabled={busy}>
        Удалить направление
      </Btn>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn primary onClick={save} disabled={saving || busy}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
        <Btn onClick={onClose}>Закрыть</Btn>
      </div>
    </div>
    </Modal>
    {pendingProgram && <ConfirmDeleteModal
      title="Удалить профиль?"
      message={`Профиль «${pendingProgram.profile}» будет удалён из направления «${direction.code} ${direction.name}».`}
      confirmLabel="Удалить"
      onClose={() => setPendingProgram(null)}
      onConfirm={async () => { const p = pendingProgram; setPendingProgram(null); await deleteProgram(p.id_program); }}
    />}
  </>;
}


function ProgramRow({ program, onRename, onDelete }) {
  const [v, setV] = useState(program.profile || "");
  useEffect(() => { setV(program.profile || ""); }, [program.profile]);
  return <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if (t && t !== (program.profile || "")) onRename(program.id_program, t); }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={{ ...adminAddField, flex: 1 }}
    />
    <button onClick={() => onDelete(program)} title="Удалить профиль" style={{ ...iconBtn, cursor: "pointer" }}><TrashIcon /></button>
  </div>;
}
