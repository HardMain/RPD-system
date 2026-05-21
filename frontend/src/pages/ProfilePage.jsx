import { useEffect, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F, fieldLabel, inputBase, formErrorBox, sectionLabel, THEMES, applyTheme, THEME_LIGHT, THEME_DARK } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { Avatar, AVATAR_COLORS } from "../components/Avatar.jsx";
import { KeyIcon, InfoIcon, GearIcon, ThemeIcon } from "../components/icons.jsx";

const SECTIONS = [
  { id: "profile", label: "Профиль", icon: <GearIcon size={15} /> },
  { id: "security", label: "Безопасность", icon: <KeyIcon size={15} /> },
  { id: "appearance", label: "Внешний вид", icon: <ThemeIcon size={15} /> },
  { id: "system", label: "Система", icon: <InfoIcon size={15} /> },
];

export function ProfilePage({ user, section = "profile", onUserUpdated, onBack }) {
  const [active, setActive] = useState(SECTIONS.some(s => s.id === section) ? section : "profile");
  useEffect(() => {
    if (SECTIONS.some(s => s.id === section)) setActive(section);
  }, [section]);

  return <div style={{ flex: 1, overflow: "auto", scrollbarGutter: "stable", background: T.bg }}>
    {onBack && <div style={{ maxWidth: 880, margin: "20px auto 0", padding: "0 24px" }}>
      <Btn small onClick={onBack}>← Назад</Btn>
    </div>}
    <div style={{ maxWidth: 880, margin: onBack ? "14px auto 24px" : "24px auto", padding: "0 24px", display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 200px", background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 10, padding: 8, position: "sticky", top: 24 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
            padding: "10px 12px", border: "none", borderRadius: 7,
            background: active === s.id ? T.accentLight : "transparent",
            color: active === s.id ? T.accent : T.text,
            fontWeight: active === s.id ? 700 : 500,
            fontSize: 13, fontFamily: F, cursor: "pointer", marginBottom: 2,
          }}>
            <span style={{ display: "flex", color: active === s.id ? T.accent : T.textMuted }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 10, padding: 24 }}>
        {active === "profile" && <ProfileSection user={user} onUserUpdated={onUserUpdated} />}
        {active === "security" && <SecuritySection />}
        {active === "appearance" && <AppearanceSection user={user} onUserUpdated={onUserUpdated} />}
        {active === "system" && <SystemSection user={user} />}
      </div>
    </div>
  </div>;
}

function Heading({ children }) {
  return <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: T.text }}>{children}</div>;
}

function ProfileSection({ user, onUserUpdated }) {
  const fileRef = useRef(null);
  const [email, setEmail] = useState(user.email || "");
  const [busyAction, setBusyAction] = useState(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setEmail(user.email || ""); }, [user.email]);

  async function apply(action, promise, okMsg) {
    setBusyAction(action); setErr("");
    try {
      const r = await promise;
      onUserUpdated(r.data);
      if (okMsg) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Не удалось сохранить");
    }
    setBusyAction(null);
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("Ожидается изображение"); return; }
    apply("avatar", api.uploadAvatar(f));
  }

  const ro = [
    ["ФИО", user.full_name],
    ["Должность", user.title],
    ["Роль", user.role],
    ["Подразделение", user.department],
  ].filter(r => r[1]);

  return <div>
    <Heading>Профиль</Heading>

    <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 24 }}>
      <Avatar user={user} size={72} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickFile} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={() => fileRef.current?.click()} disabled={busyAction === "avatar"}>{busyAction === "avatar" ? "Загрузка…" : "Загрузить фото"}</Btn>
          {user.avatar_data_url && <Btn small danger onClick={() => apply("avatar", api.deleteAvatar())} disabled={busyAction === "avatar"}>Удалить фото</Btn>}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted }}>PNG, JPEG, WEBP или GIF, до 1.5 МБ</div>
      </div>
    </div>

    <div style={{ marginBottom: 24 }}>
      <div style={fieldLabel}>Цвет аватара {user.avatar_data_url && <span style={{ color: T.textMuted, fontStyle: "italic" }}>(используется, если нет фото)</span>}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {AVATAR_COLORS.map(c => {
          const picked = (user.avatar_color || "").toLowerCase() === c.toLowerCase();
          return <button key={c} onClick={() => apply("color", api.updateProfile({ avatar_color: c }))} disabled={busyAction === "color"} title={c}
            style={{
              width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
              border: picked ? "3px solid " + T.text : "2px solid " + T.surface,
              boxShadow: "0 0 0 1px " + T.border,
            }} />;
        })}
      </div>
    </div>

    <div style={{ maxWidth: 360, marginBottom: 20 }}>
      <label style={fieldLabel}>E-mail</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" style={inputBase} />
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <Btn primary small onClick={() => apply("email", api.updateProfile({ email }), true)} disabled={busyAction === "email" || email === (user.email || "")}>{busyAction === "email" ? "Сохранение…" : "Сохранить e-mail"}</Btn>
        {saved && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Сохранено</span>}
      </div>
    </div>

    {err && <div style={formErrorBox}>{err}</div>}

    <div style={{ borderTop: "1px solid " + T.borderLight, marginTop: 8, paddingTop: 16 }}>
      <div style={sectionLabel}>Учётные данные</div>
      {ro.map(r => <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: T.textMuted }}>{r[0]}</span>
        <span style={{ color: T.text, fontWeight: 600, textAlign: "right" }}>{r[1]}</span>
      </div>)}
    </div>
  </div>;
}

