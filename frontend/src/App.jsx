import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api/client.js";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfJsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

// Используем bundled-воркер (Vite сам собирает его как Web Worker с правильным MIME)
pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker();

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
function SparkleIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>; }
function TrashIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>; }

/* PDF toolbar button */
const pdfToolBtn = (disabled) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 24, padding: 0, border: "1px solid " + T.border, borderRadius: 4, background: disabled ? T.borderLight : T.surface, color: disabled ? T.textLight : T.text, cursor: disabled ? "default" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: F });

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
        <thead><tr style={{ background: T.surface }}>{["Направление", "Дисциплина", "Год", "Часы", "Семестр", "Статус", "", "", ""].map((h, i) => <th key={i} style={hdr}>{h}</th>)}</tr></thead>
        <tbody>{rpds.map(r => {
          const canEdit = r.status === "Черновик" || r.status === "На доработке";
          const actCell = { ...tcell, textAlign: "center", width: 1, whiteSpace: "nowrap", padding: "10px 6px" };
          const btnBase = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "3px 9px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: F };
          return <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
            <td style={tcell}>{r.direction_code}</td>
            <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.academic_year}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.total_hours || "-"}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.semester || "-"}</td>
            <td style={tcell}><Badge status={r.status} /></td>
            <td style={actCell}>
              <button onClick={e => { e.stopPropagation(); onOpen(r); }} style={{ ...btnBase, border: "1px solid " + T.border, background: T.surface, cursor: "pointer", color: T.text }}>Просмотр</button>
            </td>
            <td style={actCell}>
              <button onClick={canEdit ? (e => { e.stopPropagation(); onEdit(r); }) : undefined} disabled={!canEdit} title={canEdit ? "" : "Нельзя редактировать в текущем статусе"} style={{ ...btnBase, border: "1px solid " + (canEdit ? T.accent : T.borderLight), background: canEdit ? T.accentLight : T.borderLight, color: canEdit ? T.accent : T.textLight, cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.7 }}><SparkleIcon /> Редакт.</button>
            </td>
            <td style={actCell}>
              <button onClick={e => { e.stopPropagation(); onExportPdf(r.id_rpd); }} title="Скачать PDF" style={{ ...btnBase, border: "1px solid " + T.border, background: T.surface, cursor: "pointer", color: T.text }}><DownloadIcon /></button>
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
/* Структура подразделов 1:1 с шаблоном rpd_template.docx.
   READ_ONLY — заполняются автоматически: title из БУП, "3" из БУП (часы), "8" из ФОС. */
const SEC_KEYS = [
  "title",
  "1.1", "1.2", "1.3",
  "2",
  "3",
  "4", "4.1", "4.2",
  "5.1", "5.2",
  "6.1", "6.2", "6.3", "6.4",
  "7",
  "8",
  "docs",
];
const SEC_LABELS = {
  title: "Титульник",
  "1.1": "1.1 Цели и задачи",
  "1.2": "1.2 Изучаемые объекты",
  "1.3": "1.3 Входные требования",
  "2":   "2. Результаты обучения",
  "3":   "3. Объём и виды работ",
  "4":   "4. Содержание",
  "4.1": "Тематика лаб. работ",
  "4.2": "Тематика практ. занятий",
  "5.1": "5.1 Обр. технологии",
  "5.2": "5.2 Методические указания",
  "6.1": "6.1 Печатная литература",
  "6.2": "6.2 Электронная литература",
  "6.3": "6.3 БД и ИСС",
  "6.4": "6.4 ПО",
  "7":   "7. МТО",
  "8":   "8. ФОС",
  docs:  "Документы (LLM)",
};
const READ_ONLY_KEYS = new Set(["title", "3", "8"]);
/* Подразделы — отображаются в сайдбаре с отступом, без жирного номера */
const SUB_KEYS = new Set(["4.1", "4.2"]);
/* Разделы, отображаемые в боковой панели (без служебной вкладки «Документы (LLM)»,
   т.к. её нет в реальном PDF — это лишь контекст для LLM) */
const SIDEBAR_KEYS = SEC_KEYS.filter(k => k !== "docs");
/* Грубая привязка разделов к страницам PDF — используется только как fallback,
   пока не завершено динамическое сканирование текста PDF.
   Значение: { page, y } — y в исходных PDF-единицах от верха страницы (0 = к началу страницы) */
const PDF_PAGE_MAP_FALLBACK = {
  title: { page: 1, y: 0 },
  "1.1": { page: 2, y: 0 }, "1.2": { page: 2, y: 0 }, "1.3": { page: 2, y: 0 },
  "2":   { page: 3, y: 0 },
  "3":   { page: 4, y: 0 },
  "4":   { page: 4, y: 0 }, "4.1": { page: 6, y: 0 }, "4.2": { page: 6, y: 0 },
  "5.1": { page: 7, y: 0 }, "5.2": { page: 7, y: 0 },
  "6.1": { page: 8, y: 0 }, "6.2": { page: 8, y: 0 }, "6.3": { page: 9, y: 0 }, "6.4": { page: 9, y: 0 },
  "7":   { page: 9, y: 0 },
  "8":   { page: 10, y: 0 },
};
/* Регулярки для распознавания заголовков разделов в извлечённом тексте PDF.
   PDF.js конкатенирует строки с пробелами — допускаем различное кол-во пробелов и точек. */
const PDF_SECTION_PATTERNS = [
  { key: "1.1", re: /1[.\s]+1[.\s]+Цели/i },
  { key: "1.2", re: /1[.\s]+2[.\s]+Изучаемые/i },
  { key: "1.3", re: /1[.\s]+3[.\s]+Входные/i },
  { key: "2",   re: /(?:^|[\s.])2[.\s]+Планируемые\s+результаты/i },
  { key: "3",   re: /(?:^|[\s.])3[.\s]+Объ[её]м\s+и\s+виды/i },
  { key: "4",   re: /(?:^|[\s.])4[.\s]+Содержание\s+дисциплины/i },
  // В шаблоне ПНИПУ заголовки идут без префикса "4.1/4.2" — просто
  // "Тематика примерных лабораторных работ" / "Тематика примерных практических занятий".
  { key: "4.1", re: /(?:4[.\s]+1[.\s]+(?:Тематика|Лабораторн|Перечень\s+(?:тем\s+)?лабораторн)|Тематика\s+(?:примерных\s+)?лабораторн|Перечень\s+(?:тем\s+)?лабораторн)/i },
  { key: "4.2", re: /(?:4[.\s]+2[.\s]+(?:Тематика|Практическ|Перечень\s+(?:тем\s+)?практическ)|Тематика\s+(?:примерных\s+)?практическ|Перечень\s+(?:тем\s+)?практическ)/i },
  { key: "5.1", re: /5[.\s]+1[.\s]+Образовательные/i },
  { key: "5.2", re: /5[.\s]+2[.\s]+Методические/i },
  { key: "6.1", re: /6[.\s]+1[.\s]+(?:Печатная|Основная|Учебно[-\s]*методическ|Учебная)/i },
  { key: "6.2", re: /6[.\s]+2[.\s]+(?:Электронная|Дополнительн)/i },
  { key: "6.3", re: /6[.\s]+3[.\s]+(?:Современные|Базы|Профессиональные|Перечень\s+(?:информац|профессион))/i },
  { key: "6.4", re: /6[.\s]+4[.\s]+(?:Лицензионное|Программное|Перечень\s+(?:лицензион|программн))/i },
  { key: "7",   re: /(?:^|[\s.])7[.\s]+Материально/i },
  { key: "8",   re: /(?:^|[\s.])8[.\s]+Фонд\s+оценочных/i },
];
async function scanPdfForSections(pdfDoc) {
  const map = { title: { page: 1, y: 0 } };
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    // 1) Поэлементный поиск — даёт точную Y-координату заголовка
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      for (const { key, re } of PDF_SECTION_PATTERNS) {
        if (key in map) continue;
        if (re.test(item.str)) {
          const yFromTop = Math.max(0, viewport.height - (item.transform?.[5] ?? viewport.height));
          map[key] = { page: i, y: yFromTop };
        }
      }
    }
    // 2) Построчный поиск — на случай, когда заголовок разбит PDF.js на несколько items
    const lineMap = new Map(); // yKey -> { text, y }
    for (const item of tc.items) {
      if (!item.str) continue;
      const y = item.transform?.[5];
      if (typeof y !== "number") continue;
      const yKey = Math.round(y);
      const cur = lineMap.get(yKey);
      lineMap.set(yKey, { text: cur ? cur.text + " " + item.str : item.str, y });
    }
    for (const { text, y } of lineMap.values()) {
      for (const { key, re } of PDF_SECTION_PATTERNS) {
        if (key in map) continue;
        if (re.test(text)) {
          const yFromTop = Math.max(0, viewport.height - y);
          map[key] = { page: i, y: yFromTop };
        }
      }
    }
  }
  return map;
}

