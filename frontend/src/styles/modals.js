import { T, OVERLAY, SH, Z } from "./theme.js";

export const modalOverlay = {
  position: "fixed", inset: 0, zIndex: Z.modal,
  background: OVERLAY,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export const modalBox = (width) => ({
  background: T.surface,
  borderRadius: 10,
  boxShadow: SH.modal,
  width: width || 480,
  maxWidth: "92vw",
  maxHeight: "88vh",
  overflow: "auto",
});

export const modalFooter = {
  display: "flex", justifyContent: "flex-end", gap: 8,
  padding: "12px 20px",
  borderTop: "1px solid " + T.borderLight,
};

export const modalCenterBody = { padding: "24px 24px 16px", textAlign: "center" };
export const modalTitle = { fontSize: 16, fontWeight: 700, marginBottom: 8 };

export const modalIconHeader = (align = "flex-start") => ({
  padding: "18px 24px",
  borderBottom: "1px solid " + T.borderLight,
  display: "flex", alignItems: align, gap: align === "center" ? 10 : 12,
});

export const modalIconCircle = (bg) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36, borderRadius: 18,
  background: bg, flexShrink: 0,
});

export const modalHeadTitle = { fontSize: 15, fontWeight: 700 };
export const modalHeadSub = { fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.45 };

export const modalTitleHeader = {
  padding: "18px 24px",
  borderBottom: "1px solid " + T.borderLight,
  fontSize: 16, fontWeight: 700,
};

export const modalFooterWide = (justify = "flex-end") => ({
  padding: "12px 20px",
  borderTop: "1px solid " + T.borderLight,
  display: "flex", justifyContent: justify, gap: 10,
});
