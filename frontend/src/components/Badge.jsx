import { T } from "../theme.js";

const STATUS_MAP = {
  "Черновик": { bg: T.bg, c: T.textMuted, bc: T.border },
  "На доработке": { bg: T.orangeLight, c: T.orange, bc: T.orange },
  "На согласовании": { bg: T.accentLight, c: T.accent, bc: T.accent },
  "Согласовано": { bg: T.greenLight, c: T.green, bc: T.green },
};

export function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP["Черновик"];
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: s.bg, color: s.c, border: "1px solid " + s.bc, whiteSpace: "nowrap" }}>{status}</span>;
}
