import { useEffect, useMemo, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { TrashIcon, PencilIcon, PlusIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function DepartmentsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState("");

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListDepartments()
      .then(r => setItems(r.data || []))
      .catch(() => { if (!silent) setItems([]); })
      .finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

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

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(filtered, { defaultPageSize: 50, storageKey: "adminDepartments.pageSize" });

  return <>
    <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        Добавить запись
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
          Подразделения и факультеты, к которым привязаны пользователи и кафедры.
        </div>
        <Btn small primary onClick={() => setEditing({ create: true })}><PlusIcon /> Создать подразделение</Btn>
      </div>
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
          : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
            <thead><tr style={{ background: T.surface }}>
              <th style={hdr}>Название</th>
              <th style={hdr}>Факультет</th>
              <th style={{ ...hdr, width: 160 }}>Использование</th>
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

function DepartmentEditModal({ data, onClose, onSaved, onError }) {
  const isCreate = !!data.create;
  const [name, setName] = useState(isCreate ? "" : (data.name || ""));
  const [faculty, setFaculty] = useState(isCreate ? "" : (data.faculty || ""));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Название обязательно"); return; }
    setErr("");
    setSaving(true);
    try {
      const payload = { name: name.trim(), faculty: faculty.trim() || null };
      if (isCreate) await api.adminCreateDepartment(payload);
      else await api.adminUpdateDepartment(data.id_department, payload);
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
      {isCreate ? "Новое подразделение" : "Редактирование подразделения"}
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Input label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Кафедра / отдел / управление…" />
      <Input label="Факультет" value={faculty} onChange={e => setFaculty(e.target.value)} placeholder="Электротехнический факультет (можно оставить пустым)" />
      {err && <div style={{ background: "#fde6e3", color: T.red, padding: "8px 12px", borderRadius: 6, fontSize: 13 }}>{err}</div>}
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
      <Btn onClick={onClose}>Отмена</Btn>
    </div>
  </Modal>;
}
