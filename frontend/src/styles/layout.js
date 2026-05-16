import { T, F } from "./theme.js";

export const pageContainer = {
  flex: 1, display: "flex", flexDirection: "column",
  overflow: "hidden", background: T.bg,
};

export const pageToolbar = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "8px 16px", flexShrink: 0,
  background: T.surface, borderBottom: "1px solid " + T.border,
  flexWrap: "wrap",
};

export const pageScroll = { flex: 1, overflow: "auto", padding: 16 };

export const dataTable = { width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F };

export const toolbarSearch = {
  flex: 1, minWidth: 220, maxWidth: 420,
  padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4,
  background: T.bg, fontSize: 13, fontFamily: F, color: T.text, outline: "none",
};

export const adminAddPanel = {
  background: T.surface, border: "1px solid " + T.borderLight,
  borderRadius: 6, padding: 12, marginBottom: 14,
};

export const adminToolbar = {
  display: "flex", alignItems: "center", gap: 12,
  marginBottom: 10, flexWrap: "wrap",
};

export const adminSearch = (maxWidth = 420) => ({
  flex: 1, minWidth: 220, maxWidth,
  padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4,
  fontSize: 13, fontFamily: F, outline: "none",
});

export const filterChipStyle = ({ active = false, color, bg } = {}) => {
  const activeColor = color || T.accent;
  const activeBg = bg || T.accentLight;
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 12,
    border: "1px solid " + (active ? activeColor : T.border),
    background: active ? activeBg : T.surface,
    color: active ? activeColor : T.text,
    fontSize: 12, fontWeight: active ? 700 : 500,
    cursor: "pointer", fontFamily: F,
    whiteSpace: "nowrap",
  };
};
