import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";

export function ArchivePage({ rpds, onOpen }) {
  const items = rpds.filter(r => r.status === "Согласовано");
  return <div style={{ flex: 1, overflow: "auto", padding: 16, background: T.bg }}>
    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
      <thead><tr style={{ background: T.surface }}>{["Дисциплина", "Год", "Автор", "Статус"].map(h => <th key={h} style={hdr}>{h}</th>)}</tr></thead>
      <tbody>{items.map(r => <tr key={r.id_rpd} onClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
        <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
        <td style={tcell}>{r.academic_year}</td>
        <td style={tcell}>{r.author_name}</td>
        <td style={tcell}>{r.status}</td>
      </tr>)}</tbody>
    </table>
    </div>
  </div>;
}
