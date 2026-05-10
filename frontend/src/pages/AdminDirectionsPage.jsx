import { useEffect, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Spinner } from "../components/Spinner.jsx";
import { TrashIcon, UploadIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";

export function AdminDirectionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const inputRefs = useRef({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListDirections().then(r => setItems(r.data)).catch(() => { if (!silent) setItems([]); }).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function uploadFor(directionId, file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setErrorMsg("Ожидается PDF-файл."); return; }
    setBusyId(directionId);
    try { await api.adminUploadFgos(directionId, file); reload(); }
    catch (e) { setErrorMsg("Ошибка загрузки: " + (e?.response?.data?.detail || e.message)); }
    setBusyId(null);
  }

  async function performRemove(d) {
    if (!d) return;
    setBusyId(d.id_direction);
    try { await api.adminRemoveFgos(d.id_direction); reload(); }
    catch { setErrorMsg("Не удалось открепить файл ФГОС."); }
    setBusyId(null);
  }
  function remove(d) { setPendingDelete(d); }

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Направления подготовки и файлы ФГОС</div>
      <div className="table-scroll">
        {loading
          ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
          : items.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Направлений нет.</div>
            : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
              <thead><tr style={{ background: T.surface }}>
                <th style={hdr}>Код</th>
                <th style={hdr}>Наименование</th>
                <th style={hdr}>Профиль</th>
                <th style={hdr}>Файл ФГОС</th>
                <th style={{ ...hdr, textAlign: "center" }} />
              </tr></thead>
              <tbody>
                {items.map(d => {
                  const busy = busyId === d.id_direction;
                  return <tr key={d.id_direction} style={{ background: T.surface }}>
                    <td style={{ ...tcell, fontWeight: 600 }}>{d.code}</td>
                    <td style={tcell}>{d.name}</td>
                    <td style={{ ...tcell, color: d.profile ? T.text : T.textMuted }}>{d.profile || "—"}</td>
                    <td style={tcell}>
                      {d.fgos_file_id
                        ? <a href={api.fileUrl(d.fgos_file_id)} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600 }}>{d.fgos_file_name}</a>
                        : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не загружен</span>}
                    </td>
                    <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }}>
                      <input
                        ref={el => (inputRefs.current[d.id_direction] = el)}
                        type="file" accept="application/pdf" style={{ display: "none" }}
                        onChange={e => { uploadFor(d.id_direction, e.target.files?.[0]); e.target.value = ""; }}
                      />
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button onClick={() => inputRefs.current[d.id_direction]?.click()} disabled={busy} title={d.fgos_file_id ? "Заменить файл ФГОС" : "Загрузить файл ФГОС"} style={{ ...iconBtn, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.35 : 1 }}><UploadIcon /></button>
                        <button onClick={d.fgos_file_id ? () => remove(d) : undefined} disabled={!d.fgos_file_id} title={d.fgos_file_id ? "Открепить файл ФГОС" : "Файл не загружен"} style={{ ...iconBtn, cursor: d.fgos_file_id ? "pointer" : "not-allowed", opacity: d.fgos_file_id ? 1 : 0.35 }}><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>}
      </div>
    </div>
    {pendingDelete && <ConfirmDeleteModal
      title="Открепить файл ФГОС?"
      message={`Файл «${pendingDelete.fgos_file_name || "—"}» будет отвязан от направления «${pendingDelete.code} ${pendingDelete.name}». Сам файл в общем хранилище останется и его можно будет прикрепить заново.`}
      confirmLabel="Открепить"
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performRemove(d); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}
