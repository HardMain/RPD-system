const PALETTE_KEYS = [
  "bg", "surface", "border", "borderLight",
  "accent", "accentLight", "accentDark",
  "orange", "orangeLight", "green", "greenLight",
  "red", "redSoft", "redBg", "text", "textMuted", "textLight",
  "headerBg", "headerText",
  "selectedRow", "tabActive", "tabInactive", "pdfBg",
  "blue", "blueLight", "white",
  "accentGhost", "accentGlow", "redGhost", "redGlow", "unreadBg",
  "headerChip", "headerChipHover",
];

export const T = Object.fromEntries(
  PALETTE_KEYS.map(k => [k, `var(--c-${k})`])
);

export const THEME_LIGHT = {
  bg: "#f0ede8", surface: "#ffffff", border: "#c4bcb0", borderLight: "#ddd8d0",
  accent: "#6b4f8a", accentLight: "#e8dff4", accentDark: "#503a6e",
  orange: "#d97320", orangeLight: "#fef0e2", green: "#2f8a4e", greenLight: "#e4f4eb",
  red: "#c93c3c", redSoft: "#fbe5e5", redBg: "#fde6e3",
  text: "#2a231e", textMuted: "#78716a", textLight: "#a8a098",
  headerBg: "#322c28", headerText: "#f0ede8",
  selectedRow: "#e8dff4", tabActive: "#ffffff", tabInactive: "#e4e0d8", pdfBg: "#4a4d50",
  blue: "#3367d6", blueLight: "#e8f0fe", white: "#ffffff",
  accentGhost: "rgba(107,79,138,0)", accentGlow: "rgba(107,79,138,.4)",
  redGhost: "rgba(201,60,60,0)", redGlow: "rgba(201,60,60,.67)",
  unreadBg: "rgba(232,223,244,.27)",
  headerChip: "rgba(255,255,255,.07)", headerChipHover: "rgba(255,255,255,.16)",
};

export const THEME_DARK = {
  bg: "#1c1a18", surface: "#26231f", border: "#4a443c", borderLight: "#38332d",
  accent: "#b89cdb", accentLight: "#3a2f4e", accentDark: "#d4c2ef",
  orange: "#e08a3c", orangeLight: "#3a2c1c", green: "#4caf6e", greenLight: "#1f3326",
  red: "#e06464", redSoft: "#3a2222", redBg: "#3a2222",
  text: "#ece7df", textMuted: "#a59c8f", textLight: "#7a7268",
  headerBg: "#161412", headerText: "#ece7df",
  selectedRow: "#3a2f4e", tabActive: "#26231f", tabInactive: "#2e2a25", pdfBg: "#2a2c2e",
  blue: "#6f9bff", blueLight: "#1e2a40", white: "#ffffff",
  accentGhost: "rgba(184,156,219,0)", accentGlow: "rgba(184,156,219,.4)",
  redGhost: "rgba(224,100,100,0)", redGlow: "rgba(224,100,100,.6)",
  unreadBg: "rgba(58,47,78,.5)",
  headerChip: "rgba(255,255,255,.07)", headerChipHover: "rgba(255,255,255,.16)",
};

export const F = "'Segoe UI','Roboto',-apple-system,sans-serif";

export const OVERLAY = "rgba(44,37,32,.45)";

export const SH = {
  dropdown: "0 6px 20px rgba(0,0,0,.14)",
  modal: "0 20px 60px rgba(44,37,32,.25)",
};

export const Z = {
  popup: 1100,
  modal: 1000,
};
