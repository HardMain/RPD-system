import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api/client.js";

/* ═══ THEME ═══ */
const T = {
  bg: "#f0ede8", surface: "#ffffff", border: "#c4bcb0", borderLight: "#ddd8d0",
  accent: "#6b4f8a", accentLight: "#e8dff4", accentDark: "#503a6e",
  orange: "#d97320", orangeLight: "#fef0e2", green: "#2f8a4e", greenLight: "#e4f4eb",
  red: "#c93c3c", text: "#2a231e", textMuted: "#78716a", textLight: "#a8a098",
  headerBg: "#322c28", headerText: "#f0ede8",
  selectedRow: "#e8dff4", tabActive: "#fff", tabInactive: "#e4e0d8", pdfBg: "#4a4d50",
  blue: "#3367d6", blueLight: "#e8f0fe",
};
const F = "'Segoe UI','Roboto',-apple-system,sans-serif";

/* ═══ SHARED UI ═══ */
const STATUS_MAP = {
  "Черновик": { bg: T.bg, c: T.textMuted, bc: T.border },
  "На доработке": { bg: T.orangeLight, c: T.orange, bc: T.orange },
  "На согласовании": { bg: T.accentLight, c: T.accent, bc: T.accent },
  "Согласовано": { bg: T.greenLight, c: T.green, bc: T.green },
};
function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP["Черновик"];
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: s.bg, color: s.c, border: "1px solid " + s.bc, whiteSpace: "nowrap" }}>{status}</span>;
}
function Btn({ children, onClick, primary, danger, small, disabled, style: sx }) {
  const bg = disabled ? T.borderLight : primary ? T.accent : danger ? T.red : T.surface;
  const col = disabled ? T.textMuted : (primary || danger) ? "#fff" : T.text;
  return <button onClick={disabled ? undefined : onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "4px 12px" : "7px 18px", border: "1px solid " + (primary ? "transparent" : danger ? T.red : T.border), borderRadius: 5, background: bg, color: col, cursor: disabled ? "default" : "pointer", fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: F, whiteSpace: "nowrap", ...sx }}>{children}</button>;
}
function Modal({ children, onClose, width }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(44,37,32,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 10, boxShadow: "0 20px 60px rgba(44,37,32,.25)", width: width || 480, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto" }}>{children}</div>
  </div>;
}
function TabBtn({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "6px 14px", border: "1px solid " + (active ? T.accent : T.border), borderBottom: active ? "2px solid " + T.accent : "1px solid transparent", borderRadius: "5px 5px 0 0", background: active ? T.accentLight : T.tabInactive, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? T.accent : T.text, fontFamily: F, whiteSpace: "nowrap" }}>{label}</button>;
}
function Spinner({ size = 20 }) { return <div style={{ width: size, height: size, border: "3px solid " + T.borderLight, borderTop: "3px solid " + T.accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} />; }
function Input({ label, value, onChange, type, placeholder, textarea, style: sx }) {
  const shared = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box", ...sx };
  return <div style={{ marginBottom: 12 }}>
    {label && <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>{label}</label>}
    {textarea ? <textarea value={value} onChange={onChange} placeholder={placeholder} style={{ ...shared, minHeight: 100, resize: "vertical" }} />
      : <input type={type || "text"} value={value} onChange={onChange} placeholder={placeholder} style={shared} />}
  </div>;
}

/* ═══ ICONS ═══ */
function BellIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>; }
function GearIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>; }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function DownloadIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function SparkleIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>; }
function TrashIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>; }

/* Table cell styles */
const td = { padding: 8, border: "1px solid " + T.borderLight, fontSize: 12 };
const th = { padding: 8, border: "1px solid " + T.border, background: T.bg, fontWeight: 700, textAlign: "left", fontSize: 12 };
const hdr = { padding: "10px 12px", borderBottom: "2px solid " + T.border, textAlign: "left", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: .5 };
const tcell = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight };

