import { useEffect, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Spinner } from "../components/Spinner.jsx";

const cellStyle = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight, fontSize: 13, verticalAlign: "top" };
const headStyle = { ...cellStyle, fontWeight: 700, color: T.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: ".4px", background: T.bg };

export function AdminBupsPage() {
  const [bups, setBups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [openBup, setOpenBup] = useState(null);

  const reload = () => {
    setLoading(true);
    api.adminListBups().then(r => setBups(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  async function handleDelete(b) {
    if (!confirm(`Удалить БУП «${b.name}»? Это удалит все его дисциплины и связки. РПД, привязанные к нему, потеряют автозаполнение часов и компетенций.`)) return;
    try { await api.adminDeleteBup(b.id_bup); reload(); }
    catch { alert("Не удалось удалить"); }
  }

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>БУПы (базовые учебные планы)</div>
        <Btn primary onClick={() => setShowImport(true)}>Загрузить XLS БУПа</Btn>
      </div>

      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : bups.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            БУПов пока нет. Загрузите XLS-файл — система разберёт его и заполнит дисциплины.
          </div>
        : <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={headStyle}>Год</th>
              <th style={headStyle}>Наименование</th>
              <th style={headStyle}>Направление</th>
              <th style={headStyle}>Факультет</th>
              <th style={headStyle} />
            </tr></thead>
            <tbody>
              {bups.map(b => <tr key={b.id_bup} style={{ cursor: "pointer" }}
                  onClick={() => setOpenBup(b.id_bup)}>
                <td style={cellStyle}>{b.year ?? "—"}</td>
                <td style={cellStyle}><span style={{ fontWeight: 600 }}>{b.name}</span></td>
                <td style={cellStyle}>{b.direction_code ? `${b.direction_code} ${b.direction_name}` : (b.direction_name || "—")}</td>
                <td style={cellStyle}>{b.faculty || "—"}</td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Btn small danger onClick={(e) => { e.stopPropagation(); handleDelete(b); }}>Удалить</Btn>
                </td>
              </tr>)}
            </tbody>
          </table>}
      </div>
    </div>

    {showImport && <ImportBupModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />}
    {openBup != null && <BupDetailModal bupId={openBup} onClose={() => setOpenBup(null)} />}
  </div>;
}

function ImportBupModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [year, setYear] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  async function handleSubmit() {
    if (!file) { setErr("Выберите файл"); return; }
    setBusy(true); setErr("");
    try {
      const r = await api.adminImportBupXls(file, year || null, nameOverride || null);
      setResult(r.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Ошибка импорта");
    } finally { setBusy(false); }
  }

  return <Modal width={620} onClose={onClose}>
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Загрузка XLS БУПа</div>

      {!result && <>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Файл .xls/.xlsx</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input ref={inputRef} type="file" accept=".xls,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ display: "none" }} />
            <Btn onClick={() => inputRef.current?.click()}>Выбрать файл…</Btn>
            <span style={{ fontSize: 13, color: T.textMuted }}>{file ? file.name : "Файл не выбран"}</span>
          </div>
        </div>
        <Input label="Год (если не определяется автоматически)" value={year} onChange={e => setYear(e.target.value)} placeholder="например, 2024" />
        <Input label="Имя БУПа (необязательно)" value={nameOverride} onChange={e => setNameOverride(e.target.value)} placeholder="оставьте пустым для авто-имени" />
        {err && <div style={{ background: "#fde6e3", color: T.red, padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn onClick={onClose}>Отмена</Btn>
          <Btn primary onClick={handleSubmit} disabled={busy}>{busy ? "Загружаю…" : "Импортировать"}</Btn>
        </div>
      </>}

      {result && <>
        <div style={{ background: T.greenLight, border: "1px solid " + T.green, color: T.green, padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          БУП импортирован: <b>{result.bup.name}</b>. Распознано дисциплин: {result.parsed_disciplines}.
        </div>
        {result.created_competencies?.length > 0 && <div style={{ marginBottom: 12, fontSize: 13 }}>
          Созданы новые компетенции (требуется заполнить названия в админке): <b>{result.created_competencies.join(", ")}</b>.
        </div>}
        {result.warnings?.length > 0 && <div style={{ background: T.orangeLight, border: "1px solid " + T.orange, padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, color: T.orange }}>
          {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn primary onClick={onImported}>Готово</Btn>
        </div>
      </>}
    </div>
  </Modal>;
}

function BupDetailModal({ bupId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.adminGetBup(bupId).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [bupId]);

  return <Modal width={1000} onClose={onClose}>
    <div style={{ padding: 20 }}>
      {loading || !data ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
      : <>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{data.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
              {data.direction_code ? `${data.direction_code} ${data.direction_name}` : data.direction_name}
              {data.faculty ? ` · ${data.faculty}` : ""}
              {data.year ? ` · ${data.year}` : ""}
            </div>
          </div>
          <Btn onClick={onClose}>Закрыть</Btn>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Дисциплины БУПа ({data.disciplines.length})</div>
        <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "auto", maxHeight: "55vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F }}>
            <thead><tr>
              <th style={headStyle}>Индекс</th>
              <th style={headStyle}>Кафедра</th>
              <th style={headStyle}>Дисциплина</th>
              <th style={headStyle}>Сем.</th>
              <th style={headStyle}>Контроль</th>
              <th style={headStyle}>Часы (Л/Лаб/Пр/КСР/СРС)</th>
              <th style={headStyle}>Всего</th>
              <th style={headStyle}>ЗЕ</th>
            </tr></thead>
            <tbody>
              {data.disciplines.map(d => <tr key={d.id_bup_discipline}>
                <td style={cellStyle}>{d.code || "—"}</td>
                <td style={cellStyle}>{d.department_name || "—"}</td>
                <td style={cellStyle}>{d.discipline_name}</td>
                <td style={cellStyle}>{d.semester || "—"}</td>
                <td style={cellStyle}>{d.control_form || "—"}</td>
                <td style={cellStyle}>{[d.lecture_hours, d.lab_hours, d.practice_hours, d.ksr_hours, d.self_study_hours].map(v => v ?? "—").join("/")}</td>
                <td style={cellStyle}>{d.total_hours ?? "—"}</td>
                <td style={cellStyle}>{d.zet ?? "—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  </Modal>;
}
