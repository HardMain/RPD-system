import { useEffect, useLayoutEffect, useRef, useState, memo } from "react";
import { T, F } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { ChevronDownIcon, ChevronUpIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ClearSectionBtn } from "../ClearSectionBtn.jsx";
import { GenPlaque } from "../GenPlaque.jsx";
import { GenButton } from "../GenButton.jsx";

const COLLAPSED_HEIGHT = 110;
const DEFAULT_PLACEHOLDER = "Введите текст для заполнения раздела…";

function EditableBlockBase({ skey, label, fieldKey, placeholder }) {
  const { isEdit, canEdit, generating, genResult, genBusy, autoFill, editTexts, saveField } = useRpdEditor();
  const ctxVal = editTexts[fieldKey] || "";
  const editable = isEdit && canEdit;
  const ph = placeholder || DEFAULT_PLACEHOLDER;

  const [local, setLocal] = useState(ctxVal);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setLocal(ctxVal);
  }, [ctxVal]);
  const val = editable ? local : ctxVal;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const taRef = useRef(null);
  const divRef = useRef(null);

  useLayoutEffect(() => {
    if (!editable) return;
    const el = taRef.current;
    if (!el) return;
    if (expanded) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    } else {
      el.style.height = "";
    }
  }, [expanded, val, editable, generating, genResult]);

  useLayoutEffect(() => {
    if (expanded) { setOverflows(true); return; }
    const el = editable ? taRef.current : divRef.current;
    if (!el) { setOverflows(false); return; }
    const recompute = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [val, expanded, editable, generating, genResult]);

  const showToggle = overflows && generating !== skey;

  return <div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {editable && (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <ClearSectionBtn skey={skey} />
          <GenButton skey={skey} />
        </div>
      )}
    </div>
    <GenPlaque skey={skey}>
    {editable ? (
      <div style={{ position: "relative" }}>
        <textarea
          ref={taRef}
          className="expandable-field"
          value={local}
          onFocus={() => { focusedRef.current = true; }}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { focusedRef.current = false; saveField?.(fieldKey, local); }}
          placeholder={ph}
          style={{
            display: "block",
            width: "100%",
            minHeight: COLLAPSED_HEIGHT,
            maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
            padding: 16,
            paddingRight: showToggle ? 38 : 16,
            border: "1px solid " + T.borderLight,
            borderRadius: 6,
            background: T.surface,
            color: T.text,
            fontSize: 13,
            fontFamily: F,
            lineHeight: 1.7,
            overflow: expanded ? "hidden" : "auto",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {showToggle && <CornerToggleButton expanded={expanded} onClick={() => setExpanded(e => !e)} />}
      </div>
    ) : (
      <div style={{ position: "relative" }}>
        <div
          ref={divRef}
          className="expandable-field"
          style={{
            padding: 16,
            paddingRight: showToggle ? 38 : 16,
            border: "1px solid " + T.borderLight,
            borderRadius: 6,
            background: T.bg,
            fontSize: 13,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            minHeight: COLLAPSED_HEIGHT,
            maxHeight: expanded ? "none" : COLLAPSED_HEIGHT,
            overflow: expanded ? "visible" : "auto",
            boxSizing: "border-box",
          }}
        >
          {val || <span style={{ color: T.textMuted }}>Не заполнено</span>}
        </div>
        {showToggle && <CornerToggleButton expanded={expanded} onClick={() => setExpanded(e => !e)} />}
      </div>
    )}
    </GenPlaque>
  </div>;
}

function CornerToggleButton({ expanded, onClick }) {

  return <button
    type="button"
    onMouseDown={e => e.preventDefault()}
    onClick={onClick}
    title={expanded ? "Свернуть" : "Развернуть"}
    aria-label={expanded ? "Свернуть" : "Развернуть"}
    style={{
      position: "absolute",
      top: 1,
      right: 1,
      width: 28,
      height: 26,
      padding: 0,
      border: "none",
      borderBottom: "1px solid " + T.borderLight,
      borderLeft: "1px solid " + T.borderLight,
      borderRadius: "0 6px 0 4px",
      background: T.surface,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: T.textMuted,
      lineHeight: 0,
      zIndex: 2,
    }}
  >
    {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
  </button>;
}

export const EditableBlock = memo(EditableBlockBase);
