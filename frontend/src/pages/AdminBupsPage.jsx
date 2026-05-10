import { useEffect, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Input } from "../components/Input.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { TrashIcon, UploadIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function AdminBupsPage() {
  const [bups, setBups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [openBup, setOpenBup] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListBups().then(r => setBups(r.data)).catch(() => {}).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function performDelete(b) {
    if (!b) return;
    try { await api.adminDeleteBup(b.id_bup); reload(); }
    catch { setErrorMsg("Не удалось удалить БУП"); }
  }
  function handleDelete(b) { setPendingDelete(b); }

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>БУПы (базовые учебные планы)</div>
        <Btn small onClick={() => setShowImport(true)}><UploadIcon /> Загрузить XLS БУПа</Btn>
      </div>

      <div className="table-scroll">
        {loading ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : bups.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            БУПов пока нет. Загрузите XLS-файл — система разберёт его и заполнит дисциплины.
          </div>
        : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
            <thead><tr style={{ background: T.surface }}>
              <th style={{ ...hdr, textAlign: "center", width: 80 }}>Год</th>
              <th style={hdr}>Наименование</th>
              <th style={hdr}>Направление</th>
              <th style={hdr}>Факультет</th>
              <th style={{ ...hdr, width: 1 }} />
            </tr></thead>
            <tbody>
              {bups.map(b => <tr key={b.id_bup}
                  onDoubleClick={() => setOpenBup(b.id_bup)}
                  style={{ background: T.surface, cursor: "pointer" }}
                  title="Двойной клик — открыть детали">
                <td style={{ ...tcell, textAlign: "center" }}>{b.year ?? "—"}</td>
                <td style={{ ...tcell, fontWeight: 600 }}>{b.name}</td>
                <td style={tcell}>{b.direction_code ? `${b.direction_code} ${b.direction_name}` : (b.direction_name || "—")}</td>
                <td style={tcell}>{b.faculty || "—"}</td>
                <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }}>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(b); }} title="Удалить БУП" style={{ ...iconBtn, cursor: "pointer" }}><TrashIcon /></button>
                </td>
              </tr>)}
            </tbody>
          </table>}
      </div>
    </div>

    {showImport && <ImportBupModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />}
    {openBup != null && <BupDetailModal bupId={openBup} onClose={() => setOpenBup(null)} />}
    {pendingDelete && <ConfirmDeleteModal
      title={`Удалить БУП «${pendingDelete.name}»?`}
      message="БУП будет стёрт из базы. Дисциплины, компетенции и индикаторы из справочников останутся — их можно будет переиспользовать при ручном создании РПД или при импорте новых БУПов. Уже созданные РПД не изменятся: их часы, компетенции и направление сохранены внутри самих РПД."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const b = pendingDelete; setPendingDelete(null); await performDelete(b); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
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
          <Btn primary onClick={handleSubmit} disabled={busy}>{busy ? "Загружаю…" : "Импортировать"}</Btn>
          <Btn onClick={onClose}>Закрыть</Btn>
        </div>
      </>}

      {result && <>
        <div style={{ background: T.greenLight, border: "1px solid " + T.green, color: T.green, padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          БУП импортирован: <b>{result.bup.name}</b>. Распознано дисциплин: {result.parsed_disciplines}.
        </div>
        {result.created_competencies?.length > 0 && <div style={{ marginBottom: 12, fontSize: 13 }}>
          Добавлены в справочники компетенции: <b>{result.created_competencies.join(", ")}</b>.
        </div>}
        {result.warnings?.length > 0 && <div style={{ background: T.orangeLight, border: "1px solid " + T.orange, padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, color: T.orange }}>
          {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={onImported}>Закрыть</Btn>
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
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{data.name}</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            {data.direction_code ? `${data.direction_code} ${data.direction_name}` : data.direction_name}
            {data.faculty ? ` · ${data.faculty}` : ""}
            {data.year ? ` · ${data.year}` : ""}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Дисциплины БУПа ({data.disciplines.length})</div>
        <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "auto", maxHeight: "55vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F, tableLayout: "auto" }}>
            <thead><tr style={{ background: T.bg }}>
              <th style={hdr}>Индекс</th>
              <th style={hdr}>Кафедра</th>
              <th style={hdr}>Дисциплина</th>
              <th style={{ ...hdr, textAlign: "center" }}>Сем.</th>
              <th style={hdr}>Контроль</th>
              <th style={{ ...hdr, textAlign: "center" }}>Часы (Л/Лаб/Пр/КСР/СРС)</th>
              <th style={{ ...hdr, textAlign: "center" }}>Всего</th>
              <th style={{ ...hdr, textAlign: "center" }}>ЗЕ</th>
            </tr></thead>
            <tbody>
              {data.disciplines.map(d => <tr key={d.id_bup_discipline}>
                <td style={tcell}>{d.code || "—"}</td>
                <td style={tcell}>{d.department_name || "—"}</td>
                <td style={{ ...tcell, fontWeight: 600 }}>{d.discipline_name}</td>
                <td style={{ ...tcell, textAlign: "center" }}>{d.semester || "—"}</td>
                <td style={tcell}>{d.control_form || "—"}</td>
                <td style={{ ...tcell, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{[d.lecture_hours, d.lab_hours, d.practice_hours, d.ksr_hours, d.self_study_hours].map(v => v ?? "—").join("/")}</td>
                <td style={{ ...tcell, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{d.total_hours ?? "—"}</td>
                <td style={{ ...tcell, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{d.zet ?? "—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Btn onClick={onClose}>Закрыть</Btn>
        </div>
      </>}
    </div>
  </Modal>;
}
