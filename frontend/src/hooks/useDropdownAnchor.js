import { useLayoutEffect, useState } from "react";

export function useDropdownAnchor(wrapRef, open, { observeResize = false } = {}) {
  const [coords, setCoords] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setCoords(null); return; }
    const el = wrapRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      setCoords({ left: r.left, top: r.bottom + 2, width: r.width });
    };
    place();
    let ro;
    if (observeResize) { ro = new ResizeObserver(place); ro.observe(el); }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  return coords;
}
