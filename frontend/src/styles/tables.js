import { T } from "./theme.js";

export const td = { padding: 8, border: "1px solid " + T.borderLight, fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };
export const th = { padding: 8, border: "1px solid " + T.border, background: T.bg, fontWeight: 700, textAlign: "left", fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };

export const hdr = { padding: "10px 12px", borderBottom: "2px solid " + T.border, textAlign: "left", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: .5 };
export const tcell = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight, overflowWrap: "break-word", wordBreak: "break-word" };
