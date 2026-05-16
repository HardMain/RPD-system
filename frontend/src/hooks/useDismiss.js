import { useEffect, useRef } from "react";

export function useDismiss(open, onDismiss, refs) {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  useEffect(() => {
    if (!open) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const onDocClick = (e) => {
      for (const r of list) {
        if (r && r.current && r.current.contains(e.target)) return;
      }
      cb.current();
    };
    const onKey = (e) => { if (e.key === "Escape") cb.current(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}
