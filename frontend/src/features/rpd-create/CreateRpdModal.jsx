import { useEffect, useState } from "react";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";
import { Input } from "../../components/Input.jsx";

export function CreateRpdModal({ onClose, onCreated }) {
  const [dirs, setDirs] = useState([]);
  const [discs, setDiscs] = useState([]);
  const [archiveRpds, setArchiveRpds] = useState([]);
  const [dirId, setDirId] = useState("");
  const [discId, setDiscId] = useState("");
  const [year, setYear] = useState("2025/2026");
  const [baseId, setBaseId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getDirections().then(r => setDirs(r.data));
    api.getRpds({ status: "Согласовано" }).then(r => setArchiveRpds(r.data)).catch(() => { });
  }, []);
  useEffect(() => { if (dirId) api.getDisciplines(dirId).then(r => setDiscs(r.data)); else setDiscs([]); }, [dirId]);

  const go = async () => {
    if (!discId) return; setLoading(true);
    try {
      const r = await api.createRpd({ id_discipline: +discId, academic_year: year, based_on_rpd_id: baseId ? +baseId : null });
      onCreated(r.data);
    } catch { }
    setLoading(false);
  };

  const selectStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F };
  const labelStyle = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };

  return <Modal onClose={onClose} width={500}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.borderLight }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Создание РПД</div>
    </div>
    <div style={{ padding: 20 }}>
      <Input label="Учебный год" value={year} onChange={e => setYear(e.target.value)} />
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Направление</label>
        <select value={dirId} onChange={e => setDirId(e.target.value)} style={selectStyle}>
          <option value="">— Выбрать —</option>
          {dirs.map(d => <option key={d.id_direction} value={d.id_direction}>{d.code} {d.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Дисциплина</label>
        <select value={discId} onChange={e => setDiscId(e.target.value)} style={selectStyle}>
          <option value="">— Выбрать —</option>
          {discs.map(d => <option key={d.id_discipline} value={d.id_discipline}>{d.code} {d.name} (сем. {d.semester})</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>На основе архивной РПД (необязательно)</label>
        <select value={baseId} onChange={e => setBaseId(e.target.value)} style={selectStyle}>
          <option value="">— Не копировать —</option>
          {archiveRpds.map(r => <option key={r.id_rpd} value={r.id_rpd}>{r.discipline_name} ({r.academic_year})</option>)}
        </select>
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid " + T.borderLight }}>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn primary onClick={go} disabled={loading || !discId}>{loading ? "Создание..." : "Создать"}</Btn>
    </div>
  </Modal>;
}
