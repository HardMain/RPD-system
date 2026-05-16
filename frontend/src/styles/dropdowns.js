import { T, F, SH, Z } from "./theme.js";

export const dropdownTrigger = ({ disabled = false, empty = false, wrap = true } = {}) => ({
  width: "100%",
  textAlign: "left",
  padding: "6px 26px 6px 10px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  background: disabled ? "transparent" : T.surface,
  fontSize: 13,
  fontFamily: F,
  cursor: disabled ? "default" : "pointer",
  lineHeight: 1.35,
  position: "relative",
  color: empty ? T.textMuted : T.text,
  fontStyle: empty ? "italic" : "normal",
  boxSizing: "border-box",
  outline: "none",
  ...(wrap
    ? { whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" }
    : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
});

export const dropdownChevron = (fontSize = 16) => ({
  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
  color: T.textMuted, fontSize, fontWeight: 700,
  pointerEvents: "none", lineHeight: 1,
});

export const dropdownPopup = ({ left, top, width, maxHeight = 240, padding } = {}) => ({
  position: "fixed",
  left, top, width,
  background: T.surface,
  border: "1px solid " + T.border,
  borderRadius: 4,
  boxShadow: SH.dropdown,
  zIndex: Z.popup,
  maxHeight,
  overflowY: "auto",
  ...(padding ? { padding } : {}),
});

export const dropdownItem = ({ picked = false, fontSize = 13, padding = "8px 10px", lineHeight = 1.4, borderBottom = true } = {}) => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding,
  border: "none",
  borderBottom: borderBottom ? "1px solid " + T.borderLight : "none",
  background: picked ? T.accentLight : "transparent",
  cursor: "pointer",
  fontFamily: F,
  fontSize,
  color: picked ? T.accent : T.text,
  fontWeight: picked ? 600 : 400,
  lineHeight,
  wordBreak: "normal",
  overflowWrap: "break-word",
  whiteSpace: "normal",
});
