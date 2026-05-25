import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F, fieldLabel, inputBase, formErrorBox, sectionLabel, THEMES, applyTheme, THEME_LIGHT, THEME_DARK } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { PasswordField } from "../components/PasswordField.jsx";
import { Avatar, AVATAR_COLORS } from "../components/Avatar.jsx";
import { KeyIcon, InfoIcon, GearIcon, ThemeIcon, SparkleIcon } from "../components/icons.jsx";

const BASE_SECTIONS = [
  { id: "profile", label: "Профиль", icon: <GearIcon size={15} /> },
  { id: "security", label: "Безопасность", icon: <KeyIcon size={15} /> },
  { id: "appearance", label: "Внешний вид", icon: <ThemeIcon size={15} /> },
  { id: "system", label: "Система", icon: <InfoIcon size={15} /> },
];
const LLM_SECTION = { id: "llm", label: "LLM", icon: <SparkleIcon /> };

export function ProfilePage({ user, section = "profile", onUserUpdated, onBack }) {
  const isAdmin = api.userCan(user, "*");
  const sections = useMemo(() => isAdmin ? [...BASE_SECTIONS, LLM_SECTION] : BASE_SECTIONS, [isAdmin]);
  const [active, setActive] = useState(sections.some(s => s.id === section) ? section : "profile");
  useEffect(() => {
    if (sections.some(s => s.id === section)) setActive(section);
  }, [section, sections]);

  return <div style={{ flex: 1, overflow: "auto", scrollbarGutter: "stable", background: T.bg }}>
    {onBack && <div style={{ maxWidth: 880, margin: "20px auto 0", padding: "0 24px" }}>
      <Btn small onClick={onBack}>← Назад</Btn>
    </div>}
    <div style={{ maxWidth: 880, margin: onBack ? "14px auto 24px" : "24px auto", padding: "0 24px", display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 200px", background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 10, padding: 8, position: "sticky", top: 24 }}>
        {sections.map(s => (
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
        {active === "llm" && isAdmin && <LlmSection />}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PasswordField label="Текущий пароль" value={oldPw} onChange={e => setOldPw(e.target.value)} />
      <PasswordField label="Новый пароль" value={newPw} onChange={e => setNewPw(e.target.value)} />
      <PasswordField label="Повторите новый пароль" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      {err && <div style={{ ...formErrorBox, marginBottom: 8 }}>{err}</div>}
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
    <div style={fieldLabel}>Тема оформления</div>
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
  const canEditSettings = api.userCan(user, "*") || api.userCan(user, "users.create");
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
      {canEditSettings && <ApproverSettings />}
      {canEditSettings && <SignatureSettings />}
    </div>
  </div>;
}

function SignatureSettings() {
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [src, setSrc] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 200, h: 60 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminGetApproverSignature()
      .then(r => setInfo(r.data))
      .catch(() => setError("Не удалось загрузить подпись"))
      .finally(() => setLoading(false));
  }, []);

  function pickFile() { fileRef.current?.click(); }

  function onPick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "image/png") { setError("Ожидается PNG"); return; }
    if (f.size > 2_000_000) { setError("Файл слишком большой (максимум 2 МБ)"); return; }
    setError(null);
    setImgSize({ w: 0, h: 0 });
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result);
    reader.readAsDataURL(f);
  }

  function onImgLoad(e) {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    setImgSize({ w, h });
    const cropW = Math.min(w * 0.6, w);
    const cropH = Math.min(cropW / 3.5, h * 0.5);
    setCrop({ x: Math.round((w - cropW) / 2), y: Math.round((h - cropH) / 2), w: Math.round(cropW), h: Math.round(cropH) });
  }

  function clampCrop(next) {
    let { x, y, w, h } = next;
    w = Math.max(20, Math.min(w, imgSize.w));
    h = Math.max(20, Math.min(h, imgSize.h));
    x = Math.max(0, Math.min(x, imgSize.w - w));
    y = Math.max(0, Math.min(y, imgSize.h - h));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }

  function startDrag(e, mode) {
    e.preventDefault();
    e.stopPropagation();
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scale = imgSize.w > 0 ? rect.width / imgSize.w : 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...crop };
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (mode === "move") {
        setCrop(clampCrop({ x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }));
      } else if (mode === "resize") {
        setCrop(clampCrop({ x: start.x, y: start.y, w: start.w + dx, h: start.h + dy }));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  async function apply() {
    if (!imgRef.current || !src) return;
    setBusy(true); setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = crop.w;
      canvas.height = crop.h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Не удалось получить PNG");
      const f = new File([blob], "signature.png", { type: "image/png" });
      const r = await api.adminUploadApproverSignature(f);
      setInfo(r.data);
      setSrc(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Не удалось сохранить подпись");
    }
    setBusy(false);
  }

  async function clearSignature() {
    setBusy(true); setError(null);
    try {
      const r = await api.adminDeleteApproverSignature();
      setInfo(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось удалить подпись");
    }
    setBusy(false);
  }

  const displayMaxW = 520;
  const displayW = imgSize.w > 0 ? Math.min(imgSize.w, displayMaxW) : displayMaxW;
  const scale = imgSize.w > 0 ? displayW / imgSize.w : 1;

  return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Подпись утверждающего</div>
      {saved && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Сохранено</span>}
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
      PNG-изображение, которое подкладывается на линию подписи в блоке «УТВЕРЖДАЮ» при скачивании РПД. Выберите файл и выделите рамкой ту часть, которую нужно оставить в подписи.
    </div>
    {loading ? <div style={{ fontSize: 12, color: T.textMuted }}>Загрузка…</div> : <>
      <input ref={fileRef} type="file" accept="image/png" style={{ display: "none" }} onChange={onPick} />
      {!src && info?.has_signature && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{
            padding: 8, background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={info.data_url} alt="Текущая подпись" style={{ maxWidth: 240, maxHeight: 100, display: "block" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn small onClick={pickFile} disabled={busy}>Заменить</Btn>
            <Btn small danger onClick={clearSignature} disabled={busy}>Удалить</Btn>
          </div>
        </div>
      )}
      {!src && !info?.has_signature && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn small onClick={pickFile} disabled={busy}>Загрузить PNG…</Btn>
          <span style={{ fontSize: 12, color: T.textMuted }}>Подпись пока не загружена.</span>
        </div>
      )}
      {src && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
            Перетащите рамку, чтобы выбрать область с подписью. Угловой маркер — изменить размер. Прозрачность фона PNG сохраняется.
          </div>
          <div style={{
            position: "relative", display: "inline-block",
            background: "repeating-conic-gradient(#eee 0% 25%, #fafafa 0% 50%) 50% / 16px 16px",
            border: "1px solid " + T.border, borderRadius: 4, lineHeight: 0,
          }}>
            <img ref={imgRef} src={src} alt="" onLoad={onImgLoad}
              style={{ display: "block", width: displayW, height: "auto", userSelect: "none", pointerEvents: "none" }} />
            {imgSize.w > 0 && (
              <div
                onMouseDown={e => startDrag(e, "move")}
                style={{
                  position: "absolute",
                  left: crop.x * scale, top: crop.y * scale,
                  width: crop.w * scale, height: crop.h * scale,
                  border: "2px solid " + T.accent,
                  background: "rgba(107,79,138,.12)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,.35)",
                  cursor: "move",
                }}
              >
                <div
                  onMouseDown={e => startDrag(e, "resize")}
                  style={{
                    position: "absolute", right: -7, bottom: -7,
                    width: 14, height: 14, background: T.accent,
                    border: "2px solid #fff", borderRadius: 2,
                    cursor: "nwse-resize",
                  }}
                />
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Btn small primary onClick={apply} disabled={busy || imgSize.w === 0}>{busy ? "Сохранение…" : "Применить и сохранить"}</Btn>
            <Btn small onClick={pickFile} disabled={busy}>Выбрать другой файл</Btn>
            <Btn small onClick={() => { setSrc(null); setImgSize({ w: 0, h: 0 }); }} disabled={busy}>Отмена</Btn>
            {imgSize.w > 0 && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>
              {crop.w} × {crop.h} px
            </span>}
          </div>
        </div>
      )}
    </>}
    {error && <div style={{ ...formErrorBox, marginTop: 10 }}>{error}</div>}
  </div>;
}

function LlmSection() {
  return <div>
    <Heading>Настройки LLM</Heading>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <LlmModelSelector />
      <SystemPromptEditor />
    </div>
  </div>;
}

function SystemPromptEditor() {
  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [savedDefault, setSavedDefault] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const applyOut = (data) => {
    setPrompt(data.prompt || "");
    setSavedPrompt(data.prompt || "");
    setSavedDefault(data.saved_default || "");
  };

  useEffect(() => {
    api.adminGetSystemPrompt()
      .then(r => { applyOut(r.data); setLoaded(true); })
      .catch(() => setError("Не удалось загрузить системный промпт"));
  }, []);

  const matchesDefault = (savedPrompt || "").trim() === (savedDefault || "").trim();

  async function run(action, fn) {
    setBusy(action);
    setError(null);
    setSaved(false);
    try {
      const r = await fn();
      applyOut(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось выполнить действие");
    }
    setBusy(null);
  }

  function commit() {
    if (prompt === savedPrompt) return;
    if (!prompt.trim()) { setError("Системный промпт не может быть пустым"); setPrompt(savedPrompt); return; }
    run("save", () => api.adminSetSystemPrompt(prompt));
  }
  const saveDefault = () => run("save-default", () => api.adminSaveSystemPromptDefault());
  const restoreDefault = () => run("restore-default", () => api.adminRestoreSystemPromptDefault());

  return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Системный промпт</div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
      Базовая инструкция модели для всех разделов РПД. Сохраняется автоматически при потере фокуса. Per-section промпты из админ-вкладки «LLM → Промпты по разделам» имеют приоритет.
    </div>
    {loaded ? <>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onBlur={commit} disabled={busy !== null}
        style={{
          width: "100%", minHeight: 280, padding: "10px 12px", border: "1px solid " + T.border,
          borderRadius: 6, background: T.surface, fontSize: 12, fontFamily: F, color: T.text,
          outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box",
        }} />
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Btn small onClick={saveDefault} disabled={busy !== null || matchesDefault} title="Сделать текущий промпт сохранённым дефолтом">
          {busy === "save-default" ? "..." : "Обновить дефолт"}
        </Btn>
        <Btn small onClick={restoreDefault} disabled={busy !== null || matchesDefault} title="Откатить промпт к сохранённому дефолту">
          {busy === "restore-default" ? "..." : "Восстановить дефолт"}
        </Btn>
        {saved && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Сохранено</span>}
        {!matchesDefault && !saved && <span style={{ fontSize: 12, color: T.orange, fontWeight: 600 }}>Текущий промпт отличается от дефолтного</span>}
      </div>
    </> : <div style={{ fontSize: 12, color: T.textMuted }}>Загрузка…</div>}
    {error && <div style={{ ...formErrorBox, marginTop: 10 }}>{error}</div>}
  </div>;
}

function ApproverSettings() {
  const [position, setPosition] = useState("");
  const [name, setName] = useState("");
  const [savedPosition, setSavedPosition] = useState("");
  const [savedName, setSavedName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.adminGetApprover()
      .then(r => {
        const p = r.data.position || "", n = r.data.name || "";
        setPosition(p); setSavedPosition(p);
        setName(n); setSavedName(n);
        setLoaded(true);
      })
      .catch(() => setError("Не удалось загрузить настройку"));
  }, []);
  async function commit(nextPosition, nextName) {
    const p = nextPosition.trim(), n = nextName.trim();
    if (p === savedPosition && n === savedName) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await api.adminSetApprover(p, n);
      const rp = r.data.position || "", rn = r.data.name || "";
      setPosition(rp); setSavedPosition(rp);
      setName(rn); setSavedName(rn);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось сохранить");
    }
    setSaving(false);
  }
  return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Утверждающий (блок «УТВЕРЖДАЮ»)</div>
      {saved && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Сохранено</span>}
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
      Должность и ФИО лица, утверждающего РПД. Сохраняется автоматически при потере фокуса. Подставляются в шапку всех документов при скачивании.
    </div>
    {loaded ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={fieldLabel}>Должность</div>
        <input value={position} onChange={e => setPosition(e.target.value)}
          onBlur={() => commit(position, name)} disabled={saving}
          placeholder="Проректор по образовательной деятельности" style={inputBase} />
      </div>
      <div>
        <div style={fieldLabel}>ФИО</div>
        <input value={name} onChange={e => setName(e.target.value)}
          onBlur={() => commit(position, name)} disabled={saving}
          placeholder="И.Ю.Черникова" style={inputBase} />
      </div>
    </div> : <div style={{ fontSize: 12, color: T.textMuted }}>Загрузка…</div>}
    {error && <div style={{ ...formErrorBox, marginTop: 10 }}>{error}</div>}
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
