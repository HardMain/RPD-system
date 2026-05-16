import { T, inputBase, fieldLabel } from "../styles/index.js";

export function Input({ label, value, onChange, type, placeholder, textarea, required, style: sx, disabled }) {
  const shared = { ...inputBase, ...sx };
  return <div style={{ marginBottom: 12 }}>
    {label && <label style={fieldLabel}>{label}{required && <span style={{ color: T.red }}> *</span>}</label>}
    {textarea
      ? <textarea value={value} onChange={onChange} placeholder={placeholder} style={{ ...shared, minHeight: 100, resize: "vertical" }} />
      : <input type={type || "text"} value={value} onChange={onChange} placeholder={placeholder} style={shared} disabled={disabled} />}
  </div>;
}
