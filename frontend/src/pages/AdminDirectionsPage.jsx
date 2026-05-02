import { useEffect, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T } from "../theme.js";
import { Btn } from "../components/Btn.jsx";
import { Spinner } from "../components/Spinner.jsx";

const cellStyle = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight, fontSize: 13, verticalAlign: "middle" };
const headStyle = { ...cellStyle, fontWeight: 700, color: T.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: ".4px", background: T.bg };

export function AdminDirectionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const inputRefs = useRef({});

  const reload = () => {
    setLoading(true);
    api.adminListDirections().then(r => setItems(r.data)).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  async function uploadFor(directionId, file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { alert("Ожидается PDF"); return; }
    setBusyId(directionId);
    try { await api.adminUploadFgos(directionId, file); reload(); }
    catch (e) { alert("Ошибка загрузки: " + (e?.response?.data?.detail || e.message)); }
    setBusyId(null);
  }

  async function remove(directionId) {
    if (!confirm("Открепить файл ФГОС от направления?")) return;
    setBusyId(directionId);
    try { await api.adminRemoveFgos(directionId); reload(); }
    catch { alert("Не удалось открепить"); }
    setBusyId(null);
  }

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Направления подготовки и файлы ФГОС</div>
      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, overflow: "hidden" }}>
        {loading
          ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
          : items.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Направлений нет.</div>
            : <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={headStyle}>Код</th>
                <th style={headStyle}>Наименование</th>
                <th style={headStyle}>Профиль</th>
                <th style={headStyle}>Файл ФГОС</th>
                <th style={headStyle} />
              </tr></thead>
              <tbody>
                {items.map(d => (
                  <tr key={d.id_direction}>
                    <td style={cellStyle}><b>{d.code}</b></td>
                    <td style={cellStyle}>{d.name}</td>
                    <td style={cellStyle}>{d.profile || "—"}</td>
                    <td style={cellStyle}>
                      {d.fgos_file_id
                        ? <a href={api.fileUrl(d.fgos_file_id)} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600 }}>{d.fgos_file_name}</a>
                        : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не загружен</span>}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                      <input
                        ref={el => (inputRefs.current[d.id_direction] = el)}
                        type="file" accept="application/pdf" style={{ display: "none" }}
                        onChange={e => { uploadFor(d.id_direction, e.target.files?.[0]); e.target.value = ""; }}
                      />
                      <Btn small onClick={() => inputRefs.current[d.id_direction]?.click()} disabled={busyId === d.id_direction}>
                        {d.fgos_file_id ? "Заменить" : "Загрузить ФГОС"}
                      </Btn>
                      {d.fgos_file_id && <Btn small danger onClick={() => remove(d.id_direction)} style={{ marginLeft: 6 }}>×</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>}
      </div>
    </div>
  </div>;
}
