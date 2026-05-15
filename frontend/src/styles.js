import { T, F } from "./theme.js";

export const pdfToolBtn = (disabled) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 24, padding: 0,
  border: "1px solid " + T.border, borderRadius: 4,
  background: disabled ? T.borderLight : T.surface,
  color: disabled ? T.textLight : T.text,
  cursor: disabled ? "default" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: F,
});

export const td = { padding: 8, border: "1px solid " + T.borderLight, fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };
export const th = { padding: 8, border: "1px solid " + T.border, background: T.bg, fontWeight: 700, textAlign: "left", fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };

export const hdr = { padding: "10px 12px", borderBottom: "2px solid " + T.border, textAlign: "left", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: .5 };
export const tcell = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight, overflowWrap: "break-word", wordBreak: "break-word" };

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

