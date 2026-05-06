import { T } from "../theme.js";

export const STATUSES = [
  { value: "Черновик",        color: T.textMuted, bg: T.borderLight },
  { value: "На доработке",    color: T.red,       bg: "#fbe5e5" },
  { value: "На согласовании", color: T.orange,    bg: T.orangeLight },
  { value: "Согласовано",     color: T.green,     bg: T.greenLight },
];

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map(s => [s.value, s]));

export function StatusBadge({ status, size = "md" }) {
  const s = STATUS_BY_VALUE[status];
  const color = s ? s.color : T.text;
  const bg = s ? s.bg : T.borderLight;
  const small = size === "sm";
  return <span style={{
    display: "inline-block",
    padding: small ? "2px 7px" : "2px 8px",
    borderRadius: 10,
    fontSize: small ? 10 : 11,
    fontWeight: 600,
    color,
    background: bg,
    whiteSpace: "nowrap",
  }}>{status || "—"}</span>;
}