/* ═══ LOGIN ═══ */
function LoginPage({ onLogin }) {
  const [u, setU] = useState("ivanov"); const [p, setP] = useState("password"); const [err, setErr] = useState(""); const [ld, setLd] = useState(false);
  const go = async e => { e.preventDefault(); setLd(true); setErr(""); try { const r = await api.login(u, p); localStorage.setItem("token", r.data.access_token); onLogin(r.data.user); } catch { setErr("Неверные учётные данные"); } finally { setLd(false); } };
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}>
    <form onSubmit={go} style={{ background: T.surface, padding: 40, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.1)", width: 380 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ fontSize: 20, fontWeight: 700 }}>ПНИПУ</div><div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>ИС формирования РПД</div></div>
      <Input label="Логин" value={u} onChange={e => setU(e.target.value)} />
      <Input label="Пароль" value={p} onChange={e => setP(e.target.value)} type="password" />
      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
      <button type="submit" disabled={ld} style={{ width: "100%", padding: 10, border: "none", borderRadius: 6, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{ld ? "Вход..." : "Войти"}</button>
      <div style={{ fontSize: 11, color: T.textLight, textAlign: "center", marginTop: 16 }}>ivanov / password (препод) · petrov / password (зав. каф.) · admin / password (админ)</div>
    </form>
  </div>;
}

/* ═══ NOTIFICATION PANEL ═══ */
function NotifPanel({ show, onClose }) {
  const [ns, setNs] = useState([]);
  useEffect(() => { if (show) api.getNotifications().then(r => setNs(r.data)).catch(() => { }); }, [show]);
  if (!show) return null;
  const unread = ns.filter(n => !n.is_read).length;
  return <div style={{ position: "fixed", inset: 0, zIndex: 900 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 48, right: 16, width: 380, maxHeight: "70vh", background: T.surface, borderRadius: 10, border: "1px solid " + T.border, boxShadow: "0 12px 40px rgba(44,37,32,.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid " + T.borderLight, background: T.bg }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Уведомления {unread > 0 && <span style={{ background: T.accent, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{unread}</span>}</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: T.textMuted }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>{ns.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Нет уведомлений</div> : ns.map(n => <div key={n.id_notification} style={{ padding: "12px 16px", borderBottom: "1px solid " + T.borderLight, background: n.is_read ? T.surface : T.accentLight + "44" }}><div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>{n.created_at && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{new Date(n.created_at).toLocaleString("ru-RU")}</div>}</div>)}</div>
      {unread > 0 && <div style={{ padding: "10px 16px", borderTop: "1px solid " + T.borderLight, textAlign: "center" }}><span onClick={() => { api.readAllNotifications(); setNs(ns.map(n => ({ ...n, is_read: true }))); }} style={{ fontSize: 12, color: T.accent, cursor: "pointer", fontWeight: 600 }}>Прочитать все</span></div>}
    </div>
  </div>;
}

/* ═══ CREATE RPD MODAL ═══ */
function CreateRpdModal({ onClose, onCreated }) {
  const [dirs, setDirs] = useState([]); const [discs, setDiscs] = useState([]); const [archiveRpds, setArchiveRpds] = useState([]);
  const [dirId, setDirId] = useState(""); const [discId, setDiscId] = useState(""); const [year, setYear] = useState("2025/2026"); const [baseId, setBaseId] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.getDirections().then(r => setDirs(r.data)); api.getRpds({ status: "Согласовано" }).then(r => setArchiveRpds(r.data)).catch(() => { }); }, []);
  useEffect(() => { if (dirId) api.getDisciplines(dirId).then(r => setDiscs(r.data)); else setDiscs([]); }, [dirId]);
  const go = async () => {
    if (!discId) return; setLoading(true);
    try { const r = await api.createRpd({ id_discipline: +discId, academic_year: year, based_on_rpd_id: baseId ? +baseId : null }); onCreated(r.data); } catch { } setLoading(false);
  };
  return <Modal onClose={onClose} width={500}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.borderLight }}><div style={{ fontSize: 16, fontWeight: 700 }}>Создание РПД</div></div>
    <div style={{ padding: 20 }}>
      <Input label="Учебный год" value={year} onChange={e => setYear(e.target.value)} />
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Направление</label><select value={dirId} onChange={e => setDirId(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F }}><option value="">— Выбрать —</option>{dirs.map(d => <option key={d.id_direction} value={d.id_direction}>{d.code} {d.name}</option>)}</select></div>
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Дисциплина</label><select value={discId} onChange={e => setDiscId(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F }}><option value="">— Выбрать —</option>{discs.map(d => <option key={d.id_discipline} value={d.id_discipline}>{d.code} {d.name} (сем. {d.semester})</option>)}</select></div>
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>На основе архивной РПД (необязательно)</label><select value={baseId} onChange={e => setBaseId(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F }}><option value="">— Не копировать —</option>{archiveRpds.map(r => <option key={r.id_rpd} value={r.id_rpd}>{r.discipline_name} ({r.academic_year})</option>)}</select></div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid " + T.borderLight }}>
      <Btn onClick={onClose}>Отмена</Btn><Btn primary onClick={go} disabled={loading || !discId}>{loading ? "Создание..." : "Создать"}</Btn>
    </div>
  </Modal>;
}

