import { T, F } from "../theme.js";

export function Btn({ children, onClick, primary, danger, small, disabled, style: sx }) {
  const bg = disabled ? T.borderLight : primary ? T.accent : danger ? T.red : T.surface;
  const col = disabled ? T.textMuted : (primary || danger) ? "#fff" : T.text;
  return <button onClick={disabled ? undefined : onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "4px 12px" : "7px 18px", border: "1px solid " + (primary ? "transparent" : danger ? T.red : T.border), borderRadius: 5, background: bg, color: col, cursor: disabled ? "default" : "pointer", fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: F, whiteSpace: "nowrap", ...sx }}>{children}</button>;
}
