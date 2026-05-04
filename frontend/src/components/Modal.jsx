import { useEffect } from "react";
import { T } from "../theme.js";

export function Modal({ children, onClose, width }) {

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(44,37,32,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 10, boxShadow: "0 20px 60px rgba(44,37,32,.25)", width: width || 480, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto" }}>{children}</div>
  </div>;
}
