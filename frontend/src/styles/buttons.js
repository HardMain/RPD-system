import { T, F } from "./theme.js";

export const btnStyle = ({ primary, danger, small, disabled } = {}) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: small ? "4px 12px" : "7px 18px",
  border: "1px solid " + (primary ? "transparent" : danger ? T.red : T.border),
  borderRadius: 5,
  background: disabled ? T.borderLight : primary ? T.accent : danger ? T.red : T.surface,
  color: disabled ? T.textMuted : (primary || danger) ? T.white : T.text,
  cursor: disabled ? "default" : "pointer",
  fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: F,
  whiteSpace: "nowrap",
});

export const pdfToolBtn = (disabled) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 24, padding: 0,
  border: "1px solid " + T.border, borderRadius: 4,
  background: disabled ? T.borderLight : T.surface,
  color: disabled ? T.textLight : T.text,
  cursor: disabled ? "default" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: F,
});

export const iconBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "5px 7px", borderRadius: 4,
  border: "1px solid " + T.border, background: T.surface,
  color: T.text, fontFamily: F,
};

export const iconBtnDisabled = (active) => ({
  ...iconBtn,
  cursor: active ? "pointer" : "not-allowed",
  opacity: active ? 1 : 0.35,
});
