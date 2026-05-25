import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F, fieldLabel, inputBase, formErrorBox, sectionLabel, THEMES, applyTheme, THEME_LIGHT, THEME_DARK } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { PasswordField } from "../components/PasswordField.jsx";
import { Avatar, AVATAR_COLORS } from "../components/Avatar.jsx";
import { KeyIcon, InfoIcon, GearIcon, ThemeIcon, SparkleIcon, BuildingIcon } from "../components/icons.jsx";
import { useDismiss } from "../hooks/useDismiss.js";

const BASE_SECTIONS = [
  { id: "profile", label: "Профиль", icon: <GearIcon size={15} /> },
  { id: "security", label: "Безопасность", icon: <KeyIcon size={15} /> },
  { id: "appearance", label: "Внешний вид", icon: <ThemeIcon size={15} /> },
  { id: "system", label: "Система", icon: <InfoIcon size={15} /> },
];
const ORG_SECTION = { id: "organization", label: "Организация", icon: <BuildingIcon size={15} /> };
const LLM_SECTION = { id: "llm", label: "LLM", icon: <SparkleIcon /> };

export function ProfilePage({ user, section = "profile", onUserUpdated, onBack }) {
  const isAdmin = api.userCan(user, "*");
  const canManageOrg = isAdmin || api.userCan(user, "users.create");
  const sections = useMemo(() => {
    const list = [...BASE_SECTIONS];
    if (canManageOrg) {
      const insertAt = list.findIndex(s => s.id === "system");
      list.splice(insertAt, 0, ORG_SECTION);
    }
    if (isAdmin) list.push(LLM_SECTION);
    return list;
  }, [canManageOrg, isAdmin]);
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
        {active === "organization" && canManageOrg && <OrganizationSection />}
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
    </div>
  </div>;
}

function OrganizationSection() {
  const [signatureRev, setSignatureRev] = useState(0);
  return <div>
    <Heading>Организация</Heading>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ApproverSettings />
      <SignatureSettings onSignatureChanged={() => setSignatureRev(r => r + 1)} />
      <SignaturePositionEditor key={signatureRev} signatureRev={signatureRev} />
    </div>
  </div>;
}