/* ═══ RPD LIST ═══ */
function RpdListPage({ rpds, onOpen, onEdit, onCreate, onExportPdf, userRole }) {
  const canCreate = ["Зав. кафедрой", "Сотрудник УМУ", "Администратор"].includes(userRole);
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", flexShrink: 0, background: T.surface, borderBottom: "1px solid " + T.border }}>
      {canCreate ? <Btn small onClick={onCreate}><PlusIcon /> Создать РПД</Btn> : <div />}
      <span style={{ fontSize: 12, color: T.textMuted }}>{rpds.length} РПД</span>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
        <thead><tr style={{ background: T.surface }}>{["Направление", "Дисциплина", "Год", "Часы", "Семестр", "Статус", ""].map((h, i) => <th key={i} style={hdr}>{h}</th>)}</tr></thead>
        <tbody>{rpds.map(r => {
          const canEdit = r.status === "Черновик" || r.status === "На доработке";
          return <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
            <td style={tcell}>{r.direction_code}</td>
            <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.academic_year}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.total_hours || "-"}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.semester || "-"}</td>
            <td style={tcell}><Badge status={r.status} /></td>
            <td style={{ ...tcell, textAlign: "right", whiteSpace: "nowrap" }}>
              <div style={{ display: "inline-flex", gap: 4 }}>
                <button onClick={e => { e.stopPropagation(); onOpen(r); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 9px", border: "1px solid " + T.border, borderRadius: 4, background: T.surface, cursor: "pointer", fontSize: 11, fontWeight: 600, color: T.text, fontFamily: F }}>Просмотр</button>
                {canEdit && <button onClick={e => { e.stopPropagation(); onEdit(r); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 9px", border: "1px solid " + T.accent, borderRadius: 4, background: T.accentLight, cursor: "pointer", fontSize: 11, fontWeight: 600, color: T.accent, fontFamily: F }}><SparkleIcon /> Редакт.</button>}
                <button onClick={e => { e.stopPropagation(); onExportPdf(r.id_rpd); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 9px", border: "1px solid " + T.border, borderRadius: 4, background: T.surface, cursor: "pointer", fontSize: 11, fontWeight: 600, color: T.text, fontFamily: F }}><DownloadIcon /></button>
              </div>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

/* ═══ APPROVAL PAGE ═══ */
function ApprovalPage({ rpds, onOpen }) {
  const ar = rpds.filter(r => r.status === "На согласовании" || r.status === "На доработке");
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
        <thead><tr style={{ background: T.surface }}>{["Направление", "Дисциплина", "Год", "Статус", "Автор"].map(h => <th key={h} style={hdr}>{h}</th>)}</tr></thead>
        <tbody>{ar.map(r => <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
          <td style={tcell}>{r.direction_code}</td><td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td><td style={tcell}>{r.academic_year}</td><td style={tcell}><Badge status={r.status} /></td><td style={tcell}>{r.author_name}</td>
        </tr>)}</tbody>
      </table>
      {ar.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Нет РПД на согласовании</div>}
    </div>
  </div>;
}

/* ═══ RPD EDITOR ═══ */
const SEC_KEYS = ["title", "general", "goals", "results", "content", "topics", "edutech", "literature", "software", "mtech", "docs"];
const SEC_LABELS = { title: "Титульник", general: "Общие", goals: "Цели и задачи", results: "Результаты", content: "Содержание", topics: "Тематики", edutech: "Орг.-пед.", literature: "Литература", software: "ПО", mtech: "МТО", docs: "Документы" };

function RpdEditor({ rpdId, editMode, userRole, onBack, onExportPdf }) {
  const [rpd, setRpd] = useState(null); const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [editTexts, setEditTexts] = useState({}); const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(null); const [rejectComment, setRejectComment] = useState(""); const [validationErrors, setValidationErrors] = useState([]);
  const [activeSec, setActiveSec] = useState("title"); const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);
  const refs = Object.fromEntries(SEC_KEYS.map(k => [k, useRef(null)]));
  const isEdit = editMode; const isHead = userRole === "Зав. кафедрой";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRpd(rpdId); const r = res.data; setRpd(r);
      setEditTexts({ goals: r.goals_text || "", tasks: r.tasks_text || "", objects: r.objects_text || "", requirements: r.requirements_text || "", educational_tech: r.educational_tech || "", methodical_recommendations: r.methodical_recommendations || "" });
    } catch { } setLoading(false);
  }, [rpdId]);
  useEffect(() => { load(); }, [load]);

  // Scroll spy
  useEffect(() => {
    const c = scrollRef.current; if (!c) return; let raf = 0;
    function handler() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const top = c.getBoundingClientRect().top + 90; let found = SEC_KEYS[0]; for (const k of SEC_KEYS) { const el = refs[k].current; if (el && el.getBoundingClientRect().top <= top) found = k; } setActiveSec(p => p === found ? p : found); }); }
    c.addEventListener("scroll", handler, { passive: true }); return () => { c.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [loading]);

  function goTo(key) { const el = refs[key].current; const c = scrollRef.current; if (!el || !c) return; c.scrollTo({ top: c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 12, behavior: "smooth" }); }

  async function autoFill(key) {
    setGenerating(key);
    try {
      const res = await api.generateSection(rpdId, { section: key });
      const text = res.data.generated_text;
      const fieldMap = { goals: "goals", tasks: "tasks", objects: "objects", requirements: "requirements", educational_tech: "educational_tech", methodical_recommendations: "methodical_recommendations" };
      if (fieldMap[key]) setEditTexts(p => ({ ...p, [fieldMap[key]]: text }));
    } catch { } setGenerating(null);
  }

  async function handleSave() {
    setSaving(true);
    try { await api.updateRpd(rpdId, { goals_text: editTexts.goals, tasks_text: editTexts.tasks, objects_text: editTexts.objects, requirements_text: editTexts.requirements, educational_tech: editTexts.educational_tech, methodical_recommendations: editTexts.methodical_recommendations }); await load(); } catch { }
    setSaving(false);
  }

  function getValidationErrors() {
    const e = [];
    if (!editTexts.goals?.trim()) e.push({ secKey: "goals", label: "Цели дисциплины" });
    if (!editTexts.tasks?.trim()) e.push({ secKey: "goals", label: "Задачи дисциплины" });
    if (!editTexts.objects?.trim()) e.push({ secKey: "general", label: "Изучаемые объекты" });
    if (!editTexts.requirements?.trim()) e.push({ secKey: "general", label: "Входные требования" });
    if (!editTexts.educational_tech?.trim()) e.push({ secKey: "edutech", label: "Образовательные технологии" });
    if (!editTexts.methodical_recommendations?.trim()) e.push({ secKey: "edutech", label: "Методические рекомендации" });
    if (!rpd.sections?.length) e.push({ secKey: "content", label: "Содержание (нет ни одного раздела)" });
    if (!rpd.literature?.length) e.push({ secKey: "literature", label: "Литература (нет ни одного источника)" });
    return e;
  }
  async function handleSendApproval() {
    const errors = getValidationErrors();
    if (errors.length > 0) { setValidationErrors(errors); setModal("validation"); return; }
    setValidationErrors([]);
    await handleSave();
    try { await api.sendForApproval(rpdId); setModal("sent"); await load(); } catch { setModal("error"); }
  }
  async function handleReview(action) { try { await api.reviewRpd(rpdId, { action, comment: rejectComment }); setModal(action === "approve" ? "approved" : null); setRejectComment(""); await load(); } catch { } }

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}><Spinner size={40} /></div>;
  if (!rpd) return <div style={{ flex: 1, padding: 40, textAlign: "center", background: T.bg }}>РПД не найдена</div>;

  const canEdit = rpd.status === "Черновик" || rpd.status === "На доработке";

  function EditableBlock({ skey, label, fieldKey }) {
    const val = editTexts[fieldKey] || "";
    return <div><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {isEdit && canEdit && <div style={{ display: "flex", gap: 8 }}>
        <Btn small primary onClick={() => autoFill(skey)} disabled={!!generating}>{generating === skey ? "Генерация..." : "Автозаполнить"}</Btn>
        <Btn small onClick={() => setEditing(editing === skey ? null : skey)}>{editing === skey ? "Скрыть" : "Редактировать"}</Btn>
      </div>}
    </div>
      {generating === skey ? <div style={{ padding: 20, textAlign: "center", color: T.accent, fontSize: 13, border: "1px dashed " + T.accent, borderRadius: 6, background: T.accentLight }}>Генерация содержания с помощью LLM...</div>
        : editing === skey ? <textarea value={val} onChange={e => setEditTexts(p => ({ ...p, [fieldKey]: e.target.value }))} style={{ width: "100%", minHeight: 150, padding: 16, border: "1px solid " + T.accent, borderRadius: 6, background: "#fff", fontSize: 13, fontFamily: F, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          : <div style={{ padding: 16, border: "1px solid " + T.borderLight, borderRadius: 6, background: T.bg, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: 40 }}>{val || <span style={{ color: T.textMuted }}>Не заполнено</span>}</div>}
    </div>;
  }

  function HR() { return <div style={{ borderTop: "1px solid " + T.borderLight, margin: "32px 0" }} />; }

  /* ─── Inline section/literature editors ─── */
  function SectionEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ section_number: (rpd.sections?.length || 0) + 1, title: "", brief_content: "", lecture_hours: 0, practice_hours: 0, lab_hours: 0, self_study_hours: 0 });
    const addSec = async () => { try { await api.addSection(rpdId, form); setShowAdd(false); setForm({ section_number: (rpd.sections?.length || 0) + 2, title: "", brief_content: "", lecture_hours: 0, practice_hours: 0, lab_hours: 0, self_study_hours: 0 }); await load(); } catch { } };
    const delSec = async (id) => { if (confirm("Удалить раздел?")) { await api.deleteSection(id); await load(); } };
    return <div>
      {rpd.sections?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["#", "Раздел", "Лек", "Пр", "Лаб", "СРС", "Содержание", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.sections.map(s => <tr key={s.id_section}>
          <td style={{ ...td, textAlign: "center" }}>{s.section_number}</td><td style={{ ...td, fontWeight: 600 }}>{s.title}</td>
          <td style={{ ...td, textAlign: "center" }}>{s.lecture_hours}</td><td style={{ ...td, textAlign: "center" }}>{s.practice_hours}</td>
          <td style={{ ...td, textAlign: "center" }}>{s.lab_hours}</td><td style={{ ...td, textAlign: "center" }}>{s.self_study_hours}</td>
          <td style={{ ...td, fontSize: 11 }}>{s.brief_content || ""}</td>
          {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => delSec(s.id_section)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
        </tr>)}</tbody>
      </table> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Разделы не добавлены</div>}
      {isEdit && canEdit && <div style={{ marginTop: 12 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить раздел</Btn>
          : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input placeholder="Название" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F }} />
              {["lecture_hours", "practice_hours", "lab_hours", "self_study_hours"].map(k => <input key={k} type="number" placeholder={k.split("_")[0]} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: +e.target.value }))} style={{ width: 50, padding: "6px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, textAlign: "center" }} />)}
            </div>
            <input placeholder="Краткое содержание" value={form.brief_content} onChange={e => setForm(p => ({ ...p, brief_content: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={addSec}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
          </div>}
      </div>}
    </div>;
  }

  function LiteratureEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ source_type: "Основная", title: "", authors: "", year: 2024, publisher: "" });
    const addLit = async () => { try { await api.addLiterature(rpdId, form); setShowAdd(false); setForm({ source_type: "Основная", title: "", authors: "", year: 2024, publisher: "" }); await load(); } catch { } };
    const delLit = async (id) => { await api.deleteLiterature(id); await load(); };
    return <div>
      {rpd.literature?.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{rpd.literature.map((l, i) => <div key={l.id_literature} style={{ padding: "10px 14px", borderBottom: i < rpd.literature.length - 1 ? "1px solid " + T.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 13, fontWeight: 600 }}>{l.title}</div><div style={{ fontSize: 11, color: T.textMuted }}>{l.authors}{l.year ? ", " + l.year : ""}{l.publisher ? " — " + l.publisher : ""}</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge status={l.source_type === "Основная" ? "На согласовании" : "Черновик"} />{isEdit && canEdit && <button onClick={() => delLit(l.id_literature)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}</div>
      </div>)}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Литература не добавлена</div>}
      {isEdit && canEdit && <div style={{ marginTop: 12 }}>
        {!showAdd ? <div style={{ display: "flex", gap: 8 }}><Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn><Btn small primary onClick={() => autoFill("literature")} disabled={!!generating}><SparkleIcon /> Автоподбор</Btn></div>
          : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))} style={{ padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }}><option>Основная</option><option>Дополнительная</option></select>
              <input placeholder="Год" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} style={{ width: 70, padding: "6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />
            </div>
            <input placeholder="Авторы" value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input placeholder="Название" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input placeholder="Издательство" value={form.publisher} onChange={e => setForm(p => ({ ...p, publisher: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={addLit}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
          </div>}
      </div>}
    </div>;
  }

  function SoftwareEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: "", license_type: "", purpose: "" });
    const add = async () => { try { await api.addSoftware(rpdId, form); setShowAdd(false); setForm({ name: "", license_type: "", purpose: "" }); await load(); } catch { } };
    const del = async (id) => { await api.deleteSoftware(id); await load(); };
    return <div>
      {rpd.software?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["ПО", "Лицензия", "Назначение", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.software.map(s => <tr key={s.id_software}><td style={td}>{s.name}</td><td style={td}>{s.license_type}</td><td style={td}>{s.purpose}</td>{isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(s.id_software)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}</tr>)}</tbody>
      </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>ПО не добавлено</div>}
      {isEdit && canEdit && <div style={{ marginTop: 8 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
          : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input placeholder="Название ПО" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 150, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <input placeholder="Лицензия" value={form.license_type} onChange={e => setForm(p => ({ ...p, license_type: e.target.value }))} style={{ width: 120, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <input placeholder="Назначение" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} style={{ width: 150, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>✕</Btn>
          </div>}
      </div>}
    </div>;
  }

  function MtechEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ room_type: "", equipment: "" });
    const add = async () => { try { await api.addMaterialTech(rpdId, form); setShowAdd(false); setForm({ room_type: "", equipment: "" }); await load(); } catch { } };
    const del = async (id) => { await api.deleteMaterialTech(id); await load(); };
    return <div>
      {rpd.material_tech?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Тип помещения", "Оборудование", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.material_tech.map(m => <tr key={m.id_material_tech}><td style={td}>{m.room_type}</td><td style={td}>{m.equipment}</td>{isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(m.id_material_tech)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}</tr>)}</tbody>
      </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>МТО не добавлено</div>}
      {isEdit && canEdit && <div style={{ marginTop: 8 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
          : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input placeholder="Тип помещения" value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))} style={{ width: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <input placeholder="Оборудование" value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>✕</Btn>
          </div>}
      </div>}
    </div>;
  }

  function DocsUpload() {
    const fileRef = useRef(null);
    const handleUpload = async (e) => { const file = e.target.files[0]; if (!file) return; try { await api.uploadDocument(rpdId, file); await load(); } catch { } fileRef.current.value = ""; };
    const del = async (id) => { await api.deleteDocument(id); await load(); };
    return <div>
      {rpd.uploaded_documents?.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{rpd.uploaded_documents.map((d, i) => <div key={d.id_document} style={{ padding: "10px 14px", borderBottom: i < rpd.uploaded_documents.length - 1 ? "1px solid " + T.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><span style={{ fontSize: 13, fontWeight: 600 }}>{d.filename}</span><span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{d.file_size ? (d.file_size / 1024).toFixed(0) + " КБ" : ""}</span></div>
        {isEdit && <button onClick={() => del(d.id_document)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}
      </div>)}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Документы не загружены</div>}
      {isEdit && canEdit && <div style={{ marginTop: 12 }}><input ref={fileRef} type="file" onChange={handleUpload} accept=".pdf,.docx,.doc,.txt,.xlsx" style={{ display: "none" }} /><Btn small onClick={() => fileRef.current.click()}>Загрузить документ</Btn><span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>PDF, DOCX, TXT, XLSX (до 50 МБ)</span></div>}
    </div>;
  }

  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: 148, background: T.surface, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {isEdit && canEdit && <div style={{ padding: "5px 10px", background: T.orangeLight, borderBottom: "1px solid " + T.orange, fontSize: 10, fontWeight: 700, color: T.orange, textAlign: "center", letterSpacing: .3 }}>✏ РЕДАКТИРОВАНИЕ</div>}
        {(!isEdit || !canEdit) && !isHead && <div style={{ padding: "5px 10px", background: T.blueLight, borderBottom: "1px solid " + T.blue, fontSize: 10, fontWeight: 700, color: T.blue, textAlign: "center", letterSpacing: .3 }}>👁 ПРОСМОТР</div>}
        {isHead && rpd.status === "На согласовании" && <div style={{ padding: "5px 10px", background: T.accentLight, borderBottom: "1px solid " + T.accent, fontSize: 10, fontWeight: 700, color: T.accent, textAlign: "center", letterSpacing: .3 }}>📋 СОГЛАСОВАНИЕ</div>}
        <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>{SEC_KEYS.map(k => {
          const hasErr = validationErrors.length > 0 && validationErrors.some(e => e.secKey === k);
          return <button key={k} onClick={() => goTo(k)} style={{ display: "flex", width: "100%", padding: "8px 12px", border: "none", borderLeft: hasErr ? "3px solid " + T.red : activeSec === k ? "3px solid " + T.accent : "3px solid transparent", background: activeSec === k ? T.accentLight : "transparent", cursor: "pointer", fontSize: 11, fontFamily: F, fontWeight: activeSec === k ? 700 : 400, color: hasErr ? T.red : activeSec === k ? T.accent : T.text, justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>{SEC_LABELS[k]}{hasErr && <span style={{ fontSize: 7, color: T.red, flexShrink: 0 }}>●</span>}</button>;
        })}</div>
        <div style={{ borderTop: "1px solid " + T.borderLight, padding: "8px 12px", fontSize: 11, color: T.textMuted, flexShrink: 0 }}><Badge status={rpd.status} /></div>
      </div>
      {/* DOCUMENT */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 32px", background: T.bg }}>
        {isEdit && canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.orangeLight, border: "1px solid " + T.orange, color: T.orange, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>✏ Режим редактирования — изменения сохраняются кнопкой «Сохранить»</div>}
        {(!isEdit || !canEdit) && !isHead && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.blueLight, border: "1px solid " + T.blue, color: T.blue, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>👁 Режим просмотра — редактирование недоступно</div>}
        <div style={{ maxWidth: 820, margin: "0 auto", background: T.surface, border: "1px solid " + (isEdit && canEdit ? T.orange : T.borderLight), borderRadius: 4, boxShadow: isEdit && canEdit ? "0 2px 16px rgba(217,115,32,.12)" : "0 2px 8px rgba(0,0,0,.06)", padding: "40px 40px 60px" }}>
          {/* ТИТУЛЬНИК */}
          <div ref={refs.title} style={{ marginBottom: 32, textAlign: "center", paddingTop: 20, paddingBottom: 20 }}>
            <div style={{ fontSize: 11, marginBottom: 12, color: T.textMuted }}>Министерство науки и высшего образования Российской Федерации</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Пермский национальный исследовательский</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 30 }}>политехнический университет</div>
            <div style={{ marginTop: 40 }}>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Рабочая программа дисциплины</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{rpd.discipline_name}</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Направление: {rpd.direction_code} {rpd.direction_name}</div>
              {rpd.direction_profile && <div style={{ fontSize: 13, color: T.textMuted }}>Профиль: {rpd.direction_profile}</div>}
              <div style={{ fontSize: 13, color: T.textMuted }}>Учебный год: {rpd.academic_year} · Семестр: {rpd.semester || "-"} · Контроль: {rpd.control_form || "-"}</div>
            </div>
          </div>
          <HR />
          {/* ОБЩИЕ */}
          <div ref={refs.general} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>1. Общие положения</div>
            <div style={{ fontSize: 13, marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>Всего: <b>{rpd.total_hours || 0}</b> ч.</span><span>Лек: <b>{rpd.lecture_hours || 0}</b></span><span>Пр: <b>{rpd.practice_hours || 0}</b></span><span>Лаб: <b>{rpd.lab_hours || 0}</b></span><span>СРС: <b>{rpd.self_study_hours || 0}</b></span>
            </div>
            <EditableBlock skey="objects" label="1.2. Изучаемые объекты" fieldKey="objects" />
            <div style={{ marginTop: 20 }}><EditableBlock skey="requirements" label="1.3. Входные требования" fieldKey="requirements" /></div>
          </div>
          <HR />
          {/* ЦЕЛИ */}
          <div ref={refs.goals} style={{ marginBottom: 32 }}>
            <EditableBlock skey="goals" label="2. Цели дисциплины" fieldKey="goals" />
            <div style={{ marginTop: 20 }}><EditableBlock skey="tasks" label="2.1. Задачи дисциплины" fieldKey="tasks" /></div>
          </div>
          <HR />
          {/* РЕЗУЛЬТАТЫ */}
          <div ref={refs.results} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>3. Планируемые результаты обучения</div>
            {rpd.learning_outcomes?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Компетенция</th><th style={th}>Индикатор</th><th style={th}>Результаты обучения</th><th style={th}>Средство оценки</th></tr></thead>
              <tbody>{rpd.learning_outcomes.map(lo => <tr key={lo.id_outcome}><td style={td}>{lo.competency_code}</td><td style={td}>{lo.indicator_code}</td><td style={td}>{lo.outcome_text}</td><td style={td}>{lo.assessment_tool}</td></tr>)}</tbody>
            </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Результаты обучения не добавлены</div>}
          </div>
          <HR />
          {/* СОДЕРЖАНИЕ */}
          <div ref={refs.content} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>4. Содержание дисциплины</div>
              {isEdit && canEdit && <Btn small primary onClick={() => autoFill("content")} disabled={!!generating}>{generating === "content" ? "Генерация..." : "Сгенерировать"}</Btn>}
            </div>
            <SectionEditor />
          </div>
          <HR />
          {/* ТЕМАТИКИ */}
          <div ref={refs.topics} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>5. Тематики занятий</div>
            {rpd.sections?.some(s => s.topics?.length > 0) ? rpd.sections.filter(s => s.topics?.length > 0).map(s => <div key={s.id_section} style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Раздел {s.section_number}. {s.title}</div>{s.topics.map(t => <div key={t.id_topic} style={{ padding: "6px 12px", marginLeft: 16, borderLeft: "2px solid " + T.accent, marginBottom: 4, fontSize: 12 }}><b>{t.topic_type}:</b> {t.title} {t.hours ? `(${t.hours} ч.)` : ""}</div>)}</div>)
              : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Тематики формируются из разделов</div>}
          </div>
          <HR />
          {/* ОРГ.-ПЕД. */}
          <div ref={refs.edutech} style={{ marginBottom: 32 }}>
            <EditableBlock skey="educational_tech" label="6. Образовательные технологии" fieldKey="educational_tech" />
            <div style={{ marginTop: 20 }}><EditableBlock skey="methodical_recommendations" label="6.1. Методические рекомендации" fieldKey="methodical_recommendations" /></div>
          </div>
          <HR />
          {/* ЛИТЕРАТУРА */}
          <div ref={refs.literature} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>7. Учебно-методическое обеспечение</div>
            <LiteratureEditor />
          </div>
          <HR />
          {/* ПО */}
          <div ref={refs.software} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>8. Программное обеспечение</div>
            <SoftwareEditor />
          </div>
          <HR />
          {/* МТО */}
          <div ref={refs.mtech} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>9. Материально-техническое обеспечение</div>
            <MtechEditor />
          </div>
          <HR />
          {/* ДОКУМЕНТЫ */}
          <div ref={refs.docs} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Загруженные документы (контекст для LLM)</div>
            <DocsUpload />
          </div>
          {/* ИСТОРИЯ */}
          {rpd.approvals?.length > 0 && <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>История согласования</div>
            {rpd.approvals.map(a => <div key={a.id_approval} style={{ padding: "8px 0", borderBottom: "1px solid " + T.borderLight, fontSize: 12 }}>
              <span style={{ color: T.textMuted }}>{a.created_at ? new Date(a.created_at).toLocaleString("ru-RU") : ""}</span> — <b>{a.reviewer_name}</b> — <Badge status={a.status} />
              {a.comment && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{a.comment}</div>}
            </div>)}
          </div>}
        </div>
        <div style={{ height: 300 }} />
      </div>
    </div>
    {/* Bottom bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", flexShrink: 0, background: T.surface, borderTop: "1px solid " + T.border }}>
      <Btn small onClick={onBack}>← Назад</Btn>
      <Btn small onClick={() => onExportPdf(rpdId)}><DownloadIcon /> PDF</Btn>
      {isEdit && canEdit && !isHead && <><Btn small onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Btn><div style={{ flex: 1 }} /><Btn primary onClick={handleSendApproval}>Отправить на согласование</Btn></>}
      {isHead && rpd.status === "На согласовании" && <><div style={{ flex: 1 }} /><Btn primary onClick={() => handleReview("approve")}>Согласовать</Btn><Btn danger onClick={() => setModal("reject")}>На доработку</Btn></>}
      {(!isEdit || !canEdit) && !isHead && <><div style={{ flex: 1 }} /><span style={{ fontSize: 12, color: T.textMuted }}>Режим просмотра</span></>}
    </div>
    {/* Modals */}
    {modal === "sent" && <Modal onClose={() => setModal(null)} width={400}><div style={{ padding: 24, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 16 }}>РПД отправлена на согласование</div><Btn primary onClick={() => setModal(null)}>Ок</Btn></div></Modal>}
    {modal === "error" && <Modal onClose={() => setModal(null)} width={440}><div style={{ padding: 24, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: T.orange, marginBottom: 16 }}>Ошибка при отправке</div><div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>Проверьте заполненность разделов</div><Btn primary onClick={() => setModal(null)}>Ок</Btn></div></Modal>}
    {modal === "approved" && <Modal onClose={() => setModal(null)} width={400}><div style={{ padding: 24, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 16 }}>РПД согласована</div><Btn primary onClick={() => { setModal(null); onBack(); }}>Ок</Btn></div></Modal>}
    {modal === "reject" && <Modal onClose={() => setModal(null)} width={440}><div style={{ padding: 24 }}><div style={{ fontSize: 16, fontWeight: 700, color: T.orange, marginBottom: 16, textAlign: "center" }}>Возврат на доработку</div><textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} style={{ width: "100%", height: 120, border: "1px solid " + T.border, borderRadius: 6, padding: 12, fontSize: 13, fontFamily: F, resize: "vertical", outline: "none", boxSizing: "border-box" }} placeholder="Укажите причину..." /><div style={{ textAlign: "center", marginTop: 16 }}><Btn primary onClick={() => { handleReview("reject"); setModal(null); }}>Отправить</Btn></div></div></Modal>}
    {modal === "validation" && <Modal onClose={() => setModal(null)} width={460}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: T.orange }}>Нельзя отправить на согласование</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Заполните все обязательные разделы</div></div>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {validationErrors.map((e, i) => <div key={i} onClick={() => { goTo(e.secKey); setModal(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 5, marginBottom: 4, background: T.bg, border: "1px solid " + T.borderLight, cursor: "pointer" }}
          onMouseEnter={ev => ev.currentTarget.style.borderColor = T.accent}
          onMouseLeave={ev => ev.currentTarget.style.borderColor = T.borderLight}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: T.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>✕</span>
          <span style={{ fontSize: 13, flex: 1 }}>{e.label}</span>
          <span style={{ fontSize: 11, color: T.accent }}>перейти →</span>
        </div>)}
      </div>
      <div style={{ padding: "10px 20px", borderTop: "1px solid " + T.borderLight, textAlign: "center" }}><Btn primary onClick={() => setModal(null)}>Закрыть</Btn></div>
    </Modal>}
  </div>;
}

/* ═══ SYSTEM INFO ═══ */
function SystemInfoPage() {
  const [h, setH] = useState(null); useEffect(() => { api.getHealth().then(r => setH(r.data)).catch(() => { }); }, []);
  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}><div style={{ maxWidth: 640, margin: "0 auto" }}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Системная информация</div>
    {[{ title: "Статус", rows: [["Сервер", h ? "online" : "...", h ? T.green : T.orange], ["LLM", "demo-режим", T.orange], ["Версия", h?.version || "1.0.0"]] }, { title: "О системе", rows: [["Организация", "ПНИПУ"], ["Модель LLM", "настраивается в .env"]] }].map(c => <div key={c.title} style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{c.title}</div>
      {c.rows.map(r => <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><span style={{ color: T.textMuted }}>{r[0]}</span><span style={{ color: r[2] || T.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{r[2] && <span style={{ width: 8, height: 8, borderRadius: 4, background: r[2], display: "inline-block" }} />}{r[1]}</span></div>)}
    </div>)}
  </div></div>;
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("my");
  const [rpds, setRpds] = useState([]); const [openRpds, setOpenRpds] = useState([]); const [activeRpdId, setActiveRpdId] = useState(null);
  const [showNotif, setShowNotif] = useState(false); const [showCreate, setShowCreate] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { const t = localStorage.getItem("token"); if (t) { api.getMe().then(r => { setUser(r.data); }).catch(() => localStorage.removeItem("token")).finally(() => setChecking(false)); } else setChecking(false); }, []);

  const loadRpds = useCallback(async () => { try { const r = await api.getRpds(); setRpds(r.data); } catch { } }, []);
  useEffect(() => { if (user) { loadRpds(); api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { }); } }, [user, loadRpds]);

  function openRpdFn(rpd, editMode) {
    setOpenRpds(prev => { const ex = prev.find(r => r.id_rpd === rpd.id_rpd); if (ex) return prev.map(r => r.id_rpd === rpd.id_rpd ? { ...r, editMode } : r); return [...prev, { ...rpd, editMode }]; });
    setActiveRpdId(rpd.id_rpd); setActiveTab("edit");
  }
  function closeRpdTab(rpdId) {
    const next = openRpds.filter(r => r.id_rpd !== rpdId);
    setOpenRpds(next); loadRpds();
    if (activeRpdId === rpdId) { if (next.length > 0) { setActiveRpdId(next[next.length - 1].id_rpd); } else { setActiveRpdId(null); setActiveTab("my"); } }
  }

  async function handleExportPdf(rpdId) {
    try { const r = await api.exportPdf(rpdId); const url = window.URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = `RPD_${rpdId}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch { alert("Ошибка экспорта PDF"); }
  }

  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); setOpenRpds([]); setActiveRpdId(null); };

  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}><Spinner size={40} /></div>;
  if (!user) return <LoginPage onLogin={u => setUser(u)} />;

  const role = user.role;
  const isHead = role === "Зав. кафедрой"; const isAdmin = role === "Администратор";
  const navTabs = [
    { id: "my", label: `Мои РПД (${rpds.length})` },
    isHead ? { id: "approval", label: "Согласование" } : { id: "onApproval", label: `На согласов. (${rpds.filter(r => r.status === "На согласовании").length})` },
    { id: "archive", label: `Архив (${rpds.filter(r => r.status === "Согласовано").length})` },
    { id: "system", label: "Система" },
  ];

  return <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: F, color: T.text, background: T.bg }}>
    <style>{"*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}html,body{overflow:hidden;height:100%}::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:" + T.bg + "}::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:5px;border:2px solid " + T.bg + "}::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}"}</style>

    {/* TopBar */}
    <div style={{ flexShrink: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 44, background: T.headerBg, color: T.headerText }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontWeight: 700, fontSize: 14 }}>ПНИПУ</span><span style={{ opacity: .5 }}>|</span><span style={{ fontSize: 13 }}>Рабочие программы дисциплин</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setShowNotif(!showNotif)} style={{ position: "relative", border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: T.headerText }}><BellIcon />{unreadCount > 0 && <span style={{ position: "absolute", top: -2, right: -4, background: T.red, color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{unreadCount}</span>}</button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.2)" }} />
          <span style={{ fontSize: 12, opacity: .7, padding: "2px 8px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4 }}>{role}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</span>
          <button onClick={handleLogout} style={{ border: "none", background: "none", color: T.headerText, cursor: "pointer", fontSize: 12, opacity: .7 }}>Выйти</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "0 12px", paddingTop: 6, background: T.bg, borderBottom: "1px solid " + T.border }}>
        {navTabs.map(t => <TabBtn key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>
      {openRpds.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 12px 0", background: T.bg, borderBottom: "1px solid " + T.border, overflowX: "auto" }}>
        <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4, flexShrink: 0 }}>Открытые РПД:</span>
        {openRpds.map(r => { const isA = activeTab === "edit" && activeRpdId === r.id_rpd; return <div key={r.id_rpd} onClick={() => { setActiveRpdId(r.id_rpd); setActiveTab("edit"); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: "5px 5px 0 0", background: isA ? T.surface : T.tabInactive, border: "1px solid " + (isA ? T.accent : T.border), borderBottom: isA ? "2px solid " + T.accent : "1px solid transparent", cursor: "pointer", fontSize: 11, fontWeight: isA ? 700 : 400, color: isA ? T.accent : T.text, flexShrink: 0 }}><span style={{ fontSize: 10, opacity: 0.6 }}>[{r.editMode ? "E" : "V"}]</span><span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.direction_code} {r.discipline_name} {r.academic_year}</span><span onClick={e => { e.stopPropagation(); closeRpdTab(r.id_rpd); }} style={{ cursor: "pointer", marginLeft: 4, opacity: 0.5, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>✕</span></div>; })}
      </div>}
    </div>

    {/* Pages */}
    {activeTab === "my" && <RpdListPage rpds={rpds} onOpen={r => openRpdFn(r, false)} onEdit={r => openRpdFn(r, true)} onCreate={() => setShowCreate(true)} onExportPdf={handleExportPdf} userRole={role} />}
    {activeTab === "approval" && <ApprovalPage rpds={rpds} onOpen={r => openRpdFn(r, true)} />}
    {activeTab === "onApproval" && <div style={{ flex: 1, overflow: "auto", padding: 16, background: T.bg }}>{rpds.filter(r => r.status === "На согласовании").map(r => <div key={r.id_rpd} onClick={() => openRpdFn(r, false)} style={{ padding: "12px 16px", background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}><div><div style={{ fontWeight: 600, fontSize: 13 }}>{r.discipline_name}</div><div style={{ fontSize: 11, color: T.textMuted }}>{r.direction_code} — {r.academic_year}</div></div><Badge status={r.status} /></div>)}{rpds.filter(r => r.status === "На согласовании").length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Нет РПД на согласовании</div>}</div>}
    {activeTab === "archive" && <div style={{ flex: 1, overflow: "auto", padding: 16, background: T.bg }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}><thead><tr style={{ background: T.surface }}>{["Дисциплина", "Год", "Автор", "Статус"].map(h => <th key={h} style={hdr}>{h}</th>)}</tr></thead>
        <tbody>{rpds.filter(r => r.status === "Согласовано").map(r => <tr key={r.id_rpd} onClick={() => openRpdFn(r, false)} style={{ background: T.surface, cursor: "pointer" }}><td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td><td style={tcell}>{r.academic_year}</td><td style={tcell}>{r.author_name}</td><td style={tcell}><Badge status={r.status} /></td></tr>)}</tbody></table>
    </div>}
    {activeTab === "system" && <SystemInfoPage />}
    {activeTab === "edit" && (() => { const r = openRpds.find(x => x.id_rpd === activeRpdId); return r ? <RpdEditor key={r.id_rpd} rpdId={r.id_rpd} editMode={r.editMode} userRole={role} onBack={() => closeRpdTab(r.id_rpd)} onExportPdf={handleExportPdf} /> : null; })()}

    <NotifPanel show={showNotif} onClose={() => { setShowNotif(false); api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { }); }} />
    {showCreate && <CreateRpdModal onClose={() => setShowCreate(false)} onCreated={(r) => { setShowCreate(false); loadRpds(); openRpdFn(r, true); }} />}
  </div>;
}
