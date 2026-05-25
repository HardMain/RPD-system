import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "../styles/index.js";

const MIN_PX = 40;

export function useColumnWidths(storageKey, defaults, containerRef) {
  const lsKey = "colWidths." + storageKey;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const initialKeyRef = useRef(lsKey);

  const [widths, setWidths] = useState(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object") return { ...defaults, ...v };
      }
    } catch {}
    return { ...defaults };
  });

  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    if (initialKeyRef.current === lsKey) return;
    initialKeyRef.current = lsKey;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object") {
          setWidths({ ...defaultsRef.current, ...v });
          return;
        }
      }
    } catch {}
    setWidths({ ...defaultsRef.current });
  }, [lsKey]);

  const setPair = useCallback((curKey, nextKey, curVal, nextVal) => {
    setWidths(prev => {
      const next = { ...prev, [curKey]: Math.round(curVal), [nextKey]: Math.round(nextVal) };
      try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [lsKey]);

  const setWidth = useCallback((key, value) => {
    setWidths(prev => {
      const next = { ...prev, [key]: Math.max(MIN_PX, Math.round(value)) };
      try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [lsKey]);

  const resetWidths = useCallback(() => {
    try { localStorage.removeItem(lsKey); } catch {}
    setWidths({ ...defaultsRef.current });
  }, [lsKey]);

  const makeResizer = useCallback((curKey, nextKey) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startCur = widthsRef.current[curKey] ?? defaultsRef.current[curKey] ?? 100;
    if (!nextKey) {
      const onMove = (ev) => setWidth(curKey, startCur + (ev.clientX - startX));
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      return;
    }
    const startNext = widthsRef.current[nextKey] ?? defaultsRef.current[nextKey] ?? 100;
    const startSum = Object.values(widthsRef.current).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) || 1;
    const containerEl = containerRef?.current;
    const containerW = containerEl ? containerEl.getBoundingClientRect().width : startSum;
    const pxToUnits = containerW > 0 ? startSum / containerW : 1;
    const minUnits = MIN_PX * pxToUnits;
    const maxDeltaRight = startNext - minUnits;
    const maxDeltaLeft = -(startCur - minUnits);
    const onMove = (ev) => {
      const rawUnits = (ev.clientX - startX) * pxToUnits;
      const delta = Math.max(maxDeltaLeft, Math.min(maxDeltaRight, rawUnits));
      setPair(curKey, nextKey, startCur + delta, startNext - delta);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [setWidth, setPair, containerRef]);

  return { widths, setWidth, makeResizer, resetWidths };
}

export function useAutoColumnWidth(containerRef, otherSum, targetPx = 70) {
  const [w, setW] = useState(Math.max(35, targetPx));
  const otherSumRef = useRef(otherSum);
  otherSumRef.current = otherSum;

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const compute = () => {
      const cw = el.getBoundingClientRect().width;
      const sum = otherSumRef.current;
      if (cw > targetPx && sum > 0) {
        const v = Math.max(30, Math.round(targetPx * sum / (cw - targetPx)));
        setW(v);
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, targetPx]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const cw = el.getBoundingClientRect().width;
    if (cw > targetPx && otherSum > 0) {
      const v = Math.max(30, Math.round(targetPx * otherSum / (cw - targetPx)));
      setW(v);
    }
  }, [otherSum, targetPx, containerRef]);

  return w;
}

export function ResizeHandle({ onMouseDown }) {
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  return <span
    onMouseDown={onMouseDown}
    onClick={stop}
    onDoubleClick={stop}
    style={{
      position: "absolute", right: -4, top: 0, bottom: 0, width: 8,
      cursor: "col-resize", userSelect: "none", zIndex: 1,
      display: "flex", alignItems: "stretch", justifyContent: "center",
    }}
  >
    <span style={{ width: 1, marginTop: 6, marginBottom: 6, background: T.border }} />
  </span>;
}