function _detectInkBbox(ctx, w, h) {
  let imgData;
  try { imgData = ctx.getImageData(0, 0, w, h); }
  catch { return { x: 0, y: 0, w, h }; }
  const d = imgData.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      const isInk = a > 32 && (r + g + b) < 600;
      if (isInk) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return { x: 0, y: 0, w, h };
  const padX = Math.max(2, Math.round((maxX - minX + 1) * 0.04));
  const padY = Math.max(2, Math.round((maxY - minY + 1) * 0.08));
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(w - 1, maxX + padX);
  const y1 = Math.min(h - 1, maxY + padY);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function _whiteToTransparent(canvas) {
  const ctx = canvas.getContext("2d");
  let imgData;
  try { imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
  catch { return; }
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const bright = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (bright > 230) {
      d[i + 3] = 0;
    } else if (bright > 180) {
      d[i + 3] = Math.round(d[i + 3] * (1 - (bright - 180) / 50));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function SignatureSettings({ onSignatureChanged }) {
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [src, setSrc] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  zoomRef.current = zoom;
  panRef.current = pan;
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
    const cropW = Math.min(320, Math.max(200, Math.round(w * 0.35)));
    const cropH = Math.round(cropW / 3);
    const cw = Math.min(cropW, w);
    const ch = Math.min(cropH, h);
    setCrop({ x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch });
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
    if (!imgRef.current || !wrapRef.current) return;
    const baseW = wrapRef.current.clientWidth;
    const baseScale = imgSize.w > 0 ? baseW / imgSize.w : 1;
    const eff = baseScale * zoomRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...crop };
    setDragging(true);
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / eff;
      const dy = (ev.clientY - startY) / eff;
      if (mode === "resize") {
        setCrop(clampCrop({ x: start.x, y: start.y, w: start.w + dx, h: start.h + dy }));
      } else {
        setCrop(clampCrop({ x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }));
      }
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  function startPan(e) {
    if (!imgSize.w) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...panRef.current };
    setDragging(true);
    const onMove = (ev) => {
      const next = { x: start.x + (ev.clientX - startX), y: start.y + (ev.clientY - startY) };
      panRef.current = next;
      setPan(next);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !src) return;
    const onWheel = (e) => {
      if (!imgSize.w) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prevZ = zoomRef.current;
      const prevP = panRef.current;
      let next = prevZ * (1 - e.deltaY / 500);
      next = Math.max(0.3, Math.min(5, next));
      if (next === prevZ) return;
      const imgX = (mx - prevP.x) / prevZ;
      const imgY = (my - prevP.y) / prevZ;
      const newPan = { x: mx - imgX * next, y: my - imgY * next };
      zoomRef.current = next;
      panRef.current = newPan;
      setZoom(next);
      setPan(newPan);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src, imgSize.w]);

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
  }

  function zoomBy(factor) {
    const el = wrapRef.current;
    if (!el || !imgSize.w) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const prevZ = zoomRef.current;
    const prevP = panRef.current;
    let next = Math.max(0.3, Math.min(5, prevZ * factor));
    if (next === prevZ) return;
    const imgX = (mx - prevP.x) / prevZ;
    const imgY = (my - prevP.y) / prevZ;
    const newPan = { x: mx - imgX * next, y: my - imgY * next };
    zoomRef.current = next;
    panRef.current = newPan;
    setZoom(next);
    setPan(newPan);
  }

  async function apply() {
    if (!imgRef.current || !src) return;
    setBusy(true); setError(null);
    try {
      const raw = document.createElement("canvas");
      raw.width = crop.w;
      raw.height = crop.h;
      const rctx = raw.getContext("2d");
      rctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      const bbox = _detectInkBbox(rctx, crop.w, crop.h);
      const TARGET_W = 300;
      const TARGET_H = 120;
      const out = document.createElement("canvas");
      out.width = TARGET_W;
      out.height = TARGET_H;
      const octx = out.getContext("2d");
      octx.imageSmoothingQuality = "high";
      octx.drawImage(raw, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, TARGET_W, TARGET_H);
      _whiteToTransparent(out);
      const blob = await new Promise(res => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("Не удалось получить PNG");
      const f = new File([blob], "signature.png", { type: "image/png" });
      const r = await api.adminUploadApproverSignature(f);
      setInfo(r.data);
      setSrc(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSignatureChanged?.();
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
      onSignatureChanged?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось удалить подпись");
    }
    setBusy(false);
  }

  const displayMaxW = 520;
  const displayW = imgSize.w > 0 ? Math.min(imgSize.w, displayMaxW) : displayMaxW;
  const baseScale = imgSize.w > 0 ? displayW / imgSize.w : 1;
  const displayH = imgSize.h > 0 ? Math.round(imgSize.h * baseScale) : 0;
  const eff = baseScale * zoom;

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
      {src && (() => {
        const cropDispX = crop.x * eff + pan.x;
        const cropDispY = crop.y * eff + pan.y;
        const cropDispW = crop.w * eff;
        const cropDispH = crop.h * eff;
        const buttonsBelow = (cropDispY + cropDispH + 56) <= displayH;
        const buttonsTop = buttonsBelow ? cropDispY + cropDispH + 10 : cropDispY - 50;
        const buttonsLeft = cropDispX + cropDispW / 2;
        return <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
            Выделите рамкой область с подписью. Тяните за фон, чтобы передвинуть картинку, колесо мыши — приблизить/отдалить. При сохранении область масштабируется к стандартному формату, белый фон автоматически становится прозрачным.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Btn small onClick={() => zoomBy(0.8)} disabled={zoom <= 0.31}>−</Btn>
            <Btn small onClick={() => zoomBy(1.25)} disabled={zoom >= 4.99}>+</Btn>
            <Btn small onClick={resetView} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>1:1</Btn>
            <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace", marginLeft: 4 }}>{Math.round(zoom * 100)}%</span>
          </div>
          <div ref={wrapRef}
            onMouseDown={startPan}
            style={{
              position: "relative",
              width: displayW, height: displayH || displayMaxW * 0.5,
              background: "repeating-conic-gradient(#eee 0% 25%, #fafafa 0% 50%) 50% / 16px 16px",
              border: "1px solid " + T.border, borderRadius: 4, lineHeight: 0,
              overflow: "hidden",
              cursor: dragging ? "grabbing" : "grab",
            }}>
            <img ref={imgRef} src={src} alt="" onLoad={onImgLoad}
              style={{
                display: "block",
                width: displayW, height: "auto",
                transformOrigin: "top left",
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                userSelect: "none", pointerEvents: "none",
              }} />
            {imgSize.w > 0 && <>
              <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: Math.max(0, cropDispY), background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: cropDispY + cropDispH, right: 0, bottom: 0, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: cropDispY, width: Math.max(0, cropDispX), height: cropDispH, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: cropDispX + cropDispW, top: cropDispY, right: 0, height: cropDispH, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div
                onMouseDown={e => startDrag(e, "move")}
                style={{
                  position: "absolute",
                  left: cropDispX, top: cropDispY,
                  width: cropDispW, height: cropDispH,
                  border: "2px solid " + T.accent,
                  background: "transparent",
                  cursor: dragging ? "grabbing" : "grab",
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
              {!dragging && (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    left: buttonsLeft, top: buttonsTop,
                    transform: "translateX(-50%)",
                    display: "flex", gap: 6,
                    background: T.surface,
                    border: "1px solid " + T.borderLight, borderRadius: 6,
                    padding: 5,
                    boxShadow: "0 4px 14px rgba(0,0,0,.22)",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}>
                  <Btn small primary onClick={apply} disabled={busy}>{busy ? "Сохранение…" : "Сохранить"}</Btn>
                  <Btn small onClick={() => { setSrc(null); setImgSize({ w: 0, h: 0 }); resetView(); }} disabled={busy}>Отмена</Btn>
                </div>
              )}
            </>}
          </div>
        </div>;
      })()}
    </>}
    {error && <div style={{ ...formErrorBox, marginTop: 10 }}>{error}</div>}
  </div>;
}

const MM_TO_PT = 72 / 25.4;

const SIG_MIN_MM = 5;
const SIG_MAX_MM = 80;

function SignaturePositionEditor() {
  const wrapRef = useRef(null);
  const [sig, setSig] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pos, setPos] = useState({ x: 0.6, y: 0.08 });
  const [widthMm, setWidthMm] = useState(25);
  const [heightMm, setHeightMm] = useState(10);
  const [containerW, setContainerW] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selected, setSelected] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;
  useDismiss(selected, () => setSelected(false), wrapRef);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.adminGetApproverSignature(),
      api.adminGetApproverSignaturePosition(),
    ]).then(async ([sigRes, posRes]) => {
      if (cancelled) return;
      const sigData = sigRes.data;
      setSig(sigData);
      setPos({ x: posRes.data.x, y: posRes.data.y });
      setWidthMm(posRes.data.width_mm);
      setHeightMm(posRes.data.height_mm);
      if (sigData?.has_signature) {
        try {
          const prev = await api.adminGetTitlePagePreview();
          if (cancelled) return;
          setPreview(prev.data);
        } catch (e) {
          if (cancelled) return;
          setError(e?.response?.data?.detail || "Не удалось загрузить превью титульника");
        }
      }
    }).catch(() => {
      if (!cancelled) setError("Не удалось загрузить данные подписи");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [preview]);

  useEffect(() => {
    if (!selected || !preview || containerW <= 0) return;
    const pagePtW = preview.page_w_pt || 595.276;
    const pagePtH = preview.page_h_pt || 841.89;
    const sigW_frac = (widthMm * MM_TO_PT) / pagePtW;
    const sigH_frac = (heightMm * MM_TO_PT) / pagePtH;
    let saveTimer = null;
    const onKey = (e) => {
      let dxPx = 0, dyPx = 0;
      if (e.key === "ArrowLeft") dxPx = -1;
      else if (e.key === "ArrowRight") dxPx = 1;
      else if (e.key === "ArrowUp") dyPx = -1;
      else if (e.key === "ArrowDown") dyPx = 1;
      else return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      e.preventDefault();
      const dxFrac = dxPx / containerW;
      const dyFrac = dyPx * (pagePtW / containerW) / pagePtH;
      const next = {
        x: Math.max(0, Math.min(1 - sigW_frac, posRef.current.x + dxFrac)),
        y: Math.max(0, Math.min(1 - sigH_frac, posRef.current.y + dyFrac)),
      };
      posRef.current = next;
      setPos(next);
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { commit({ x: next.x, y: next.y }); }, 400);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [selected, preview, containerW, widthMm, heightMm]);

  async function commit(patch) {
    setBusy(true); setError(null);
    try {
      const r = await api.adminSetApproverSignaturePosition(patch);
      setPos({ x: r.data.x, y: r.data.y });
      setWidthMm(r.data.width_mm);
      setHeightMm(r.data.height_mm);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось сохранить позицию");
    }
    setBusy(false);
  }

  if (loading) {
    return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16, fontSize: 12, color: T.textMuted }}>
      Загрузка позиционирования подписи…
    </div>;
  }

  if (!sig?.has_signature) return null;
  if (!preview) {
    return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Положение на титульном листе</div>
      {error
        ? <div style={{ fontSize: 12, color: T.red }}>{error}</div>
        : <div style={{ fontSize: 12, color: T.textMuted }}>Чтобы построить превью, в системе должна быть хотя бы одна РПД.</div>}
    </div>;
  }

  const pagePtW = preview.page_w_pt || 595.276;
  const pagePtH = preview.page_h_pt || 841.89;
  const previewScale = containerW > 0 ? containerW / pagePtW : 0;
  const previewH = pagePtH * previewScale;
  const sigPtW = widthMm * MM_TO_PT;
  const sigPtH = heightMm * MM_TO_PT;
  const sigPxW = sigPtW * previewScale;
  const sigPxH = sigPtH * previewScale;

  function startDrag(e) {
    e.preventDefault();
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...pos };
    let last = start;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / (rect.width * pagePtH / pagePtW);
      const x = Math.max(0, Math.min(1 - sigPtW / pagePtW, start.x + dx));
      const y = Math.max(0, Math.min(1 - sigPtH / pagePtH, start.y + dy));
      last = { x, y };
      setPos(last);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      if (last.x !== start.x || last.y !== start.y) commit({ x: last.x, y: last.y });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = widthMm;
    const startH = heightMm;
    const startAspect = startH / startW;
    let last = { w: startW, h: startH };
    const onMove = (ev) => {
      const ptPerPx = pagePtW / rect.width;
      const dxMm = (ev.clientX - startX) * ptPerPx / MM_TO_PT;
      const dyMm = (ev.clientY - startY) * ptPerPx / MM_TO_PT;
      let w = startW + dxMm;
      let h = startH + dyMm;
      if (ev.shiftKey) {
        const wScale = w / startW;
        const hScale = h / startH;
        const scale = Math.max(wScale, hScale);
        w = startW * scale;
        h = w * startAspect;
      }
      w = Math.max(SIG_MIN_MM, Math.min(SIG_MAX_MM, w));
      h = Math.max(SIG_MIN_MM, Math.min(SIG_MAX_MM, h));
      const maxW = (1 - pos.x) * pagePtW / MM_TO_PT;
      const maxH = (1 - pos.y) * pagePtH / MM_TO_PT;
      w = Math.min(w, maxW);
      h = Math.min(h, maxH);
      last = { w, h };
      setWidthMm(w);
      setHeightMm(h);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      if (last.w !== startW || last.h !== startH) {
        commit({ width_mm: last.w, height_mm: last.h });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  return <div style={{ background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Положение на титульном листе</div>
      {savedFlash && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Сохранено</span>}
      {busy && !savedFlash && <span style={{ fontSize: 12, color: T.textMuted }}>Сохранение…</span>}
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
      Тяните рамку, чтобы передвинуть. Угол снизу справа — изменить размер (с зажатым Shift — пропорционально). Когда подпись выделена, стрелки на клавиатуре — попиксельная подстройка. Текущий: {widthMm.toFixed(1)} × {heightMm.toFixed(1)} мм.
    </div>
    <div ref={wrapRef}
      onMouseDown={() => setSelected(false)}
      style={{
        position: "relative", width: "100%", maxWidth: 560,
        border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden",
        background: "#fff",
      }}>
      <img src={preview.image_data_url} alt="Титульник" draggable={false}
        style={{ display: "block", width: "100%", height: "auto", userSelect: "none", pointerEvents: "none" }} />
      {containerW > 0 && (
        <div
          onMouseDown={e => { e.stopPropagation(); setSelected(true); startDrag(e); }}
          style={{
            position: "absolute",
            left: pos.x * containerW,
            top: pos.y * previewH,
            width: sigPxW, height: sigPxH,
            background: `url(${sig.data_url}) center / 100% 100% no-repeat`,
            border: selected ? "2px dashed " + T.accent : "1px dashed #000",
            cursor: busy ? "wait" : (selected ? "grab" : "pointer"),
            opacity: 0.95,
          }}
          title={selected ? "Перетащите подпись" : "Кликните, чтобы выделить"}
        >
          {selected && (
            <div
              onMouseDown={startResize}
              title="Изменить размер (Shift — пропорционально)"
              style={{
                position: "absolute", right: -6, bottom: -6,
                width: 12, height: 12, background: T.accent,
                border: "2px solid #fff", borderRadius: 2,
                cursor: "nwse-resize",
              }}
            />
          )}
        </div>
      )}
    </div>
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
      Должность и ФИО лица, утверждающего РПД. Подставляются в шапку всех документов при скачивании.
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
