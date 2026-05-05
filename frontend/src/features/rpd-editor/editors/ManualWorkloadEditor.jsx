import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";

export function ManualWorkloadEditor({ link, rpdId, canEdit, reload }) {
  const incomingFromLink = () =>
    Array.isArray(link?.semesters_data) && link.semesters_data.length > 0
      ? link.semesters_data.map(s => ({
          number: s.number,
          lecture: s.lecture || 0,
          lab: s.lab || 0,
          practice: s.practice || 0,
          ksr: s.ksr || 0,
          srs: s.srs || 0,
        }))
      : [];
  const [sems, setSems] = useState(incomingFromLink);
  const lastServerRef = useRef(JSON.stringify(sems));

  useEffect(() => {
    const incoming = incomingFromLink();
    const key = JSON.stringify(incoming);
    if (key !== lastServerRef.current) {
      lastServerRef.current = key;
      setSems(incoming);
    }
  }, [link?.semesters_data]);

  async function persist(next) {
    const sorted = [...next].sort((a, b) => a.number - b.number);
    const key = JSON.stringify(sorted);
    if (key === lastServerRef.current) return;
    lastServerRef.current = key;
    try {
      await api.updateManualLink(rpdId, { semesters_data: sorted });
      await reload?.();
    } catch (e) {
      alert("Не удалось сохранить часы: " + (e?.response?.data?.detail || e.message));
    }
  }
  function setCell(idx, field, value) {
    setSems(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function commit() {
    persist(sems);
  }

  if (sems.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
      Сначала укажите семестры в шапке РПД (поле «Семестры»). После этого здесь появятся строки для редактирования часов.
    </div>;
  }

  const sumLec = sems.reduce((a, s) => a + (+s.lecture || 0), 0);
  const sumLab = sems.reduce((a, s) => a + (+s.lab || 0), 0);
  const sumPr = sems.reduce((a, s) => a + (+s.practice || 0), 0);
  const sumKsr = sems.reduce((a, s) => a + (+s.ksr || 0), 0);
  const sumSrs = sems.reduce((a, s) => a + (+s.srs || 0), 0);
  const sumAud = sumLec + sumLab + sumPr + sumKsr + sumSrs;

  return <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col style={{ width: 70 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 70 }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: "center" }}>Сем.</th>
          <th style={{ ...th, textAlign: "center" }}>Лек</th>
          <th style={{ ...th, textAlign: "center" }}>Лаб</th>
          <th style={{ ...th, textAlign: "center" }}>ПЗ</th>
          <th style={{ ...th, textAlign: "center" }}>КСР</th>
          <th style={{ ...th, textAlign: "center" }}>СРС</th>
          <th style={{ ...th, textAlign: "center" }}>Итого</th>
        </tr>
      </thead>
      <tbody>
        {sems.map((s, idx) => {
          const itog = (+s.lecture || 0) + (+s.lab || 0) + (+s.practice || 0) + (+s.ksr || 0) + (+s.srs || 0);
          return <tr key={s.number}>
            <td style={{ ...cellNum, fontWeight: 700, background: T.bg }}>{s.number}</td>
            <td style={cellNum}><HourInput disabled={!canEdit} value={s.lecture} onChange={v => setCell(idx, "lecture", v)} onBlur={commit} /></td>
            <td style={cellNum}><HourInput disabled={!canEdit} value={s.lab} onChange={v => setCell(idx, "lab", v)} onBlur={commit} /></td>
            <td style={cellNum}><HourInput disabled={!canEdit} value={s.practice} onChange={v => setCell(idx, "practice", v)} onBlur={commit} /></td>
            <td style={cellNum}><HourInput disabled={!canEdit} value={s.ksr} onChange={v => setCell(idx, "ksr", v)} onBlur={commit} /></td>
            <td style={cellNum}><HourInput disabled={!canEdit} value={s.srs} onChange={v => setCell(idx, "srs", v)} onBlur={commit} /></td>
            <td style={{ ...cellNum, fontWeight: 700, background: T.bg }}>{itog}</td>
          </tr>;
        })}
        <tr>
          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: T.textMuted, background: T.surface }}>Сумма</td>
          <td style={totalCell}>{sumLec}</td>
          <td style={totalCell}>{sumLab}</td>
          <td style={totalCell}>{sumPr}</td>
          <td style={totalCell}>{sumKsr}</td>
          <td style={totalCell}>{sumSrs}</td>
          <td style={{ ...totalCell, fontWeight: 700, background: T.accentLight, color: T.accent }}>{sumAud}</td>
        </tr>
      </tbody>
    </table>
  </div>;
}

function HourInput({ value, onChange, onBlur, disabled, min = 0, max, step }) {
  return <input
    type="number"
    min={min}
    max={max}
    step={step ?? 1}
    value={value ?? 0}
    disabled={disabled}
    onChange={e => {
      const raw = e.target.value;
      if (raw === "") { onChange(min); return; }
      const n = +raw;
      if (!Number.isFinite(n)) return;
      let v = n;
      if (typeof min === "number" && v < min) v = min;
      if (typeof max === "number" && v > max) v = max;
      onChange(v);
    }}
    onBlur={onBlur}
    style={hourInputStyle}
  />;
}

const cellNum = { ...td, textAlign: "center", padding: "3px 4px" };
const totalCell = { ...cellNum, fontWeight: 700, fontVariantNumeric: "tabular-nums", background: T.surface };
const hourInputStyle = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};
