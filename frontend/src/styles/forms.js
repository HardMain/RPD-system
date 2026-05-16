import { T, F } from "./theme.js";

export const inputBase = {
  width: "100%", padding: "8px 12px",
  border: "1px solid " + T.border, borderRadius: 6,
  fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box",
};

export const fieldLabel = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };

export const sectionLabel = { fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 };

export const formErrorBox = { background: T.redBg, color: T.red, padding: "8px 12px", borderRadius: 6, fontSize: 13 };

export const inlineTextarea = {
  width: "100%",
  minHeight: 32,
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F, lineHeight: 1.45,
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};

export const inlineInput = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};

export const inlineNumber = {
  width: "auto",
  fieldSizing: "content",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
};
