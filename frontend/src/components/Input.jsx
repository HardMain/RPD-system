import { T, F } from "../theme.js";

export function Input({ label, value, onChange, type, placeholder, textarea, required, style: sx, disabled }) {
  const shared = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box", ...sx };
  return <div style={{ marginBottom: 12 }}>
    {label && <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>{label}{required && <span style={{ color: T.red }}> *</span>}</label>}
    {textarea
      ? <textarea value={value} onChange={onChange} placeholder={placeholder} style={{ ...shared, minHeight: 100, resize: "vertical" }} />
      : <input type={type || "text"} value={value} onChange={onChange} placeholder={placeholder} style={shared} disabled={disabled} />}
  </div>;
}
