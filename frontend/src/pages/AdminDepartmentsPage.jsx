import { useEffect, useMemo, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { useSort, SortTh } from "../components/sortable.jsx";

const DEPT_ACCESSORS = {
  name: d => d.name || "",
  faculty: d => d.faculty || "",
  usage: d => (d.users_count || 0) + (d.bup_disciplines_count || 0),
};
import { TrashIcon, PencilIcon, PlusIcon } from "../components/icons.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function DepartmentsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newFaculty, setNewFaculty] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [facultyOptions, setFacultyOptions] = useState([]);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListDepartments()
      .then(r => setItems(r.data || []))
      .catch(() => { if (!silent) setItems([]); })
      .finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  useEffect(() => {
    api.adminListDictionary("faculty", {})
      .then(r => setFacultyOptions((r.data || []).map(e => ({ value: e.value, label: e.value }))))
      .catch(() => setFacultyOptions([]));
  }, []);

  async function handleAdd() {
    const name = newName.trim();
    const fac = newFaculty.trim();
    if (!name) { setAddErr("Название обязательно"); return; }
    if (!fac) { setAddErr("Факультет обязателен"); return; }
    setAddErr("");
    setAdding(true);
    try {
      await api.adminCreateDepartment({ name, faculty: fac });
      setNewName("");
      setNewFaculty("");
      reload();
    } catch (e) {
      setAddErr("Не удалось добавить: " + (e?.response?.data?.detail || e.message));
    }
    setAdding(false);
  }

  async function performDelete(d) {
    if (!d) return;
    try { await api.adminDeleteDepartment(d.id_department); reload(); }
    catch (e) { setErrorMsg("Не удалось удалить: " + (e?.response?.data?.detail || e.message)); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(d =>
      (d.name || "").toLowerCase().includes(q)
      || (d.faculty || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const { sort, toggleSort, sortItems } = useSort("name", "asc");
  const sorted = useMemo(() => sortItems(filtered, DEPT_ACCESSORS), [filtered, sort]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(sorted, { defaultPageSize: 50, storageKey: "adminDepartments.pageSize" });

  const miniLabel = { fontSize: 11, color: T.textMuted, marginBottom: 3 };
  const addInput = { width: "100%", height: 32, padding: "0 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" };

  return <>
    <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        Добавить запись
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <div style={miniLabel}>Название <span style={{ color: T.red }}>*</span></div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Кафедра / отдел / управление…"
            style={addInput}
          />
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <div style={miniLabel}>Факультет <span style={{ color: T.red }}>*</span></div>
          <Dropdown
            value={newFaculty}
            options={facultyOptions}
            onChange={setNewFaculty}
            placeholder="— не указано —"
            clearLabel="— не указано —"
          />
        </div>
        <Btn small primary onClick={handleAdd} disabled={adding || !newName.trim() || !newFaculty.trim()} style={{ height: 32 }}>
          <PlusIcon /> Добавить
        </Btn>
      </div>
      {addErr && <div style={{ marginTop: 6, fontSize: 12, color: T.red }}>{addErr}</div>}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по названию или факультету…"
        style={{
          flex: 1, minWidth: 220, maxWidth: 360,
          padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4,
          fontSize: 13, fontFamily: F, outline: "none",
        }}
      />
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filtered.length} {filtered.length === items.length ? "" : `из ${items.length}`}
      </span>
    </div>

    <div className="table-scroll">
      {loading
        ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : filtered.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
              {items.length === 0 ? "Подразделений пока нет." : "Ничего не нашлось."}
            </div>
          : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F, tableLayout: "fixed" }}>
            <thead><tr style={{ background: T.surface }}>
              <SortTh sortKey="name" sort={sort} onSort={toggleSort}>Название</SortTh>
              <SortTh sortKey="faculty" sort={sort} onSort={toggleSort} style={{ width: 300 }}>Факультет</SortTh>
              <SortTh sortKey="usage" sort={sort} onSort={toggleSort} style={{ width: 160 }}>Использование</SortTh>
              <th style={{ ...hdr, textAlign: "center", width: 80 }} />
            </tr></thead>
            <tbody>
              {pageItems.map(d => (
                <tr key={d.id_department}
                    onDoubleClick={() => setEditing({ ...d })}
                    style={{ background: T.surface, cursor: "pointer" }}
                    title="Двойной клик — редактировать">
                  <td style={{ ...tcell, fontWeight: 600 }}>{d.name}</td>
                  <td style={{ ...tcell, color: d.faculty ? T.text : T.textMuted, fontStyle: d.faculty ? "normal" : "italic" }}>{d.faculty || "—"}</td>
                  <td style={{ ...tcell, fontSize: 11, color: T.textMuted }}>
                    <UsageInfo users={d.users_count} bupDisciplines={d.bup_disciplines_count} />
                  </td>
                  <td style={{ ...tcell, textAlign: "center", padding: "8px 4px", whiteSpace: "nowrap" }} onDoubleClick={e => e.stopPropagation()}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing({ ...d }); }} title="Редактировать"
                        style={{ ...iconBtn, cursor: "pointer", color: T.textMuted }}><PencilIcon /></button>
                      <button onClick={(e) => { e.stopPropagation(); setPendingDelete(d); }} title="Удалить"
                        style={{ ...iconBtn, cursor: "pointer" }}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
    </div>
    {!loading && (
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={setPageSize} />
    )}

    {editing && <DepartmentEditModal
      data={editing}
      facultyOptions={facultyOptions}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); reload(); }}
      onError={setErrorMsg}
    />}
    {pendingDelete && <ConfirmDeleteModal
      title={`Удалить подразделение «${pendingDelete.name}»?`}
      message={pendingDelete.users_count
        ? `К подразделению привязано ${pendingDelete.users_count} пользователь(ей). Сначала перенесите их в другое подразделение.`
        : pendingDelete.bup_disciplines_count
          ? `Подразделение будет удалено навсегда. У ${pendingDelete.bup_disciplines_count} дисциплин(ы) в БУПах сбросится кафедра — на содержание РПД это не повлияет.`
          : `Подразделение будет удалено навсегда. Восстановить его можно будет только повторным созданием.`}
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performDelete(d); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function UsageInfo({ users, bupDisciplines }) {
  if (!users && !bupDisciplines) {
    return <span style={{ fontStyle: "italic" }}>Не используется</span>;
  }
  const parts = [];
  if (users) parts.push(`${users} пользовател${users === 1 ? "ь" : "ей"}`);
  if (bupDisciplines) parts.push(`${bupDisciplines} дисциплин в БУПах`);
  return <span>{parts.join(" · ")}</span>;
}

function DepartmentEditModal({ data, facultyOptions, onClose, onSaved, onError }) {
  const [name, setName] = useState(data.name || "");
  const [faculty, setFaculty] = useState(data.faculty || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Название обязательно"); return; }
    if (!faculty.trim()) { setErr("Факультет обязателен"); return; }
    setErr("");
    setSaving(true);
    try {
      await api.adminUpdateDepartment(data.id_department, { name: name.trim(), faculty: faculty.trim() });
      onSaved();
    } catch (e) {
      const msg = "Не удалось сохранить: " + (e?.response?.data?.detail || e.message);
      setErr(msg);
      onError && onError(msg);
    }
    setSaving(false);
  }

  return <Modal width={520} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      Редактирование подразделения
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Input required label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Кафедра / отдел / управление…" />
      <div>
        <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Факультет <span style={{ color: T.red }}>*</span></label>
        <Dropdown
          value={faculty}
          options={facultyOptions}
          onChange={setFaculty}
          placeholder="— не указано —"
          clearLabel="— не указано —"
        />
      </div>
      {err && <div style={{ background: "#fde6e3", color: T.red, padding: "8px 12px", borderRadius: 6, fontSize: 13 }}>{err}</div>}
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
      <Btn onClick={onClose}>Отмена</Btn>
    </div>
  </Modal>;
}
