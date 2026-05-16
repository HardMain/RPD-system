import { T, statusBadge } from "../styles/index.js";

export const STATUSES = [
  { value: "Черновик",        color: T.textMuted, bg: T.borderLight },
  { value: "На доработке",    color: T.red,       bg: T.redSoft },
  { value: "На согласовании", color: T.orange,    bg: T.orangeLight },
  { value: "Согласовано",     color: T.green,     bg: T.greenLight },
];

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map(s => [s.value, s]));

export function StatusBadge({ status, size = "md" }) {
  const s = STATUS_BY_VALUE[status];
  const color = s ? s.color : T.text;
  const bg = s ? s.bg : T.borderLight;
  return <span style={statusBadge({ small: size === "sm", color, bg })}>{status || "—"}</span>;
}
