import { T, F } from "../theme.js";

export function TabBtn({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "6px 14px", border: "1px solid " + (active ? T.accent : T.border), borderBottom: active ? "2px solid " + T.accent : "1px solid transparent", borderRadius: "5px 5px 0 0", background: active ? T.accentLight : T.tabInactive, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? T.accent : T.text, fontFamily: F, whiteSpace: "nowrap" }}>{label}</button>;
}
