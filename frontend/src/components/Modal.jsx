import { useEffect, useRef } from "react";
import { modalOverlay, modalBox } from "../styles/index.js";

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

  return <div onMouseDown={onOverlayMouseDown} onMouseUp={onOverlayMouseUp} style={modalOverlay}>
    <div style={modalBox(width)}>{children}</div>
  </div>;
}
