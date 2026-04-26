import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Badge } from "../components/Badge.jsx";
import { PlusIcon, DownloadIcon, EyeIcon, PencilIcon } from "../components/icons.jsx";

const COLS = [
  { label: "Направление", align: "left" },
  { label: "Дисциплина", align: "left" },
  { label: "Год", align: "center" },
  { label: "Часы", align: "center" },
  { label: "Семестр", align: "center" },
  { label: "Статус", align: "left" },
  { label: "", align: "center" },
];

export function RpdListPage({ rpds, onOpen, onEdit, onCreate, onExportPdf, userRole }) {
  const canCreate = ["Зав. кафедрой", "Сотрудник УМУ", "Администратор"].includes(userRole);
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", flexShrink: 0, background: T.surface, borderBottom: "1px solid " + T.border }}>
      {canCreate ? <Btn small onClick={onCreate}><PlusIcon /> Создать РПД</Btn> : <div />}
      <span style={{ fontSize: 12, color: T.textMuted }}>{rpds.length} РПД</span>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
        <thead><tr style={{ background: T.surface }}>{COLS.map((c, i) => <th key={i} style={{ ...hdr, textAlign: c.align }}>{c.label}</th>)}</tr></thead>
        <tbody>{rpds.map(r => {
          const canEdit = r.status === "Черновик" || r.status === "На доработке";
          const iconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 7px", borderRadius: 4, border: "1px solid " + T.border, background: T.surface, color: T.text, fontFamily: F };
          return <tr key={r.id_rpd} onDoubleClick={() => onOpen(r)} style={{ background: T.surface, cursor: "pointer" }}>
            <td style={tcell}>{r.direction_code}</td>
            <td style={{ ...tcell, fontWeight: 600 }}>{r.discipline_name}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.academic_year}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.total_hours || "-"}</td>
            <td style={{ ...tcell, textAlign: "center" }}>{r.semester || "-"}</td>
            <td style={tcell}><Badge status={r.status} /></td>
            <td style={{ ...tcell, textAlign: "center", width: 1, whiteSpace: "nowrap", padding: "10px 8px" }}>
              <div style={{ display: "inline-flex", gap: 4 }}>
                <button onClick={e => { e.stopPropagation(); onOpen(r); }} title="Просмотр" style={{ ...iconBtn, cursor: "pointer" }}><EyeIcon /></button>
                <button onClick={canEdit ? (e => { e.stopPropagation(); onEdit(r); }) : undefined} disabled={!canEdit} title={canEdit ? "Редактировать" : "Нельзя редактировать в текущем статусе"} style={{ ...iconBtn, cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.35 }}><PencilIcon /></button>
                <button onClick={e => { e.stopPropagation(); onExportPdf(r.id_rpd); }} title="Скачать PDF" style={{ ...iconBtn, cursor: "pointer" }}><DownloadIcon /></button>
              </div>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}
