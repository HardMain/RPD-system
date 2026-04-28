import { useEffect, useMemo, useState } from "react";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";
import { Input } from "../../components/Input.jsx";

export function CreateRpdModal({ onClose, onCreated }) {
  const [bups, setBups] = useState([]);
  const [bupId, setBupId] = useState("");
  const [bupDetail, setBupDetail] = useState(null);
  const [bdIds, setBdIds] = useState(new Set());
  const [archiveRpds, setArchiveRpds] = useState([]);
  const [year, setYear] = useState("2025/2026");
  const [baseId, setBaseId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBups().then(r => setBups(r.data)).catch(() => setBups([]));
    api.getRpds({ status: "Согласовано" }).then(r => setArchiveRpds(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bupId) { setBupDetail(null); setBdIds(new Set()); return; }
    api.getBup(bupId).then(r => setBupDetail(r.data)).catch(() => setBupDetail(null));
    setBdIds(new Set());
  }, [bupId]);

  const disciplines = bupDetail?.disciplines || [];

  function toggleBd(id) {
    setBdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const canSubmit = bdIds.size > 0;

  async function go() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const r = await api.createRpd({
        bup_discipline_ids: Array.from(bdIds),
        academic_year: year,
        based_on_rpd_id: baseId ? +baseId : null,
      });
      onCreated(r.data);
    } catch (e) {
      alert("Не удалось создать РПД: " + (e?.response?.data?.detail || e.message));
    }
    setLoading(false);
  }

  const selectStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F };
  const labelStyle = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };

  return <Modal onClose={onClose} width={620}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.borderLight }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Создание РПД</div>
    </div>
    <div style={{ padding: 20 }}>
      <Input label="Учебный год" value={year} onChange={e => setYear(e.target.value)} />

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Базовый учебный план (БУП)</label>
        <select value={bupId} onChange={e => setBupId(e.target.value)} style={selectStyle}>
          <option value="">— Выбрать БУП —</option>
          {bups.map(b => <option key={b.id_bup} value={b.id_bup}>
            {b.year ? b.year + " " : ""}{b.name} ({b.direction_code} {b.direction_name})
          </option>)}
        </select>
        {bups.length === 0 && (
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            БУПов нет. Попросите администратора загрузить XLS-файл БУПа.
          </div>
        )}
      </div>

      {bupDetail && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Дисциплины БУПа (выберите одну или несколько)</label>
          <div style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 260, overflow: "auto", background: T.surface }}>
            {disciplines.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: T.textMuted }}>
                В БУПе нет дисциплин.
              </div>
            )}
            {disciplines.map(d => {
              const checked = bdIds.has(d.id_bup_discipline);
              return <label key={d.id_bup_discipline}
                style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + T.borderLight, cursor: "pointer", background: checked ? T.accentLight : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleBd(d.id_bup_discipline)} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div><b>{d.code}</b> · {d.discipline_name}</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>
                    Сем. {d.semester || "—"} · {d.control_form || "—"} · всего {d.total_hours ?? "—"} ч
                  </div>
                </div>
              </label>;
            })}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            Выбрано: {bdIds.size}
          </div>
        </div>
      )}

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
      <Btn primary onClick={go} disabled={loading || !canSubmit}>{loading ? "Создание…" : "Создать"}</Btn>
    </div>
  </Modal>;
}
