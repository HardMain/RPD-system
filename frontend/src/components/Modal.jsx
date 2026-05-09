import { useEffect, useRef } from "react";
import { T } from "../theme.js";

export function Modal({ children, onClose, width }) {
  const startedOnOverlayRef = useRef(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function onOverlayMouseDown(e) {
    startedOnOverlayRef.current = e.target === e.currentTarget;
  }
  function onOverlayMouseUp(e) {
    const startedOnOverlay = startedOnOverlayRef.current;
    startedOnOverlayRef.current = false;
    if (startedOnOverlay && e.target === e.currentTarget) onClose();
  }

  return <div onMouseDown={onOverlayMouseDown} onMouseUp={onOverlayMouseUp} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(44,37,32,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: T.surface, borderRadius: 10, boxShadow: "0 20px 60px rgba(44,37,32,.25)", width: width || 480, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto" }}>{children}</div>
  </div>;
}
