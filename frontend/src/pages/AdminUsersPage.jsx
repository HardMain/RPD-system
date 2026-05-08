import { useEffect, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Spinner } from "../components/Spinner.jsx";

export function AdminUsersPage({ user }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const reload = () => {
    setLoading(true);
    Promise.all([api.adminListUsers(), api.adminListRoles(), api.adminListDepartments()])
      .then(([u, r, d]) => { setUsers(u.data || []); setRoles(r.data || []); setDepartments(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  async function handleDeactivate(u) {
    if (!confirm(`Деактивировать пользователя «${u.full_name}»?`)) return;
    try { await api.adminDeactivateUser(u.id_user); reload(); }
    catch (e) { alert("Не удалось: " + (e?.response?.data?.detail || e.message)); }
  }

  const visible = showOnlyActive ? users.filter(u => u.is_active) : users;

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Пользователи</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={showOnlyActive} onChange={e => setShowOnlyActive(e.target.checked)} />
            Только активные
          </label>
          <Btn primary onClick={() => setEditing({ create: true })}>+ Добавить</Btn>
        </div>
      </div>

      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : visible.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Пользователей нет.</div>
          : <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
            <thead><tr style={{ background: T.bg }}>
              {["ФИО", "Логин", "Должность", "Роль", "Подразделение", "Статус", ""].map(h =>
                <th key={h} style={hdr}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {visible.map(u => (
                <tr key={u.id_user}
                    onDoubleClick={() => setEditing({ ...u })}
                    style={{ borderTop: "1px solid " + T.borderLight, cursor: "pointer", background: u.is_active ? "transparent" : T.bg }}>
                  <td style={{ ...tcell, fontWeight: 600 }}>{u.full_name}</td>
                  <td style={tcell}>{u.ldap_uid}</td>
                  <td style={tcell}>{u.title || ""}</td>
                  <td style={tcell}>{u.role}</td>
                  <td style={tcell}>{u.department}</td>
                  <td style={tcell}>{u.is_active ? "Активен" : "Деактивирован"}</td>
                  <td style={{ ...tcell, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Btn small onClick={() => setEditing({ ...u })}>Изменить</Btn>
                    {u.is_active && u.id_user !== user.id_user && (
                      <Btn small danger onClick={() => handleDeactivate(u)} style={{ marginLeft: 6 }}>Деактивировать</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>}
      </div>
    </div>

    {editing && <UserEditModal
      data={editing}
      roles={roles}
      departments={departments}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); reload(); }}
    />}
  </div>;
}

function UserEditModal({ data, roles, departments, onClose, onSaved }) {
  const isCreate = !!data.create;
  const [form, setForm] = useState({
    ldap_uid: isCreate ? "" : data.ldap_uid,
    full_name: isCreate ? "" : data.full_name,
    title: isCreate ? "" : (data.title || ""),
    employee_type: isCreate ? "" : (data.employee_type || ""),
    email: isCreate ? "" : (data.email || ""),
    id_role: isCreate ? (roles[0]?.id_role || 0) : data.id_role,
    id_department: isCreate ? (departments[0]?.id_department || 0) : data.id_department,
    password: "",
    is_active: isCreate ? true : data.is_active,
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.full_name.trim()) { alert("ФИО обязательно"); return; }
    if (isCreate && !form.ldap_uid.trim()) { alert("Логин обязателен"); return; }
    if (!form.id_role) { alert("Выберите роль"); return; }
    if (!form.id_department) { alert("Выберите подразделение"); return; }
    setSaving(true);
    try {
      if (isCreate) {
        await api.adminCreateUser({
          ldap_uid: form.ldap_uid.trim(),
          full_name: form.full_name.trim(),
          title: form.title.trim() || null,
          employee_type: form.employee_type.trim() || null,
          email: form.email.trim() || null,
          id_role: +form.id_role,
          id_department: +form.id_department,
          password: form.password || null,
        });
      } else {
        const payload = {
          full_name: form.full_name.trim(),
          title: form.title.trim() || null,
          employee_type: form.employee_type.trim() || null,
          email: form.email.trim() || null,
          ldap_uid: form.ldap_uid.trim(),
          id_role: +form.id_role,
          id_department: +form.id_department,
          is_active: !!form.is_active,
        };
        if (form.password) payload.password = form.password;
        await api.adminUpdateUser(data.id_user, payload);
      }
      onSaved();
    } catch (e) {
      alert("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  }

  return <Modal width={520} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      {isCreate ? "Новый пользователь" : "Редактирование пользователя"}
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Input label="ФИО" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
      <Input label="Логин (ldap_uid)" value={form.ldap_uid} onChange={e => set("ldap_uid", e.target.value)} disabled={!isCreate} />
      <Input label="Должность" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Доцент / Профессор / Заведующий..." />
      <Input label="Тип сотрудника (slug)" value={form.employee_type} onChange={e => set("employee_type", e.target.value)} placeholder="teacher / head / umu_chief..." />
      <Input label="Email" value={form.email} onChange={e => set("email", e.target.value)} />

      <div>
        <label style={labelStyle}>Роль</label>
        <select value={form.id_role} onChange={e => set("id_role", +e.target.value)} style={selectStyle}>
          {roles.map(r => <option key={r.id_role} value={r.id_role}>{r.name}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Подразделение</label>
        <select value={form.id_department} onChange={e => set("id_department", +e.target.value)} style={selectStyle}>
          {departments.map(d => <option key={d.id_department} value={d.id_department}>{d.name}</option>)}
        </select>
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
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
    </div>
  </Modal>;
}

const labelStyle = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };
const selectStyle = { width: "100%", padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none" };
