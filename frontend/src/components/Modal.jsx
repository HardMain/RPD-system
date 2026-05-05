import { useEffect, useRef } from "react";
import { T } from "../theme.js";

export function Modal({ children, onClose, width }) {
  const overlayDownRef = useRef(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function onOverlayMouseDown(e) {
    overlayDownRef.current = e.target === e.currentTarget;
  }
  function onOverlayClick(e) {
    if (e.target === e.currentTarget && overlayDownRef.current) onClose();
    overlayDownRef.current = false;
  }

  return <div onMouseDown={onOverlayMouseDown} onClick={onOverlayClick} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(44,37,32,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: T.surface, borderRadius: 10, boxShadow: "0 20px 60px rgba(44,37,32,.25)", width: width || 480, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto" }}>{children}</div>
  </div>;
}
