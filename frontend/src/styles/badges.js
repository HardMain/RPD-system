export const statusBadge = ({ small = false, color, bg } = {}) => ({
  display: "inline-block",
  padding: small ? "2px 7px" : "2px 8px",
  borderRadius: 10,
  fontSize: small ? 10 : 11,
  fontWeight: 600,
  color,
  background: bg,
  whiteSpace: "nowrap",
});

export const statusChip = ({ color, bg } = {}) => ({
  fontSize: 10, fontWeight: 600,
  color, background: bg,
  padding: "1px 6px",
  borderRadius: 3,
  textTransform: "uppercase",
  letterSpacing: .3,
});
