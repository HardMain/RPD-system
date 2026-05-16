import { useEffect, useMemo, useState } from "react";
import * as api from "../api/client.js";
import { T, hdr, tcell, iconBtn, fieldLabel, formErrorBox, statusBadge, pageContainer, pageToolbar, pageScroll, dataTable, toolbarSearch } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { FilterChip } from "../components/FilterChip.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { PencilIcon, UserOffIcon, PlusIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";
import { useStickyState } from "../hooks/useStickyState.js";

export function AdminUsersPage({ user }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useStickyState("adminUsers.statusFilter.v1", "active");
  const [search, setSearch] = useStickyState("adminUsers.search.v1", "");
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    Promise.all([api.adminListUsers(), api.adminListRoles(), api.adminListDepartments()])
      .then(([u, r, d]) => { setUsers(u.data || []); setRoles(r.data || []); setDepartments(d.data || []); })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function performDeactivate(u) {
    if (!u) return;
    try { await api.adminDeactivateUser(u.id_user); reload(); }
    catch (e) { setErrorMsg("Не удалось деактивировать: " + (e?.response?.data?.detail || e.message)); }
  }
  function handleDeactivate(u) { setPendingDeactivate(u); }

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (q) {
        const matches = (u.full_name || "").toLowerCase().includes(q)
          || (u.login || "").toLowerCase().includes(q)
          || (u.title || "").toLowerCase().includes(q)
          || (u.role || "").toLowerCase().includes(q)
          || (u.department || "").toLowerCase().includes(q)
          || (u.email || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [users, statusFilter, search]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(filtered, { defaultPageSize: 50, storageKey: "adminUsers.pageSize" });

  return <div style={pageContainer}>
    <div style={pageToolbar}>
      <Btn small onClick={() => setEditing({ create: true })}><PlusIcon /> Создать пользователя</Btn>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск: ФИО, логин, должность, роль, подразделение"
        style={toolbarSearch}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <FilterChip label="Все" count={counts.all} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <FilterChip label="Активные" count={counts.active} active={statusFilter === "active"} onClick={() => setStatusFilter("active")} />
        <FilterChip label="Деактивированные" count={counts.inactive} active={statusFilter === "inactive"} onClick={() => setStatusFilter("inactive")} />
      </div>
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filtered.length} {filtered.length === users.length ? "пользователей" : `из ${users.length}`}
      </span>
    </div>
    <div style={pageScroll}>
      <div className="table-scroll">
        {loading ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : filtered.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>{users.length === 0 ? "Пользователей нет." : "Ничего не нашлось."}</div>
          : <table style={dataTable}>
            <thead><tr style={{ background: T.surface }}>
              {["ФИО", "Логин", "Должность", "Роль", "Подразделение", "Статус", ""].map(h =>
                <th key={h} style={hdr}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {pageItems.map(u => {
                const isSelf = u.id_user === user.id_user;
                const canDeactivate = u.is_active && !isSelf;
                return <tr key={u.id_user}
                    onDoubleClick={() => setEditing({ ...u })}
                    style={{ background: T.surface, cursor: "pointer", opacity: u.is_active ? 1 : 0.55 }}
                    title="Двойной клик — редактировать">
                  <td style={{ ...tcell, fontWeight: 600 }}>{u.full_name}</td>
                  <td style={tcell}>{u.login}</td>
                  <td style={{ ...tcell, color: u.title ? T.text : T.textMuted }}>{u.title || "—"}</td>
                  <td style={tcell}>{u.role}</td>
                  <td style={tcell}>{u.department}</td>
                  <td style={tcell}><UserStatusBadge active={u.is_active} /></td>
                  <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing({ ...u }); }} title="Редактировать" style={{ ...iconBtn, cursor: "pointer" }}><PencilIcon /></button>
                      <button
                        onClick={canDeactivate ? (e) => { e.stopPropagation(); handleDeactivate(u); } : undefined}
                        disabled={!canDeactivate}
                        title={isSelf ? "Нельзя деактивировать самого себя" : (u.is_active ? "Деактивировать" : "Уже деактивирован")}
                        style={{ ...iconBtn, cursor: canDeactivate ? "pointer" : "not-allowed", opacity: canDeactivate ? 1 : 0.35 }}
                      ><UserOffIcon /></button>
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
    </div>

    {editing && <UserEditModal
      data={editing}
      roles={roles}
      departments={departments}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); reload(); }}
    />}
    {pendingDeactivate && <ConfirmDeleteModal
      title={`Деактивировать пользователя «${pendingDeactivate.full_name}»?`}
      message="Пользователь больше не сможет войти в систему. Его авторские РПД и история согласований сохранятся, и его можно будет снова активировать в этом же списке."
      confirmLabel="Деактивировать"
      onClose={() => setPendingDeactivate(null)}
      onConfirm={async () => { const u = pendingDeactivate; setPendingDeactivate(null); await performDeactivate(u); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

const USER_DRAFT_KEY = "createUserDraft.v1";
function loadUserDraft() {
  try {
    const raw = sessionStorage.getItem(USER_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : null;
  } catch { return null; }
}
function clearUserDraft() {
  try { sessionStorage.removeItem(USER_DRAFT_KEY); } catch {}
}

function UserEditModal({ data, roles, departments, onClose, onSaved }) {
  const isCreate = !!data.create;
  const draft = isCreate ? loadUserDraft() : null;
  const [form, setForm] = useState(() => {
    if (isCreate) {
      const base = { login: "", full_name: "", title: "", email: "", id_role: 0, id_department: 0, password: "", is_active: true };
      return draft ? { ...base, ...draft, password: "" } : base;
    }
    return {
      login: data.login,
      full_name: data.full_name,
      title: data.title || "",
      email: data.email || "",
      id_role: data.id_role,
      id_department: data.id_department,
      password: "",
      is_active: data.is_active,
    };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [titleOptions, setTitleOptions] = useState([]);

  useEffect(() => {
    api.adminListDictionary("employee_title", {})
      .then(r => setTitleOptions((r.data || []).map(e => ({ value: e.value, label: e.value }))))
      .catch(() => setTitleOptions([]));
  }, []);

  useEffect(() => {
    if (!isCreate) return;
    try {
      const { password, ...rest } = form;
      sessionStorage.setItem(USER_DRAFT_KEY, JSON.stringify(rest));
    } catch {}
  }, [isCreate, form]);

  function discardAndClose() {
    if (isCreate) clearUserDraft();
    onClose();
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.full_name.trim()) { setErr("ФИО обязательно"); return; }
    if (isCreate && !form.login.trim()) { setErr("Логин обязателен"); return; }
    if (!form.id_role) { setErr("Выберите роль"); return; }
    if (!form.id_department) { setErr("Выберите подразделение"); return; }
    setErr("");
    setSaving(true);
    try {
      if (isCreate) {
        await api.adminCreateUser({
          login: form.login.trim(),
          full_name: form.full_name.trim(),
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          id_role: +form.id_role,
          id_department: +form.id_department,
          password: form.password || null,
        });
        clearUserDraft();
      } else {
        const payload = {
          full_name: form.full_name.trim(),
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          login: form.login.trim(),
          id_role: +form.id_role,
          id_department: +form.id_department,
          is_active: !!form.is_active,
        };
        if (form.password) payload.password = form.password;
        await api.adminUpdateUser(data.id_user, payload);
      }
      onSaved();
    } catch (e) {
      setErr("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  }

  return <Modal width={520} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      {isCreate ? "Новый пользователь" : "Редактирование пользователя"}
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Input required label="ФИО" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
      <Input required={isCreate} label="Логин" value={form.login} onChange={e => set("login", e.target.value)} disabled={!isCreate} />
      <div>
        <label style={labelStyle}>Должность</label>
        <Dropdown
          value={form.title}
          options={titleOptions}
          onChange={v => set("title", v)}
          placeholder="— не указано —"
          clearLabel="— не указано —"
        />
      </div>
      <Input label="Email" value={form.email} onChange={e => set("email", e.target.value)} />

      <div>
        <label style={labelStyle}>Роль <span style={{ color: T.red }}>*</span></label>
        <Dropdown
          value={String(form.id_role)}
          options={roles.map(r => ({ value: String(r.id_role), label: r.name }))}
          onChange={v => set("id_role", +v)}
          placeholder="— не указано —"
          clearLabel="— не указано —"
        />
      </div>

      <div>
        <label style={labelStyle}>Подразделение <span style={{ color: T.red }}>*</span></label>
        <Dropdown
          value={String(form.id_department)}
          options={departments.map(d => ({ value: String(d.id_department), label: d.name }))}
          onChange={v => set("id_department", +v)}
          placeholder="— не указано —"
          clearLabel="— не указано —"
        />
      </div>

      <Input
        label={isCreate ? "Пароль (по умолчанию: password)" : "Новый пароль (оставьте пустым, если не меняете)"}
        value={form.password}
        onChange={e => set("password", e.target.value)}
        type="text"
      />

      {!isCreate && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={!!form.is_active} onChange={e => set("is_active", e.target.checked)} />
          Активен
        </label>
      )}

      {err && <div style={formErrorBox}>{err}</div>}
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
      <Btn onClick={discardAndClose}>Отмена</Btn>
    </div>
  </Modal>;
}

function UserStatusBadge({ active }) {
  const color = active ? T.green : T.textMuted;
  const bg = active ? T.greenLight : T.borderLight;
  return <span style={statusBadge({ color, bg })}>{active ? "Активен" : "Деактивирован"}</span>;
}

const labelStyle = fieldLabel;
