import { T } from "../theme.js";

export function OnApprovalPage({ rpds, onOpen }) {
  const items = rpds.filter(r => r.status === "На согласовании");
  return <div style={{ flex: 1, overflow: "auto", padding: 16, background: T.bg }}>
    {items.map(r => <div key={r.id_rpd} onClick={() => onOpen(r)} style={{ padding: "12px 16px", background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.discipline_name}</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>{r.direction_code} — {r.academic_year}</div>
      </div>
      <span style={{ fontSize: 12, color: T.text }}>{r.status}</span>
    </div>)}
    {items.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Нет РПД на согласовании</div>}
  </div>;
}
