import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";

export function ApprovalPage({ rpds, onOpen }) {
  const ar = rpds.filter(r => r.status === "На согласовании" || r.status === "На доработке");
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
        <thead><tr style={{ background: T.surface }}>{["Направление", "Дисциплина", "Год", "Статус", "Автор"].map(h => <th key={h} style={hdr}>{h}</th>)}</tr></thead>
        <tbody>{ar.map(r => <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
          <td style={tcell}>{r.direction_code}</td>
          <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
          <td style={tcell}>{r.academic_year}</td>
          <td style={tcell}>{r.status}</td>
          <td style={tcell}>{r.author_name}</td>
        </tr>)}</tbody>
      </table>
      </div>
      {ar.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Нет РПД на согласовании</div>}
    </div>
  </div>;
}