function SecuritySection() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!oldPw || !newPw) { setErr("Заполните все поля"); return; }
    if (newPw.length < 4) { setErr("Новый пароль слишком короткий (минимум 4 символа)"); return; }
    if (newPw !== confirmPw) { setErr("Новый пароль и подтверждение не совпадают"); return; }
    setErr(""); setSaving(true);
    try {
      await api.changePassword({ old_password: oldPw, new_password: newPw });
      setDone(true); setOldPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Не удалось сменить пароль");
    }
    setSaving(false);
  }

  return <div style={{ maxWidth: 360 }}>
    <Heading>Смена пароля</Heading>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={fieldLabel}>Текущий пароль</label>
        <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={inputBase} />
      </div>
      <div>
        <label style={fieldLabel}>Новый пароль</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputBase} />
      </div>
      <div>
        <label style={fieldLabel}>Повторите новый пароль</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} style={inputBase} />
      </div>
      {err && <div style={formErrorBox}>{err}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn primary onClick={submit} disabled={saving}>{saving ? "Сохранение…" : "Сменить пароль"}</Btn>
        {done && <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Пароль изменён</span>}
      </div>
    </div>
  </div>;
}

function AppearanceSection({ user, onUserUpdated }) {
  const current = user.theme === "dark" ? "dark" : "light";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function choose(id) {
    if (id === current || busy) return;
    applyTheme(id);
    setBusy(true); setErr("");
    try {
      const r = await api.updateProfile({ theme: id });
      onUserUpdated(r.data);
    } catch (e) {
      applyTheme(current);
      setErr(e?.response?.data?.detail || "Не удалось сохранить тему");
    }
    setBusy(false);
  }

  return <div>
    <Heading>Внешний вид</Heading>
    <div style={fieldLabel}>Тема оформления (сохраняется в вашем профиле)</div>
    <div style={{ display: "flex", gap: 12 }}>
      {THEMES.map(t => {
        const picked = current === t.id;
        const pal = t.id === "dark" ? THEME_DARK : THEME_LIGHT;
        return <button key={t.id} onClick={() => choose(t.id)} disabled={busy} style={{
          flex: "0 0 160px", textAlign: "left", cursor: "pointer",
          border: "2px solid " + (picked ? T.accent : T.border), borderRadius: 10,
          background: T.surface, padding: 12, fontFamily: F,
        }}>
          <div style={{
            height: 56, borderRadius: 6, marginBottom: 10,
            background: pal.bg,
            border: "1px solid " + T.borderLight,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              width: 36, height: 10, borderRadius: 3,
              background: pal.accent,
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.label}</span>
            <span style={{ fontSize: 12, color: picked ? T.accent : T.textMuted, fontWeight: 600 }}>{picked ? "Выбрана" : ""}</span>
          </div>
        </button>;
      })}
    </div>
    {err && <div style={{ ...formErrorBox, marginTop: 12 }}>{err}</div>}
  </div>;
}

function SystemSection({ user }) {
  const [h, setH] = useState(null);
  useEffect(() => { api.getHealth().then(r => setH(r.data)).catch(() => {}); }, []);
  const llmOnline = h?.llm?.mode === "online";
  const isAdmin = api.userCan(user, "*");
  const reloadHealth = () => api.getHealth().then(r => setH(r.data)).catch(() => {});
  const cards = [
    { title: "Статус", rows: [
      ["Сервер", h ? "online" : "…", h ? T.green : T.orange],
      ["LLM", h ? (llmOnline ? "подключена" : "demo-режим") : "…", h ? (llmOnline ? T.green : T.orange) : T.orange],
      ["Версия", h?.version || "1.0.0"],
    ] },
    { title: "О системе", rows: [["Организация", "ПНИПУ"], ["Модель LLM", h?.llm?.model || "настраивается в .env"]] },
  ];
  return <div>
    <Heading>Системная информация</Heading>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {cards.map(c => <div key={c.title} style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{c.title}</div>
        {c.rows.map(r => <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: T.textMuted }}>{r[0]}</span>
          <span style={{ color: r[2] || T.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {r[2] && <span style={{ width: 8, height: 8, borderRadius: 4, background: r[2], display: "inline-block" }} />}{r[1]}
          </span>
        </div>)}
      </div>)}
      {isAdmin && <LlmModelSelector onChanged={reloadHealth} />}
    </div>
  </div>;
}

function LlmModelSelector({ onChanged }) {
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.adminGetLlmModel().then(r => setInfo(r.data)).catch(() => setError("Не удалось загрузить список моделей"));
  }, []);
  async function change(model) {
    if (!info || model === info.current) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.adminSetLlmModel(model);
      setInfo(r.data);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось сохранить");
    }
    setSaving(false);
  }
  return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Настройки LLM</div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
      Выбранная модель применяется при следующей генерации. Доступ к настройке — только у администратора.
    </div>
    {info ? <select
      value={info.current}
      onChange={e => change(e.target.value)}
      disabled={saving}
      style={{
        width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6,
        background: T.surface, fontSize: 13, fontFamily: F, color: T.text, outline: "none",
        cursor: saving ? "wait" : "pointer",
      }}
    >
      {(info.choices || []).map(c => <option key={c.id} value={c.id}>{c.label} — {c.id}</option>)}
      {!info.choices.some(c => c.id === info.current) && (
        <option value={info.current}>{info.current} (из .env)</option>
      )}
    </select> : <div style={{ fontSize: 12, color: T.textMuted }}>Загрузка…</div>}
    {error && <div style={{ ...formErrorBox, marginTop: 10 }}>{error}</div>}
  </div>;
}