function RpdEditor({ rpdId, tabId, editMode, hasPair = false, reloadKey = 0, onAfterSave, onOpenPair, userRole, onBack, onExportPdf, onToggleMode, isActive = true }) {
  const [rpd, setRpd] = useState(null); const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [editTexts, setEditTexts] = useState({}); const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(null); const [rejectComment, setRejectComment] = useState(""); const [validationErrors, setValidationErrors] = useState([]);
  // У каждого режима — своя «активная вкладка»: при переключении просмотр ↔ редактирование
  // в сайдбаре сразу подсвечивается последняя секция этого режима, а не «протекает» из другого.
  const [activeSecPdf, setActiveSecPdf] = useState("title");
  const [activeSecEdit, setActiveSecEdit] = useState("title");
  const [saving, setSaving] = useState(false);
  const [pdfData, setPdfData] = useState(null); const [pdfLoading, setPdfLoading] = useState(false); const [pdfError, setPdfError] = useState(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.1);
  const [pdfSectionMap, setPdfSectionMap] = useState(PDF_PAGE_MAP_FALLBACK);
  const [sidebarW, setSidebarW] = useState(220);
  const [pageInputValue, setPageInputValue] = useState(1);
  const flashTimeoutRef = useRef(null);
  const pdfScrollRef = useRef(null);
  const pdfPageRefs = useRef({});
  const pdfPageObserverRef = useRef(null);
  const pdfScrollPosRef = useRef(0);
  const editScrollPosRef = useRef(0);
  // Сохранённая ДО ручного/внешнего reload позиция скролла. Нужно потому, что pdfData=null
  // или setLoading(true) обнуляют DOM/контент, и автоклэмп scrollTop=0 затирает обычные
  // pdfScrollPosRef/editScrollPosRef через onScroll. Тег режима защищает от случая, когда
  // pending был сохранён в одном режиме, а юзер успел переключиться в другой.
  const pendingScrollRestoreRef = useRef(null); // { mode: "pdf"|"edit", value: number } | null
  // Цель текущего программного скролла в PDF-режиме (клик по разделу в сайдбаре):
  // { key, top, deadline }. Пока ref не nil — scroll-spy не пересчитывает activeSec, а удерживает
  // подсветку на key. Снимается, когда scrollTop ≈ top (приехали) или истёк deadline.
  const pdfNavTargetRef = useRef(null);
  // true, пока tryRestore тащит scrollTop к целевой позиции после смены режима/
  // возврата на вкладку. Сбрасывается ровно когда восстановление завершилось
  // (scrollHeight дорос и scrollTop встал на target) или исчерпан лимит попыток.
  const restoringScrollRef = useRef(false);
  const preferredActiveSecRef = useRef(null);
  // Цель текущего программного скролла в edit-режиме: { key, top, deadline }.
  // flash-рамка у раздела запускается, когда scrollTop приехал к top (или истёк deadline).
  const pendingFlashRef = useRef(null);
  const pageInputFocusedRef = useRef(false);
  const resizingRef = useRef(false);
  const scrollRef = useRef(null);
  // PDF считается «грязным» (требует перерендера на сервере), если данные РПД
  // могли поменяться: после load() с сервера, сохранения, изменения статуса
  // или явного нажатия «↻ Обновить». Между переключениями режима без правок
  // PDF переиспользуется — серверный рендер не дёргается заново.
  const pdfDirtyRef = useRef(true);
  const initialLoadRef = useRef(true);
  const refs = Object.fromEntries(SEC_KEYS.map(k => [k, useRef(null)]));
  const isEdit = editMode; const isHead = userRole === "Зав. кафедрой";
  const showPdf = !isEdit;
  const activeSec = showPdf ? activeSecPdf : activeSecEdit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRpd(rpdId); const r = res.data; setRpd(r);
      setEditTexts({ goals: r.goals_text || "", tasks: r.tasks_text || "", objects: r.objects_text || "", requirements: r.requirements_text || "", educational_tech: r.educational_tech || "", methodical_recommendations: r.methodical_recommendations || "" });
      // Первый load при монтировании компонента не помечает PDF грязным
      // (PDF и так ещё не загружен). Все последующие load() — это перечитывание
      // после изменений, поэтому PDF на сервере мог обновиться.
      if (initialLoadRef.current) initialLoadRef.current = false;
      else pdfDirtyRef.current = true;
    } catch { } setLoading(false);
  }, [rpdId]);
  useEffect(() => { load(); }, [load]);

  const reloadPdf = useCallback(() => {
    // Захватываем актуальный scrollTop ДО setPdfData(null) → иначе автоклэмп схлопнувшегося
    // контейнера сбросит pdfScrollPosRef в 0 через onScroll-хендлер, и восстанавливать будет нечего.
    const c = pdfScrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: "pdf", value: c.scrollTop };
    pdfDirtyRef.current = true;
    setPdfReloadKey(k => k + 1);
  }, []);

  // Внешний триггер «перечитать всё» (например, парная edit-вкладка сохранилась → notifyRpdChanged
  // у App'а инкрементит reloadKey этой view-вкладки). На первом монтировании ничего не делаем —
  // load() уже отрабатывает в основном эффекте. Скролл сохраняется автоматически:
  // pdfScrollPosRef / editScrollPosRef хранят последнюю позицию, а restoration-эффект
  // ниже сам её восстановит, как только pdfData/loading изменятся после перезагрузки.
  const initialReloadRef = useRef(true);
  useEffect(() => {
    if (initialReloadRef.current) { initialReloadRef.current = false; return; }
    // Так же, как и при ручном reloadPdf: захватываем текущий scroll для текущего режима
    // ДО того, как load() сорвёт DOM в Spinner и автоклэмп сбросит scroll-ref в 0.
    const c = showPdf ? pdfScrollRef.current : scrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: showPdf ? "pdf" : "edit", value: c.scrollTop };
    load();
    if (showPdf) reloadPdf();
    else pdfDirtyRef.current = true;
  }, [reloadKey]);

  // PDF preview for view mode.
  // При showPdf=false (режим редактирования) PDF НЕ сбрасывается — blob URL
  // остаётся в памяти, и при возврате в режим просмотра компонент мгновенно
  // покажет уже загруженный документ без обращения к серверу.
  useEffect(() => {
    if (!showPdf) return;
    if (pdfData && !pdfDirtyRef.current) return; // PDF актуален — не дёргаем сервер
    let cancelled = false; let createdUrl = null; let transferred = false;
    setPdfLoading(true); setPdfError(null); setPdfData(null); setPdfNumPages(0); setPdfCurrentPage(1);
    setPdfSectionMap(PDF_PAGE_MAP_FALLBACK);
    pdfPageRefs.current = {};
    api.fetchPdfInline(rpdId).then(r => {
      if (cancelled) return;
      createdUrl = window.URL.createObjectURL(r.data);
      setPdfData(createdUrl);
      transferred = true;
      pdfDirtyRef.current = false;
    }).catch(() => { if (!cancelled) setPdfError("Не удалось сформировать PDF"); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => {
      cancelled = true;
      // Если blob успел уйти в state — освобождением займётся cleanup-эффект ниже,
      // здесь revoke только если запрос отменён ДО setPdfData.
      if (createdUrl && !transferred) try { window.URL.revokeObjectURL(createdUrl); } catch { }
    };
  }, [rpdId, showPdf, pdfReloadKey]);

  // Освобождение прошлого blob URL при смене pdfData и при размонтировании.
  useEffect(() => () => { if (pdfData) try { window.URL.revokeObjectURL(pdfData); } catch { } }, [pdfData]);

  // При переключении режима «Просмотр ↔ Редактирование» DOM скролл-контейнера
  // пересоздаётся (scrollTop=0). pendingFlashRef сбрасываем — он принадлежал
  // прошлой DOM-сессии. preferredActiveSecRef фиксируем на «активную вкладку
  // нового режима»: пока restoringScrollRef=true, scroll-spy будет держать её
  // и не «мигать» на «Титульник» по промежуточному scrollTop=0. Снятие флага
  // делает сам tryRestore — когда scrollTop реально встанет на цель.
  const initialModeRef = useRef(true);
  useEffect(() => {
    if (initialModeRef.current) { initialModeRef.current = false; return; }
    pendingFlashRef.current = null;
    preferredActiveSecRef.current = editMode ? activeSecEdit : activeSecPdf;
  }, [editMode]);

  // Track current page by observing which PDF page is centered in the scroll container.
  // IO держим в ref, чтобы page-узлы могли регистрироваться через ref-callback —
  // после edit→view DOM пересоздаётся, и обычный effect-подход с массовой подпиской
  // в один проход не успевал переподписаться на новые узлы (нумерация зависала).
  useEffect(() => {
    if (!showPdf) {
      if (pdfPageObserverRef.current) { pdfPageObserverRef.current.disconnect(); pdfPageObserverRef.current = null; }
      pdfPageRefs.current = {};
      return;
    }
    const root = pdfScrollRef.current; if (!root) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number(visible.target.getAttribute("data-page"));
        if (n) setPdfCurrentPage(n);
      }
    }, { root, threshold: [0.3, 0.6] });
    pdfPageObserverRef.current = obs;
    // Подписываемся на уже зарегистрированные узлы (если они есть).
    Object.values(pdfPageRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => { obs.disconnect(); if (pdfPageObserverRef.current === obs) pdfPageObserverRef.current = null; };
  }, [showPdf, pdfData]);

  // Ref-callback для каждой страницы: при mount регистрируется в текущем IO,
  // при unmount — отписывается. Так нумерация выживает любые ремонтажи DOM.
  // Кэшируем колбэки по n, чтобы их идентичность не менялась между рендерами
  // (иначе React-pdf отвязывал бы ref на каждом рендере).
  const pdfPageRefCallbacks = useRef({});
  const setPdfPageRef = useCallback((n) => {
    if (!pdfPageRefCallbacks.current[n]) {
      pdfPageRefCallbacks.current[n] = (el) => {
        const prev = pdfPageRefs.current[n];
        if (prev && prev !== el && pdfPageObserverRef.current) {
          try { pdfPageObserverRef.current.unobserve(prev); } catch { }
        }
        if (el) {
          pdfPageRefs.current[n] = el;
          if (pdfPageObserverRef.current) {
            try { pdfPageObserverRef.current.observe(el); } catch { }
          }
        } else {
          delete pdfPageRefs.current[n];
        }
      };
    }
    return pdfPageRefCallbacks.current[n];
  }, []);

  // Подсветка раздела сайдбара по реальной позиции скролла PDF (в режиме просмотра).
  // Активным считается раздел, чей заголовок ближе всего сверху относительно текущего скролла.
  useEffect(() => {
    if (!showPdf || !pdfNumPages) return;
    const c = pdfScrollRef.current; if (!c) return;
    let raf = 0;
    function compute() {
      // Пока идёт восстановление позиции после смены режима — держим preferred (если есть)
      // и НЕ трогаем activeSec по реальному scrollTop, иначе мелькнёт «Титульник» на scroll=0.
      if (restoringScrollRef.current) {
        const preferred = preferredActiveSecRef.current;
        if (preferred) setActiveSecPdf(p => p === preferred ? p : preferred);
        return;
      }
      // Пока активен программный smooth-скролл к разделу (клик по сайдбару),
      // держим подсвеченным целевой раздел. Снимаем фиксацию ровно когда scrollTop ≈ top
      // (а не по таймеру) — поэтому при долгом плавном скролле подсветка НЕ мигает на
      // промежуточных секциях, через которые пробегает viewport.
      const nav = pdfNavTargetRef.current;
      if (nav) {
        setActiveSecPdf(p => p === nav.key ? p : nav.key);
        if (Math.abs(c.scrollTop - nav.top) < 6 || Date.now() > nav.deadline) {
          pdfNavTargetRef.current = null;
          preferredActiveSecRef.current = null;
        }
        return;
      }
      const scrollTop = c.scrollTop;
      const probe = scrollTop + 60;
      let bestKey = "title", bestPos = -Infinity;
      for (const k of SIDEBAR_KEYS) {
        const sec = pdfSectionMap[k]; if (!sec) continue;
        const pageEl = pdfPageRefs.current[sec.page]; if (!pageEl) continue;
        const pos = pageEl.offsetTop + (sec.y || 0) * pdfScale;
        if (pos <= probe && pos > bestPos) { bestKey = k; bestPos = pos; }
      }
      setActiveSecPdf(p => p === bestKey ? p : bestKey);
      preferredActiveSecRef.current = null;
    }
    function handler() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    }
    c.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => { c.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [showPdf, pdfNumPages, pdfSectionMap, pdfScale, pdfData]);

  // Синхронизация значения поля ввода страницы с реальной текущей (если пользователь не печатает)
  useEffect(() => {
    if (pageInputFocusedRef.current) return;
    setPageInputValue(pdfCurrentPage);
  }, [pdfCurrentPage]);

  // Очистка таймера подсветки при размонтировании
  useEffect(() => () => { if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current); }, []);

  // Восстановление позиции скролла:
  //   • при возврате на вкладку с этой РПД,
  //   • при переключении режима «Просмотр ↔ Редактирование» (DOM скролл-контейнера
  //     пересоздаётся, scrollTop обнуляется — нужно вернуть сохранённое значение).
  // Высота контента может быть ещё не готова (react-pdf постранично рендерит документ),
  // поэтому пробуем восстановить scrollTop в течение нескольких кадров, пока scrollHeight
  // не «дорастёт» до нужной позиции.
  useEffect(() => {
    if (!isActive) return;
    // Сначала пробуем «pending»-цель (она заранее захвачена reloadPdf'ом или внешним reload-эффектом
    // ДО автоклэмпа). Если pending'а нет ИЛИ он от другого режима — fallback на обычный scroll-ref.
    const currentMode = showPdf ? "pdf" : "edit";
    const pending = pendingScrollRestoreRef.current;
    const usingPending = !!(pending && pending.mode === currentMode);
    const target = usingPending ? pending.value : (showPdf ? pdfScrollPosRef.current : editScrollPosRef.current);
    if (!target) {
      restoringScrollRef.current = false;
      if (usingPending) pendingScrollRestoreRef.current = null;
      return;
    }
    // Взводим флаг ДО планирования rAF: scroll-spy эффект (зарегистрирован выше)
    // в этом же цикле уже успеет дёрнуть свой rAF, и его compute() обязан увидеть
    // флаг до того, как пересчитает activeSec по scrollTop=0.
    restoringScrollRef.current = true;
    let raf = 0; let attempts = 0;
    // Лимит попыток — страховка на случай, если контейнер так и не дорастёт
    // до target (PDF не отрендерился). Цикл сам остановится, флаг снимется,
    // scroll-spy вернётся к работе по реальному scrollTop.
    const MAX_ATTEMPTS = 600;
    function tryRestore() {
      const c = showPdf ? pdfScrollRef.current : scrollRef.current;
      if (c) {
        const maxScroll = c.scrollHeight - c.clientHeight;
        if (maxScroll >= target) {
          if (c.scrollTop !== target) c.scrollTop = target;
          // onScroll затем обновит ref до target — ничего восстанавливать не нужно
          restoringScrollRef.current = false;
          if (usingPending) pendingScrollRestoreRef.current = null;
          return;
        }
        // Высота ещё не выросла — частично прокручиваем туда, куда сейчас можно
        // (так PDF не «прыгает» резко в самом конце), и продолжаем попытки.
        if (maxScroll > 0 && c.scrollTop < maxScroll) c.scrollTop = maxScroll;
      }
      if (++attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tryRestore);
      else { restoringScrollRef.current = false; if (usingPending) pendingScrollRestoreRef.current = null; }
    }
    raf = requestAnimationFrame(tryRestore);
    // ВАЖНО: cleanup НЕ чистит pendingScrollRestoreRef — pdfData во время reload меняется
    // дважды (blob → null → newBlob), эффект перезапускается, и следующий запуск должен
    // снова найти ту же pending-цель и продолжить восстанавливать.
    return () => { cancelAnimationFrame(raf); restoringScrollRef.current = false; };
  }, [isActive, showPdf, pdfData, pdfNumPages, loading]);

  // Scroll spy (only in edit mode). Если докрутили почти до конца — активируем последний sidebar-раздел,
  // даже если его нельзя «поднять» к самому верху (документ короче, чем нужно).
  // Во время программного smooth-скролла (после клика по вкладке) подсветка зафиксирована
  // через preferredActiveSecRef, и flash-рамка у целевого раздела запускается, когда скролл реально приехал.
  useEffect(() => {
    if (showPdf) return;
    const c = scrollRef.current; if (!c) return; let raf = 0;
    function handler() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Восстановление scrollTop после смены режима — держим прежний activeSec
        // и не подсвечиваем «Титульник» по промежуточным значениям scrollTop=0.
        if (restoringScrollRef.current) return;
        // Программный скролл активен — держим подсвеченным целевой раздел и ждём прибытия,
        // чтобы запустить flash-рамку у него только в момент остановки скролла.
        if (pendingFlashRef.current) {
          const { key, top: targetTop, deadline } = pendingFlashRef.current;
          setActiveSecEdit(p => p === key ? p : key);
          if (Math.abs(c.scrollTop - targetTop) < 6 || Date.now() > deadline) {
            const el = refs[key]?.current;
            pendingFlashRef.current = null;
            preferredActiveSecRef.current = null;
            if (el) flashElement(el);
          }
          return;
        }
        const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 4;
        const top = c.getBoundingClientRect().top + 90;
        let found = SIDEBAR_KEYS[0];
        for (const k of SIDEBAR_KEYS) {
          const el = refs[k].current;
          if (el && el.getBoundingClientRect().top <= top) found = k;
        }
        if (atBottom) found = SIDEBAR_KEYS[SIDEBAR_KEYS.length - 1];
        setActiveSecEdit(p => p === found ? p : found);
        // Реальный пользовательский скролл — сбрасываем «преференс» от прошлого
        // клика, чтобы он не оверрайдил подсветку при дальнейших движениях.
        preferredActiveSecRef.current = null;
      });
    }
    c.addEventListener("scroll", handler, { passive: true }); return () => { c.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [loading, showPdf]);

  function scrollToPdfPage(n, immediate = true) {
    const el = pdfPageRefs.current[n]; const c = pdfScrollRef.current;
    if (!el || !c) return;
    c.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    if (immediate) setPdfCurrentPage(n);
  }

  function scrollToPdfSection(key) {
    const sec = pdfSectionMap[key]; if (!sec) return null;
    const page = Math.min(sec.page || 1, pdfNumPages || sec.page || 1);
    const el = pdfPageRefs.current[page]; const c = pdfScrollRef.current;
    if (!el || !c) return null;
    const yPx = (sec.y || 0) * pdfScale;
    // Небольшой отступ сверху над заголовком — чтобы он не «прилипал» к верхней кромке viewport,
    // но и не открывался текст из предыдущего раздела.
    const top = Math.max(0, el.offsetTop + yPx - 18);
    c.scrollTo({ top, behavior: "smooth" });
    return { page, top };
  }

  function flashElement(el) {
    if (!el) return;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    el.classList.remove("sec-flash");
    void el.offsetWidth; // принудительный reflow — перезапуск анимации
    el.classList.add("sec-flash");
    flashTimeoutRef.current = setTimeout(() => { el.classList.remove("sec-flash"); }, 1600);
  }

  function goTo(key) {
    if (showPdf) {
      preferredActiveSecRef.current = key;
      setActiveSecPdf(key);
      const result = scrollToPdfSection(key);
      // Если smooth-скролл реально стартовал — фиксируем целевой scrollTop.
      // compute() в scroll-spy будет удерживать подсветку на key, пока scrollTop не приедет
      // к result.top (точное попадание ±6px) или не истечёт страховочный deadline.
      // Это убирает «мигание» подсветки промежуточных разделов в конце долгого скролла.
      if (result) {
        const c = pdfScrollRef.current;
        if (c && Math.abs(c.scrollTop - result.top) < 6) {
          pdfNavTargetRef.current = null; // уже на месте
        } else {
          pdfNavTargetRef.current = { key, top: result.top, deadline: Date.now() + 8000 };
        }
      }
      // Подсветку самой PDF-страницы (flash-рамку) намеренно не запускаем — нужна только в edit-режиме.
      return;
    }
    const el = refs[key]?.current; const c = scrollRef.current; if (!el || !c) return;
    // Подсветка вкладки слева — мгновенно. Flash-рамка вокруг раздела — только после прибытия скролла.
    setActiveSecEdit(key);
    preferredActiveSecRef.current = key;
    const targetTop = Math.max(0, c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 12);
    if (Math.abs(c.scrollTop - targetTop) < 6) {
      pendingFlashRef.current = null;
      flashElement(el);
    } else {
      pendingFlashRef.current = { key, top: targetTop, deadline: Date.now() + 1500 };
      c.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }

  function startResize(e) {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarW;
    function onMove(ev) {
      if (!resizingRef.current) return;
      const newW = Math.max(120, Math.min(420, startW + ev.clientX - startX));
      setSidebarW(newW);
    }
    function onUp() {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

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
    let ok = false;
    try {
      await api.updateRpd(rpdId, { goals_text: editTexts.goals, tasks_text: editTexts.tasks, objects_text: editTexts.objects, requirements_text: editTexts.requirements, educational_tech: editTexts.educational_tech, methodical_recommendations: editTexts.methodical_recommendations });
      await load();
      ok = true;
    } catch { }
    setSaving(false);
    // Сообщаем родителю — он триггернёт перезагрузку парной view-вкладки
    // (если она открыта) через её reloadKey.
    if (ok && onAfterSave) onAfterSave();
  }

  function getValidationErrors() {
    const e = [];
    if (!editTexts.goals?.trim()) e.push({ secKey: "1.1", label: "1.1 Цели дисциплины" });
    if (!editTexts.tasks?.trim()) e.push({ secKey: "1.1", label: "1.1 Задачи дисциплины" });
    if (!editTexts.objects?.trim()) e.push({ secKey: "1.2", label: "1.2 Изучаемые объекты" });
    if (!editTexts.requirements?.trim()) e.push({ secKey: "1.3", label: "1.3 Входные требования" });
    if (!editTexts.educational_tech?.trim()) e.push({ secKey: "5.1", label: "5.1 Образовательные технологии" });
    if (!editTexts.methodical_recommendations?.trim()) e.push({ secKey: "5.2", label: "5.2 Методические указания" });
    if (!rpd.sections?.length) e.push({ secKey: "4", label: "4. Содержание (нет ни одного раздела)" });
    if (!rpd.literature?.length) e.push({ secKey: "6.1", label: "6.1 Литература (нет ни одного источника)" });
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
  const hasLabTopics = (rpd.sections || []).some(s => (s.topics || []).some(t => t.topic_type === "lab"));
  const hasPracticeTopics = (rpd.sections || []).some(s => (s.topics || []).some(t => t.topic_type === "practice"));

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

  function LiteratureEditor({ kind }) {
    // kind: "printed" — без url; "electronic" — с url
    const isElectronic = kind === "electronic";
    const filterFn = (l) => isElectronic ? !!l.url : !l.url;
    const items = (rpd.literature || []).filter(filterFn);
    const [showAdd, setShowAdd] = useState(false);
    const initialForm = { source_type: isElectronic ? "Дополнительная" : "Основная", title: "", authors: "", year: 2024, publisher: "", url: "", copies_count: "" };
    const [form, setForm] = useState(initialForm);
    const addLit = async () => {
      const payload = { ...form, year: form.year ? +form.year : null, copies_count: form.copies_count ? +form.copies_count : null };
      if (!isElectronic) payload.url = null;
      try { await api.addLiterature(rpdId, payload); setShowAdd(false); setForm(initialForm); await load(); } catch { }
    };
    const delLit = async (id) => { await api.deleteLiterature(id); await load(); };
    return <div>
      {items.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{items.map((l, i) => <div key={l.id_literature} style={{ padding: "10px 14px", borderBottom: i < items.length - 1 ? "1px solid " + T.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{l.title}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{l.authors}{l.year ? ", " + l.year : ""}{l.publisher ? " — " + l.publisher : ""}{l.copies_count ? " (экз. " + l.copies_count + ")" : ""}</div>
          {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.blue, wordBreak: "break-all" }}>{l.url}</a>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><Badge status={l.source_type === "Основная" ? "На согласовании" : "Черновик"} />{isEdit && canEdit && <button onClick={() => delLit(l.id_literature)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}</div>
      </div>)}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>{isElectronic ? "Электронная" : "Печатная"} литература не добавлена</div>}
      {isEdit && canEdit && <div style={{ marginTop: 12 }}>
        {!showAdd ? <div style={{ display: "flex", gap: 8 }}><Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>{!isElectronic && <Btn small primary onClick={() => autoFill("literature")} disabled={!!generating}><SparkleIcon /> Автоподбор</Btn>}</div>
          : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))} style={{ padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }}><option>Основная</option><option>Дополнительная</option></select>
              <input placeholder="Год" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} style={{ width: 80, padding: "6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />
              {!isElectronic && <input placeholder="Кол-во экз." type="number" value={form.copies_count} onChange={e => setForm(p => ({ ...p, copies_count: e.target.value }))} style={{ width: 110, padding: "6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />}
            </div>
            <input placeholder="Авторы" value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input placeholder="Название" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input placeholder="Издательство" value={form.publisher} onChange={e => setForm(p => ({ ...p, publisher: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            {isElectronic && <input placeholder="URL электронного ресурса" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />}
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

  function OutcomesEditor() {
    const [comps, setComps] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ id_indicator: "", outcome_text: "", assessment_tool: "" });
    useEffect(() => { if (rpd?.id_discipline) api.getCompetenciesByDiscipline(rpd.id_discipline).then(r => setComps(r.data)).catch(() => { }); }, []);
    const used = new Set((rpd.learning_outcomes || []).map(o => o.id_indicator));
    const add = async () => { if (!form.id_indicator) return; try { await api.addOutcome(rpdId, { id_indicator: +form.id_indicator, outcome_text: form.outcome_text, assessment_tool: form.assessment_tool }); setShowAdd(false); setForm({ id_indicator: "", outcome_text: "", assessment_tool: "" }); await load(); } catch { } };
    const del = async (id) => { try { await api.deleteOutcome(id); await load(); } catch { } };
    return <div>
      {rpd.learning_outcomes?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Компетенция", "Индикатор", "Результат", "Средство оценки", isEdit && canEdit ? "" : null].filter(x => x !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.learning_outcomes.map(o => <tr key={o.id_outcome}><td style={td}>{o.competency_code}</td><td style={td}>{o.indicator_code}</td><td style={td}>{o.outcome_text}</td><td style={td}>{o.assessment_tool}</td>{isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(o.id_outcome)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}</tr>)}</tbody>
      </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Результаты обучения не добавлены</div>}
      {isEdit && canEdit && <div style={{ marginTop: 8 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить результат</Btn>
          : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <select value={form.id_indicator} onChange={e => setForm(p => ({ ...p, id_indicator: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, fontFamily: F }}>
              <option value="">— Выбрать индикатор —</option>
              {comps.map(c => c.indicators?.filter(i => !used.has(i.id_indicator)).map(i => <option key={i.id_indicator} value={i.id_indicator}>{c.code} / {i.code} — {i.description}</option>))}
            </select>
            <textarea placeholder="Планируемый результат обучения (знать/уметь/владеть)" value={form.outcome_text} onChange={e => setForm(p => ({ ...p, outcome_text: e.target.value }))} style={{ width: "100%", minHeight: 60, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, marginBottom: 8, resize: "vertical", boxSizing: "border-box" }} />
            <input placeholder="Средство оценки (Экзамен / Защита лабораторной работы / …)" value={form.assessment_tool} onChange={e => setForm(p => ({ ...p, assessment_tool: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
          </div>}
      </div>}
    </div>;
  }

  function TopicsEditor({ kind }) {
    // kind: "lab" | "practice"
    const [addingFor, setAddingFor] = useState(null);
    const [form, setForm] = useState({ title: "", hours: "" });
    const add = async (sectionId) => { if (!form.title.trim()) return; try { await api.addTopic(sectionId, { topic_type: kind, title: form.title, hours: form.hours ? +form.hours : null }); setAddingFor(null); setForm({ title: "", hours: "" }); await load(); } catch { } };
    const del = async (id) => { try { await api.deleteTopic(id); await load(); } catch { } };
    if (!rpd.sections?.length) return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Сначала добавьте разделы дисциплины (раздел 4)</div>;
    return <div>{rpd.sections.map(s => {
      const topics = (s.topics || []).filter(t => t.topic_type === kind);
      return <div key={s.id_section} style={{ marginBottom: 16, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Раздел {s.section_number}. {s.title}</div>
        {topics.length > 0 ? topics.map(t => <div key={t.id_topic} style={{ display: "flex", alignItems: "center", padding: "6px 12px", marginLeft: 16, borderLeft: "2px solid " + T.accent, marginBottom: 4, fontSize: 12 }}>
          <span style={{ flex: 1 }}>{t.title} {t.hours ? `(${t.hours} ч.)` : ""}</span>
          {isEdit && canEdit && <button onClick={() => del(t.id_topic)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}
        </div>) : <div style={{ fontSize: 11, color: T.textMuted, marginLeft: 16, marginBottom: 8 }}>Тем нет</div>}
        {isEdit && canEdit && (addingFor === s.id_section
          ? <div style={{ marginTop: 8, marginLeft: 16, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder={kind === "lab" ? "Название лабораторной работы" : "Название практического занятия"} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "5px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12 }} />
              <input type="number" min="0" placeholder="ч." value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} style={{ width: 50, padding: "5px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, textAlign: "center" }} />
              <Btn small primary onClick={() => add(s.id_section)}>OK</Btn>
              <Btn small onClick={() => { setAddingFor(null); setForm({ title: "", hours: "" }); }}>✕</Btn>
            </div>
          : <Btn small onClick={() => { setAddingFor(s.id_section); setForm({ title: "", hours: "" }); }} style={{ marginLeft: 16 }}><PlusIcon /> Добавить тему</Btn>)}
      </div>;
    })}</div>;
  }

  function DatabasesEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: "", url: "" });
    const add = async () => { if (!form.name.trim()) return; try { await api.addDatabase(rpdId, form); setShowAdd(false); setForm({ name: "", url: "" }); await load(); } catch { } };
    const del = async (id) => { try { await api.deleteDatabase(id); await load(); } catch { } };
    return <div>
      {rpd.databases?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Наименование", "Ссылка", isEdit && canEdit ? "" : null].filter(x => x !== null).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.databases.map(d => <tr key={d.id_database}>
          <td style={td}>{d.name}</td>
          <td style={{ ...td, fontSize: 11, color: T.blue, wordBreak: "break-all" }}>{d.url || "—"}</td>
          {isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(d.id_database)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}
        </tr>)}</tbody>
      </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>БД не добавлены — в шаблон будет вставлен стандартный перечень ПНИПУ</div>}
      {isEdit && canEdit && <div style={{ marginTop: 8 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
          : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <input placeholder="Наименование (например, eLIBRARY.RU)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input placeholder="Ссылка / «локальная сеть»" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={add}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
          </div>}
      </div>}
    </div>;
  }

  function MtechEditor() {
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ room_type: "", equipment: "", quantity: "" });
    const add = async () => { try { await api.addMaterialTech(rpdId, { ...form, quantity: form.quantity ? +form.quantity : null }); setShowAdd(false); setForm({ room_type: "", equipment: "", quantity: "" }); await load(); } catch { } };
    const del = async (id) => { await api.deleteMaterialTech(id); await load(); };
    return <div>
      {rpd.material_tech?.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Тип помещения", "Оборудование", "Кол-во", isEdit && canEdit ? "" : null].filter(Boolean).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rpd.material_tech.map(m => <tr key={m.id_material_tech}><td style={td}>{m.room_type}</td><td style={td}>{m.equipment}</td><td style={{ ...td, textAlign: "center" }}>{m.quantity ?? "—"}</td>{isEdit && canEdit && <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(m.id_material_tech)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button></td>}</tr>)}</tbody>
      </table> : <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>МТО не добавлено</div>}
      {isEdit && canEdit && <div style={{ marginTop: 8 }}>
        {!showAdd ? <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
          : <div style={{ padding: 12, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input placeholder="Тип помещения" value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))} style={{ width: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <input placeholder="Оборудование" value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }} />
            <input type="number" min="0" placeholder="Кол-во" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} style={{ width: 70, padding: "6px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />
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
      <div style={{ width: sidebarW, background: T.surface, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Переключатель режима. Если та же РПД уже открыта в парной вкладке (hasPair),
            кнопку противоположного режима блокируем — этот режим занят соседней вкладкой
            (по аналогии с заблокированным «Редактирование» для уже согласованной РПД). */}
        <div style={{ display: "flex", borderBottom: "1px solid " + T.border, flexShrink: 0 }}>
          {(() => {
            const viewTakenByPair = hasPair && isEdit; // мы edit, значит view — это сосед
            const editTakenByPair = hasPair && !isEdit; // мы view, значит edit — это сосед
            const viewClickable = isEdit && !viewTakenByPair;
            const editClickable = !isEdit && canEdit && !editTakenByPair;
            return <>
              <button
                onClick={() => { if (viewClickable && onToggleMode) onToggleMode(); }}
                disabled={viewTakenByPair}
                title={viewTakenByPair ? "Этот режим уже открыт в парной вкладке" : (isEdit ? "Переключиться в просмотр PDF" : "Текущий режим")}
                style={{
                  flex: 1, padding: "6px 4px", border: "none",
                  borderRight: "1px solid " + T.border,
                  background: !isEdit ? T.blueLight : "transparent",
                  color: !isEdit ? T.blue : (viewTakenByPair ? T.textLight : T.textMuted),
                  fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
                  cursor: viewClickable ? "pointer" : "default", textAlign: "center",
                  opacity: viewTakenByPair ? 0.5 : 1,
                }}>👁 ПРОСМОТР</button>
              <button
                onClick={() => { if (editClickable && onToggleMode) onToggleMode(); }}
                disabled={(!canEdit && !isEdit) || editTakenByPair}
                title={editTakenByPair ? "Этот режим уже открыт в парной вкладке" : (!canEdit ? "Редактирование недоступно при текущем статусе РПД" : (!isEdit ? "Переключиться в режим редактирования" : "Текущий режим"))}
                style={{
                  flex: 1, padding: "6px 4px", border: "none",
                  background: isEdit ? T.orangeLight : "transparent",
                  color: isEdit ? T.orange : (editTakenByPair ? T.textLight : (canEdit ? T.textMuted : T.textLight)),
                  fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
                  cursor: editClickable ? "pointer" : "default", textAlign: "center",
                  opacity: ((!canEdit && !isEdit) || editTakenByPair) ? 0.5 : 1,
                }}>✏ РЕДАКТИРОВАНИЕ</button>
            </>;
          })()}
        </div>
        {/* Discoverable-кнопка для пары: «Открыть рядом в [противоположном режиме]».
            Прячем когда пара уже есть. Если редактировать нельзя в принципе (статус
            закрывает edit) — тоже не показываем кнопку открытия edit-копии. */}
        {!hasPair && onOpenPair && (isEdit || canEdit) && <button
          onClick={() => onOpenPair()}
          title={`Откроет копию РПД в режиме «${isEdit ? "просмотр" : "редактирование"}» во второй панели · при сохранении edit-вкладки парная view-вкладка обновится автоматически`}
          style={{
            display: "block", width: "100%", padding: "5px 8px",
            border: "none", borderBottom: "1px solid " + T.border,
            background: T.accentLight, color: T.accent,
            fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
            cursor: "pointer", textAlign: "center", flexShrink: 0,
          }}>⧉ Открыть рядом в режиме «{isEdit ? "просмотр" : "редактор"}»</button>}
        {isHead && rpd.status === "На согласовании" && <div style={{ padding: "4px 10px", background: T.accentLight, borderBottom: "1px solid " + T.accent, fontSize: 10, fontWeight: 700, color: T.accent, textAlign: "center", letterSpacing: .3 }}>📋 СОГЛАСОВАНИЕ</div>}
        <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>{SIDEBAR_KEYS.map(k => {
          // В режиме просмотра прячем 4.1 / 4.2, если в РПД нет соответствующих тем —
          // скроллить там не к чему, и в PDF этих разделов тоже нет.
          if (!isEdit && k === "4.1" && !hasLabTopics) return null;
          if (!isEdit && k === "4.2" && !hasPracticeTopics) return null;
          const hasErr = validationErrors.length > 0 && validationErrors.some(e => e.secKey === k);
          const isSub = SUB_KEYS.has(k);
          return <button key={k} onClick={() => goTo(k)} style={{ display: "flex", width: "100%", padding: isSub ? "6px 12px 6px 28px" : "8px 12px", border: "none", borderLeft: hasErr ? "3px solid " + T.red : activeSec === k ? "3px solid " + T.accent : "3px solid transparent", background: activeSec === k ? T.accentLight : "transparent", cursor: "pointer", fontSize: isSub ? 10 : 11, fontFamily: F, fontStyle: isSub ? "italic" : "normal", fontWeight: activeSec === k ? 700 : 400, color: hasErr ? T.red : activeSec === k ? T.accent : isSub ? T.textMuted : T.text, alignItems: "center", gap: 6, boxSizing: "border-box", textAlign: "left" }}>
            {isSub && <span style={{ color: T.textLight, flexShrink: 0 }}>›</span>}
            <span style={{ flex: 1, textAlign: "left", lineHeight: 1.3, wordBreak: "break-word" }}>{SEC_LABELS[k]}</span>
            {hasErr && <span style={{ fontSize: 7, color: T.red, flexShrink: 0 }}>●</span>}
          </button>;
        })}</div>
        <div style={{ borderTop: "1px solid " + T.borderLight, padding: "8px 12px", fontSize: 11, color: T.textMuted, flexShrink: 0 }}><Badge status={rpd.status} /></div>
      </div>
      {/* RESIZER */}
      <div onMouseDown={startResize} title="Потяните, чтобы изменить ширину панели"
        onMouseEnter={e => e.currentTarget.style.background = T.accent}
        onMouseLeave={e => { if (!resizingRef.current) e.currentTarget.style.background = T.borderLight; }}
        style={{ width: 5, cursor: "col-resize", background: T.borderLight, flexShrink: 0, transition: "background .15s" }} />
      {/* DOCUMENT */}
      {showPdf ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.pdfBg, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: T.surface, borderBottom: "1px solid " + T.border, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: T.blue, fontWeight: 700 }}>👁 Просмотр PDF</span>
            <div style={{ width: 1, height: 18, background: T.borderLight }} />
            {/* Page navigation */}
            <button onClick={() => scrollToPdfPage(Math.max(1, pdfCurrentPage - 1), false)} disabled={!pdfNumPages || pdfCurrentPage <= 1} style={pdfToolBtn(pdfCurrentPage <= 1 || !pdfNumPages)} title="Предыдущая страница">◀</button>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.text }}>
              <input type="number" min={1} max={pdfNumPages || 1} value={pageInputValue}
                onFocus={e => { pageInputFocusedRef.current = true; e.target.select(); }}
                onBlur={() => {
                  pageInputFocusedRef.current = false;
                  const v = Math.max(1, Math.min(pdfNumPages || 1, +pageInputValue || 1));
                  setPageInputValue(v);
                  if (v !== pdfCurrentPage) scrollToPdfPage(v, false);
                }}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                onChange={e => {
                  setPageInputValue(e.target.value);
                  const raw = +e.target.value;
                  if (Number.isFinite(raw) && raw >= 1 && raw <= (pdfNumPages || 1) && raw !== pdfCurrentPage) {
                    scrollToPdfPage(raw, false);
                  }
                }}
                style={{ width: 44, padding: "3px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, textAlign: "center", fontFamily: F }} />
              <span style={{ color: T.textMuted }}>/ {pdfNumPages || "—"}</span>
            </div>
            <button onClick={() => scrollToPdfPage(Math.min(pdfNumPages || 1, pdfCurrentPage + 1), false)} disabled={!pdfNumPages || pdfCurrentPage >= pdfNumPages} style={pdfToolBtn(!pdfNumPages || pdfCurrentPage >= pdfNumPages)} title="Следующая страница">▶</button>
            <div style={{ width: 1, height: 18, background: T.borderLight }} />
            {/* Zoom */}
            <button onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Уменьшить">−</button>
            <span style={{ fontSize: 12, color: T.text, minWidth: 38, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{Math.round(pdfScale * 100)}%</span>
            <button onClick={() => setPdfScale(s => Math.min(3, +(s + 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Увеличить">+</button>
            <button onClick={() => setPdfScale(1.1)} style={{ ...pdfToolBtn(false), fontSize: 11, padding: "3px 8px" }} title="Сбросить масштаб">1:1</button>
            <div style={{ flex: 1 }} />
            <Btn small onClick={reloadPdf} disabled={pdfLoading}>↻ Обновить</Btn>
            <Btn small onClick={() => onExportPdf(rpdId)}><DownloadIcon /> Скачать</Btn>
          </div>
          <div ref={pdfScrollRef} onScroll={e => { pdfScrollPosRef.current = e.currentTarget.scrollTop; }} style={{ flex: 1, position: "relative", overflow: "auto", background: T.pdfBg, padding: "16px 0" }}>
            {pdfLoading && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 12, zIndex: 2, pointerEvents: "none" }}><Spinner size={36} /><div style={{ fontSize: 13 }}>Формируется PDF из шаблона...</div></div>}
            {pdfError && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 12 }}><div style={{ fontSize: 14, color: "#ffb4b4" }}>{pdfError}</div><Btn small onClick={reloadPdf}>Повторить</Btn></div>}
            {pdfData && (
              <Document file={pdfData} onLoadSuccess={(pdfDoc) => {
                setPdfNumPages(pdfDoc.numPages);
                scanPdfForSections(pdfDoc).then(m => {
                  if (Object.keys(m).length > 1) setPdfSectionMap(prev => ({ ...prev, ...m }));
                }).catch(() => { });
              }} onLoadError={(e) => { console.error("PDF load error:", e); setPdfError("Не удалось открыть PDF: " + (e?.message || "неизвестная ошибка")); }} loading="">
                {Array.from({ length: pdfNumPages }, (_, i) => i + 1).map(n => (
                  <div key={n} style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <div data-page={n} ref={setPdfPageRef(n)} style={{ display: "inline-block" }}>
                      <Page pageNumber={n} scale={pdfScale} renderAnnotationLayer={false} renderTextLayer={true} loading="" />
                    </div>
                  </div>
                ))}
              </Document>
            )}
          </div>
        </div>
      ) : (
      <div ref={scrollRef} onScroll={e => { editScrollPosRef.current = e.currentTarget.scrollTop; }} style={{ flex: 1, overflowY: "auto", padding: "24px 32px", background: T.bg }}>
        {isEdit && canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.orangeLight, border: "1px solid " + T.orange, color: T.orange, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>✏ Режим редактирования — изменения сохраняются кнопкой «Сохранить»</div>}
        {isEdit && !canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.blueLight, border: "1px solid " + T.blue, color: T.blue, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>👁 РПД нельзя редактировать в текущем статусе</div>}
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
          {/* 1. Общие положения */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>1. Общие положения</div>
          {/* 1.1 Цели и задачи */}
          <div ref={refs["1.1"]} style={{ marginBottom: 32 }}>
            <EditableBlock skey="goals" label="1.1. Цели дисциплины" fieldKey="goals" />
            <div style={{ marginTop: 20 }}><EditableBlock skey="tasks" label="Задачи дисциплины" fieldKey="tasks" /></div>
          </div>
          <HR />
          {/* 1.2 Изучаемые объекты */}
          <div ref={refs["1.2"]} style={{ marginBottom: 32 }}>
            <EditableBlock skey="objects" label="1.2. Изучаемые объекты дисциплины" fieldKey="objects" />
          </div>
          <HR />
          {/* 1.3 Входные требования */}
          <div ref={refs["1.3"]} style={{ marginBottom: 32 }}>
            <EditableBlock skey="requirements" label="1.3. Входные требования" fieldKey="requirements" />
          </div>
          <HR />
          {/* 2. Результаты обучения */}
          <div ref={refs["2"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>2. Планируемые результаты обучения по дисциплине</div>
            <OutcomesEditor />
          </div>
          <HR />
          {/* 3. Объём и виды учебной работы — read-only из БУП */}
          <div ref={refs["3"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Объём и виды учебной работы</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Заполняется автоматически из БУП</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Вид учебной работы</th><th style={th}>Всего часов</th></tr></thead>
              <tbody>
                <tr><td style={td}>Контактная аудиторная работа</td><td style={{ ...td, textAlign: "center" }}>{(rpd.lecture_hours || 0) + (rpd.practice_hours || 0) + (rpd.lab_hours || 0)}</td></tr>
                <tr><td style={td}>— лекции (Л)</td><td style={{ ...td, textAlign: "center" }}>{rpd.lecture_hours || 0}</td></tr>
                <tr><td style={td}>— лабораторные работы (ЛР)</td><td style={{ ...td, textAlign: "center" }}>{rpd.lab_hours || 0}</td></tr>
                <tr><td style={td}>— практические занятия (ПЗ)</td><td style={{ ...td, textAlign: "center" }}>{rpd.practice_hours || 0}</td></tr>
                <tr><td style={td}>Самостоятельная работа (СРС)</td><td style={{ ...td, textAlign: "center" }}>{rpd.self_study_hours || 0}</td></tr>
                <tr><td style={{ ...td, fontWeight: 700 }}>Общая трудоёмкость</td><td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{rpd.total_hours || 0}</td></tr>
                <tr><td style={td}>Форма итогового контроля</td><td style={{ ...td, textAlign: "center" }}>{rpd.control_form || "—"}</td></tr>
                <tr><td style={td}>Семестр(ы)</td><td style={{ ...td, textAlign: "center" }}>{rpd.semester || "—"}</td></tr>
              </tbody>
            </table>
          </div>
          <HR />
          {/* 4. Содержание */}
          <div ref={refs["4"]} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>4. Содержание дисциплины</div>
              {isEdit && canEdit && <Btn small primary onClick={() => autoFill("content")} disabled={!!generating}>{generating === "content" ? "Генерация..." : "Сгенерировать"}</Btn>}
            </div>
            <SectionEditor />
          </div>
          <HR />
          {/* Тематика лабораторных работ */}
          <div ref={refs["4.1"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Тематика примерных лабораторных работ</div>
            <TopicsEditor kind="lab" />
          </div>
          <HR />
          {/* Тематика практических занятий */}
          <div ref={refs["4.2"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Тематика практических занятий</div>
            <TopicsEditor kind="practice" />
          </div>
          <HR />
          {/* 5. Орг.-пед. условия */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>5. Организационно-педагогические условия</div>
          <div ref={refs["5.1"]} style={{ marginBottom: 32 }}>
            <EditableBlock skey="educational_tech" label="5.1. Образовательные технологии" fieldKey="educational_tech" />
          </div>
          <HR />
          <div ref={refs["5.2"]} style={{ marginBottom: 32 }}>
            <EditableBlock skey="methodical_recommendations" label="5.2. Методические указания" fieldKey="methodical_recommendations" />
          </div>
          <HR />
          {/* 6. Учебно-методическое обеспечение */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>6. Учебно-методическое и информационное обеспечение</div>
          <div ref={refs["6.1"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.1. Печатная учебно-методическая литература</div>
            <LiteratureEditor kind="printed" />
          </div>
          <HR />
          <div ref={refs["6.2"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.2. Электронная учебно-методическая литература</div>
            <LiteratureEditor kind="electronic" />
          </div>
          <HR />
          <div ref={refs["6.3"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.3. Лицензионное и свободно распространяемое программное обеспечение</div>
            <SoftwareEditor />
          </div>
          <HR />
          <div ref={refs["6.4"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>6.4. Современные профессиональные базы данных и информационные справочные системы</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Если оставить пустым — в шаблон вставится стандартный перечень ПНИПУ</div>
            <DatabasesEditor />
          </div>
          <HR />
          {/* 7. МТО */}
          <div ref={refs["7"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>7. Материально-техническое обеспечение образовательного процесса</div>
            <MtechEditor />
          </div>
          <HR />
          {/* 8. ФОС — read-only */}
          <div ref={refs["8"]} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>8. Фонд оценочных средств</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Заполняется автоматически из ФОС</div>
            <div style={{ padding: 16, border: "1px solid " + T.borderLight, borderRadius: 6, background: T.bg, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>Описан в отдельном документе (приложение к РПД)</div>
          </div>
          <HR />
          {/* ДОКУМЕНТЫ для LLM */}
          <div ref={refs.docs} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Загруженные документы (контекст для LLM)</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Не попадает в финальный РПД — используется только для автогенерации</div>
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
      )}
    </div>
    {/* Bottom bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", flexShrink: 0, background: T.surface, borderTop: "1px solid " + T.border }}>
      <Btn small onClick={onBack}>← Назад</Btn>
      {!showPdf && <Btn small onClick={() => onExportPdf(rpdId)}><DownloadIcon /> PDF</Btn>}
      {isEdit && canEdit && !isHead && <><Btn small onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Btn><div style={{ flex: 1 }} /><Btn primary onClick={handleSendApproval}>Отправить на согласование</Btn></>}
      {isHead && rpd.status === "На согласовании" && <><div style={{ flex: 1 }} /><Btn primary onClick={() => handleReview("approve")}>Согласовать</Btn><Btn danger onClick={() => setModal("reject")}>На доработку</Btn></>}
      {showPdf && !(isHead && rpd.status === "На согласовании") && <><div style={{ flex: 1 }} /><span style={{ fontSize: 12, color: T.textMuted }}>Режим просмотра</span></>}
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
  const [rpds, setRpds] = useState([]);
  // Каждая открытая вкладка: { tabId: string, id_rpd: number, mode: "edit"|"view", ...rpd_metadata }.
  // tabId уникален (одна РПД может одновременно занимать ДВЕ вкладки — одну в edit, одну в view),
  // mode хранится отдельно и не зашит в tabId, поэтому переключение режима «на месте» не меняет ID
  // (и не дёргает React переидентификацию вкладки в panes.tabs).
  const [openRpds, setOpenRpds] = useState([]);
  // Состояние сплита: левая панель есть всегда, правая опциональна (null — обычный одиночный режим).
  // tabs/activeId — это tabId-строки.
  const [panes, setPanes] = useState({ left: { tabs: [], activeId: null }, right: null });
  const [draggingTabId, setDraggingTabId] = useState(null);
  // На какую половину сейчас наведена перетаскиваемая вкладка ("left" | "right" | null) —
  // нужно для подсветки целевой зоны во время drag.
  const [dragOverSide, setDragOverSide] = useState(null);
  // Соотношение ширины левой панели к общей (0.2…0.8). Используется только когда сплит активен.
  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef(null);
  const resizingSplitRef = useRef(false);
  // Счётчики «перезагрузить» по tabId. Когда edit-вкладка сохраняется, App дёргает счётчики
  // ОСТАЛЬНЫХ вкладок этой же РПД — те видят изменение пропа и перечитывают данные/PDF.
  const [tabReloadKeys, setTabReloadKeys] = useState({});
  const [showNotif, setShowNotif] = useState(false); const [showCreate, setShowCreate] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { const t = localStorage.getItem("token"); if (t) { api.getMe().then(r => { setUser(r.data); }).catch(() => localStorage.removeItem("token")).finally(() => setChecking(false)); } else setChecking(false); }, []);

  const loadRpds = useCallback(async () => { try { const r = await api.getRpds(); setRpds(r.data); } catch { } }, []);
  useEffect(() => { if (user) { loadRpds(); api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { }); } }, [user, loadRpds]);

  function findPaneOf(tabId) {
    if (panes.left.tabs.includes(tabId)) return "left";
    if (panes.right && panes.right.tabs.includes(tabId)) return "right";
    return null;
  }
  function oppositeSide(side) { return side === "left" ? "right" : "left"; }
  function newTabId(id_rpd, mode) { return `tab-${id_rpd}-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
  // Вкладка-«сосед»: та же id_rpd, противоположный mode. Если есть — это активная пара
  // и в редакторе блокируется in-place toggle (каждая вкладка зафиксирована в своём режиме),
  // а кнопка «Открыть рядом» прячется (пара уже открыта).
  function findSiblingTab(tabId) {
    const tab = openRpds.find(t => t.tabId === tabId); if (!tab) return null;
    return openRpds.find(t => t.id_rpd === tab.id_rpd && t.tabId !== tabId) || null;
  }

  function openRpdFn(rpd, editMode, options = {}) {
    const mode = editMode ? "edit" : "view";
    // Если эта же (id_rpd, mode) уже открыта — просто фокусируемся.
    const sameTab = openRpds.find(t => t.id_rpd === rpd.id_rpd && t.mode === mode);
    if (sameTab) { focusTab(sameTab.tabId); return; }
    // Если уже открыта другая «версия» этой РПД (другой mode), новую кладём в ПРОТИВОПОЛОЖНУЮ
    // панель — чтобы edit и view сразу оказались side-by-side.
    const other = openRpds.find(t => t.id_rpd === rpd.id_rpd);
    let targetSide = options.targetSide;
    if (!targetSide) targetSide = other ? oppositeSide(findPaneOf(other.tabId)) : "left";
    const tabId = newTabId(rpd.id_rpd, mode);
    // ВНИМАНИЕ к порядку: rpd может прилетать как существующая запись openRpds (из openPairFor),
    // у неё есть свои tabId/mode/id_rpd — поэтому spread ИДЁТ ПЕРВЫМ, а наши значения после, чтобы
    // переопределить, а не наоборот.
    setOpenRpds(prev => [...prev, { ...rpd, tabId, id_rpd: rpd.id_rpd, mode }]);
    setPanes(prev => {
      if (targetSide === "right") {
        if (!prev.right) return { ...prev, right: { tabs: [tabId], activeId: tabId } };
        return { ...prev, right: { tabs: [...prev.right.tabs, tabId], activeId: tabId } };
      }
      return { ...prev, left: { tabs: [...prev.left.tabs, tabId], activeId: tabId } };
    });
    setActiveTab("edit");
  }
  function focusTab(tabId) {
    setPanes(prev => {
      if (prev.left.tabs.includes(tabId)) return { ...prev, left: { ...prev.left, activeId: tabId } };
      if (prev.right && prev.right.tabs.includes(tabId)) return { ...prev, right: { ...prev.right, activeId: tabId } };
      return prev;
    });
    setActiveTab("edit");
  }
  function toggleTabMode(tabId) {
    const tab = openRpds.find(t => t.tabId === tabId); if (!tab) return;
    const newMode = tab.mode === "edit" ? "view" : "edit";
    // Если рядом уже есть пара в нужном режиме — блокируем toggle (в редакторе кнопка вообще
    // спрятана), здесь страховка на случай вызова другим путём.
    const sibling = openRpds.find(t => t.id_rpd === tab.id_rpd && t.mode === newMode);
    if (sibling) { focusTab(sibling.tabId); return; }
    setOpenRpds(prev => prev.map(t => t.tabId === tabId ? { ...t, mode: newMode } : t));
  }
  // Открыть копию текущей РПД в противоположном режиме во второй панели (или просто рядом,
  // если панели одна). Это и есть discoverable-механизм для пары edit+view.
  function openPairFor(tabId) {
    const tab = openRpds.find(t => t.tabId === tabId); if (!tab) return;
    const otherMode = tab.mode === "edit" ? "view" : "edit";
    const sibling = openRpds.find(t => t.id_rpd === tab.id_rpd && t.mode === otherMode);
    if (sibling) { focusTab(sibling.tabId); return; }
    const here = findPaneOf(tabId);
    const target = here ? oppositeSide(here) : "right";
    openRpdFn(tab, otherMode === "edit", { targetSide: target });
  }
  function closeRpdTab(tabId) {
    const next = openRpds.filter(t => t.tabId !== tabId);
    setOpenRpds(next); loadRpds();
    setTabReloadKeys(prev => { if (!(tabId in prev)) return prev; const { [tabId]: _, ...rest } = prev; return rest; });
    setPanes(prev => {
      let newLeft = prev.left;
      let newRight = prev.right;
      if (prev.left.tabs.includes(tabId)) {
        const tabs = prev.left.tabs.filter(id => id !== tabId);
        const activeId = prev.left.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.left.activeId;
        newLeft = { tabs, activeId };
      }
      if (prev.right && prev.right.tabs.includes(tabId)) {
        const tabs = prev.right.tabs.filter(id => id !== tabId);
        const activeId = prev.right.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.right.activeId;
        newRight = tabs.length === 0 ? null : { tabs, activeId };
      }
      if (newLeft.tabs.length === 0 && newRight) return { left: newRight, right: null };
      return { left: newLeft, right: newRight };
    });
    if (next.length === 0) setActiveTab("my");
  }
  function moveTabToPane(tabId, targetSide) {
    setPanes(prev => {
      const inLeft = prev.left.tabs.includes(tabId);
      const inRight = !!(prev.right && prev.right.tabs.includes(tabId));
      if (!inLeft && !inRight) return prev;
      const sourceSide = inLeft ? "left" : "right";
      if (sourceSide === targetSide) {
        if (targetSide === "left") return { ...prev, left: { ...prev.left, activeId: tabId } };
        return { ...prev, right: { ...prev.right, activeId: tabId } };
      }
      let newLeft = prev.left;
      let newRight = prev.right;
      if (sourceSide === "left") {
        const tabs = prev.left.tabs.filter(id => id !== tabId);
        const activeId = prev.left.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.left.activeId;
        newLeft = { tabs, activeId };
      } else {
        const tabs = prev.right.tabs.filter(id => id !== tabId);
        const activeId = prev.right.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.right.activeId;
        newRight = tabs.length === 0 ? null : { tabs, activeId };
      }
      if (targetSide === "left") {
        newLeft = { tabs: [...newLeft.tabs, tabId], activeId: tabId };
      } else {
        newRight = newRight ? { tabs: [...newRight.tabs, tabId], activeId: tabId } : { tabs: [tabId], activeId: tabId };
      }
      if (newLeft.tabs.length === 0 && newRight) return { left: newRight, right: null };
      return { left: newLeft, right: newRight };
    });
  }
  function mergePanes() {
    setPanes(prev => {
      if (!prev.right) return prev;
      const tabs = [...prev.left.tabs, ...prev.right.tabs];
      const activeId = prev.left.activeId != null ? prev.left.activeId : prev.right.activeId;
      return { left: { tabs, activeId }, right: null };
    });
  }
  function swapPanes() {
    setPanes(prev => prev.right ? { left: prev.right, right: prev.left } : prev);
    // Зеркалим соотношение ширин: было 70/30 → станет 30/70, чтобы визуальный
    // «вес» панелей поехал вместе с их содержимым, а не наоборот.
    setSplitRatio(r => 1 - r);
  }
  // Дёргаем «соседей по id_rpd», но не саму initiator-вкладку: она только что сама всё перечитала.
  function notifyRpdChanged(initiatorTabId) {
    const init = openRpds.find(t => t.tabId === initiatorTabId); if (!init) return;
    const others = openRpds.filter(t => t.id_rpd === init.id_rpd && t.tabId !== initiatorTabId);
    if (others.length === 0) return;
    setTabReloadKeys(prev => {
      const next = { ...prev };
      others.forEach(t => { next[t.tabId] = (next[t.tabId] || 0) + 1; });
      return next;
    });
  }
  function startSplitResize(e) {
    e.preventDefault();
    resizingSplitRef.current = true;
    function onMove(ev) {
      if (!resizingSplitRef.current) return;
      const c = splitContainerRef.current; if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const ratio = Math.max(0.2, Math.min(0.8, x / rect.width));
      setSplitRatio(ratio);
    }
    function onUp() {
      resizingSplitRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  async function handleExportPdf(rpdId) {
    try { const r = await api.exportPdf(rpdId); const url = window.URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = `RPD_${rpdId}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch { alert("Ошибка экспорта PDF"); }
  }

  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); setOpenRpds([]); setPanes({ left: { tabs: [], activeId: null }, right: null }); setTabReloadKeys({}); };

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
    <style>{"*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes secFlash{0%{box-shadow:0 0 0 2px " + T.accent + "00}50%{box-shadow:0 0 0 2px " + T.accent + "66}100%{box-shadow:0 0 0 2px " + T.accent + "00}}.sec-flash{animation:secFlash 1.6s ease-in-out;border-radius:6px}html,body{overflow:hidden;height:100%}::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:" + T.bg + "}::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:5px;border:2px solid " + T.bg + "}::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}"}</style>

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
      {openRpds.length > 0 && (() => {
        // Один и тот же чип-вкладки рендерим и в одиночном, и в split-режиме.
        // Внутри split [L]/[R] больше не нужен — принадлежность панели читается по позиции.
        const renderTab = (t) => {
          const paneSide = findPaneOf(t.tabId);
          const isActiveInPane = paneSide === "left"
            ? panes.left.activeId === t.tabId
            : (panes.right && panes.right.activeId === t.tabId);
          const isCurrentTab = activeTab === "edit" && isActiveInPane;
          const isDragging = draggingTabId === t.tabId;
          const isPaired = openRpds.some(o => o.id_rpd === t.id_rpd && o.tabId !== t.tabId);
          return <div
            key={t.tabId}
            draggable
            onDragStart={(e) => {
              setDraggingTabId(t.tabId);
              if (activeTab !== "edit") setActiveTab("edit");
              try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.tabId); } catch { }
            }}
            onDragEnd={() => { setDraggingTabId(null); setDragOverSide(null); }}
            onClick={() => focusTab(t.tabId)}
            title={isPaired ? "Эта РПД открыта в обоих режимах одновременно (edit ↔ view синхронизируются при сохранении)" : "Перетащите вниз, чтобы открыть в отдельной панели"}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
              borderRadius: "5px 5px 0 0",
              background: isCurrentTab ? T.surface : T.tabInactive,
              border: "1px solid " + (isCurrentTab ? T.accent : T.border),
              borderBottom: isCurrentTab ? "2px solid " + T.accent : "1px solid transparent",
              cursor: isDragging ? "grabbing" : "grab", fontSize: 11, fontWeight: isCurrentTab ? 700 : 400,
              color: isCurrentTab ? T.accent : T.text, flexShrink: 0,
              opacity: isDragging ? 0.5 : 1,
              userSelect: "none",
            }}>
            {/* [E]/[V] показывает текущий режим вкладки. Если открыта пара — добавляем «🔗»,
                чтобы было сразу видно что edit и view связаны и автоматически синхронизируются. */}
            <span style={{ fontSize: 10, opacity: 0.7, color: t.mode === "edit" ? T.orange : T.blue, fontWeight: 700 }}>[{t.mode === "edit" ? "E" : "V"}]</span>
            {isPaired && <span title="Связана с парной вкладкой" style={{ fontSize: 10, opacity: 0.6 }}>🔗</span>}
            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.direction_code} {t.discipline_name} {t.academic_year}</span>
            <span onClick={e => { e.stopPropagation(); closeRpdTab(t.tabId); }} style={{ cursor: "pointer", marginLeft: 4, opacity: 0.5, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>✕</span>
          </div>;
        };
        const tabIdToTab = Object.fromEntries(openRpds.map(t => [t.tabId, t]));
        const leftTabRpds = panes.left.tabs.map(id => tabIdToTab[id]).filter(Boolean);
        const rightTabRpds = panes.right ? panes.right.tabs.map(id => tabIdToTab[id]).filter(Boolean) : [];
        const ratioPct = (splitRatio * 100).toFixed(3);
        const invRatioPct = ((1 - splitRatio) * 100).toFixed(3);
        // Чтобы стык в строке вкладок СОВПАДАЛ с разделителем редактора снизу, обе группы
        // должны делиться от ПОЛНОЙ ширины контейнера, а не от «оставшейся после метки/кнопки».
        // Поэтому метка живёт ВНУТРИ левой группы, кнопка — внутри правой; внешний padding 0.
        // Левая группа: width = splitRatio*100% - 1px, разделитель 2px, правая: (1-r)*100% - 1px.
        // Сумма ровно 100% и центр разделителя в точке splitRatio*100% — как у редактора.
        return <div style={{ display: "flex", alignItems: "stretch", padding: "4px 0 0", background: T.bg, borderBottom: "1px solid " + T.border, minHeight: 32 }}>
          {!panes.right ? (
            // Одиночный режим — одна группа на всю ширину.
            <div style={{ flex: 1, display: "flex", alignItems: "stretch", padding: "0 12px", minWidth: 0, boxSizing: "border-box" }}>
              <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6, alignSelf: "center", flexShrink: 0 }}>Открытые РПД:</span>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
                {leftTabRpds.map(renderTab)}
              </div>
            </div>
          ) : (
            <>
              <div style={{ width: `calc(${ratioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 6px 0 12px", minWidth: 0, boxSizing: "border-box" }}>
                <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6, alignSelf: "center", flexShrink: 0 }}>Открытые РПД:</span>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
                  {leftTabRpds.map(renderTab)}
                </div>
              </div>
              <div title="Стык панелей" style={{ width: 2, alignSelf: "stretch", background: T.border, flexShrink: 0 }} />
              <div style={{ width: `calc(${invRatioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 12px 0 6px", minWidth: 0, boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
                  {rightTabRpds.map(renderTab)}
                </div>
                <button onClick={mergePanes} title="Свести все вкладки в одну панель" style={{ marginLeft: 8, alignSelf: "center", border: "1px solid " + T.border, background: T.surface, borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: T.text, flexShrink: 0, fontFamily: F }}>↩ Объединить</button>
              </div>
            </>
          )}
        </div>;
      })()}
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
    {/* Зона редакторов. Все открытые РПД остаются смонтированными — переключение вкладок и
        переезд между панелями (drag-n-drop) не должны сбрасывать PDF, скролл и автоген-состояние.
        Поэтому каждая <RpdEditor /> обёрнута в position:absolute контейнер; меняется лишь геометрия,
        DOM-узел тот же → React не размонтирует. Контейнер-обёртка показывается только на «edit». */}
    <div ref={splitContainerRef} style={{ display: activeTab === "edit" ? "block" : "none", flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
      {openRpds.map(t => {
        const paneSide = findPaneOf(t.tabId);
        if (!paneSide) return null;
        const splitOn = !!panes.right;
        const isActiveInPane = paneSide === "left" ? panes.left.activeId === t.tabId : panes.right.activeId === t.tabId;
        const visible = activeTab === "edit" && isActiveInPane;
        const leftPct = (splitRatio * 100).toFixed(3) + "%";
        const rightPct = ((1 - splitRatio) * 100).toFixed(3) + "%";
        const positionStyle = splitOn
          ? (paneSide === "left"
            ? { left: 0, top: 0, width: leftPct, height: "100%" }
            : { left: leftPct, top: 0, width: rightPct, height: "100%" })
          : { left: 0, top: 0, width: "100%", height: "100%" };
        const hasPair = openRpds.some(o => o.id_rpd === t.id_rpd && o.tabId !== t.tabId);
        return <div key={t.tabId} style={{
          position: "absolute", ...positionStyle,
          display: visible ? "flex" : "none", flexDirection: "column",
          overflow: "hidden", minHeight: 0, boxSizing: "border-box",
        }}>
          <RpdEditor
            rpdId={t.id_rpd}
            tabId={t.tabId}
            editMode={t.mode === "edit"}
            hasPair={hasPair}
            reloadKey={tabReloadKeys[t.tabId] || 0}
            onAfterSave={() => notifyRpdChanged(t.tabId)}
            onOpenPair={() => openPairFor(t.tabId)}
            userRole={role}
            onBack={() => closeRpdTab(t.tabId)}
            onExportPdf={handleExportPdf}
            onToggleMode={() => toggleTabMode(t.tabId)}
            isActive={visible}
          />
        </div>;
      })}
      {/* Плейсхолдер пустой панели — если правая панель есть, но в ней не оказалось активной вкладки
          (например, пользователь закрыл активную, но другие ещё остались — тогда мы выбираем последнюю,
          этот случай не сработает; но на случай рассинхрона пусть будет видимая пустота). */}
      {panes.right && panes.right.activeId == null && <div style={{ position: "absolute", left: (splitRatio * 100).toFixed(3) + "%", top: 0, width: ((1 - splitRatio) * 100).toFixed(3) + "%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Правая панель пуста</div>}
      {panes.left.activeId == null && panes.left.tabs.length === 0 && !panes.right && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Нет открытых РПД</div>}
      {/* Разделитель + кнопка swap. Сидят поверх стыка панелей, мышью можно тянуть.
          Двойной клик по разделителю — сброс к 50/50. */}
      {panes.right && <>
        <div
          onMouseDown={startSplitResize}
          onDoubleClick={() => setSplitRatio(0.5)}
          title="Перетащите для изменения ширины · двойной клик — сбросить к 50/50"
          style={{
            position: "absolute", top: 0, height: "100%",
            left: `calc(${(splitRatio * 100).toFixed(3)}% - 3px)`, width: 6,
            cursor: "col-resize", zIndex: 30,
            background: "transparent",
          }}
        >
          {/* видимая полоска по центру невидимой «толстой» зоны hit-area */}
          <div style={{ position: "absolute", left: 2, top: 0, width: 2, height: "100%", background: T.border }} />
        </div>
        <button
          onClick={swapPanes}
          title="Поменять панели местами"
          style={{
            position: "absolute", top: 8,
            left: `calc(${(splitRatio * 100).toFixed(3)}% - 14px)`, width: 28, height: 28,
            borderRadius: 14, border: "1px solid " + T.border, background: T.surface,
            color: T.accent, cursor: "pointer", zIndex: 31,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontFamily: F, boxShadow: "0 1px 4px rgba(0,0,0,.12)",
          }}
        >⇄</button>
      </>}
      {/* Зоны сброса (drop zones) — появляются только во время перетаскивания вкладки.
          z-index выше редакторов, pointer-events:auto только у самих зон, чтобы клики ниже
          были «съедены» только целевыми областями. */}
      {draggingTabId !== null && <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", pointerEvents: "none" }}>
        {(() => {
          // Стиль зоны: «активная» (мышь над ней) — насыщенный фон + двойная толщина рамки.
          // «пассивная» — приглушённая. Видно куда конкретно сейчас бросишь.
          const zoneStyle = (side) => {
            const active = dragOverSide === side;
            return {
              flex: 1, margin: 8,
              border: (active ? "4px" : "3px") + " dashed " + T.accent,
              borderRadius: 10,
              background: active ? "rgba(155,89,180,0.28)" : "rgba(155,89,180,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: active ? T.accentDark : T.accent,
              fontWeight: 700, fontSize: 18,
              pointerEvents: "auto",
              transition: "background-color 80ms, border-width 80ms",
              boxShadow: active ? "0 0 0 3px rgba(155,89,180,0.20) inset" : "none",
            };
          };
          return <>
            <div
              onDragEnter={() => setDragOverSide("left")}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverSide !== "left") setDragOverSide("left"); }}
              onDrop={e => { e.preventDefault(); moveTabToPane(draggingTabId, "left"); setDraggingTabId(null); setDragOverSide(null); }}
              style={zoneStyle("left")}
            >◀ В левую панель</div>
            <div
              onDragEnter={() => setDragOverSide("right")}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverSide !== "right") setDragOverSide("right"); }}
              onDrop={e => { e.preventDefault(); moveTabToPane(draggingTabId, "right"); setDraggingTabId(null); setDragOverSide(null); }}
              style={zoneStyle("right")}
            >В правую панель ▶</div>
          </>;
        })()}
      </div>}
    </div>

    <NotifPanel show={showNotif} onClose={() => { setShowNotif(false); api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { }); }} />
    {showCreate && <CreateRpdModal onClose={() => setShowCreate(false)} onCreated={(r) => { setShowCreate(false); loadRpds(); openRpdFn(r, true); }} />}
  </div>;
}
