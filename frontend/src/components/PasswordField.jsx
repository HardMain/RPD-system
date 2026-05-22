import { useState } from "react";
import { T, fieldLabel, inputBase } from "../styles/index.js";
import { EyeIcon, EyeOffIcon } from "./icons.jsx";

export function PasswordField({ label, value, onChange, onKeyDown, placeholder, required, autoFocus, disabled }) {
  const [show, setShow] = useState(false);
  return <div style={{ marginBottom: 12 }}>
    {label && <label style={fieldLabel}>{label}{required && <span style={{ color: T.red }}> *</span>}</label>}
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        style={{ ...inputBase, paddingRight: 38 }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        title={show ? "Скрыть пароль" : "Показать пароль"}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", padding: 6, cursor: "pointer",
          color: T.textMuted, display: "flex", lineHeight: 0,
        }}
      >
        {show ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </div>
  </div>;
}
