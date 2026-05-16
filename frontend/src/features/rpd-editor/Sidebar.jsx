import { T, F } from "../../styles/index.js";
import { EyeIcon, PencilIcon, SplitIcon, SparkleIcon } from "../../components/icons.jsx";
import { SIDEBAR_KEYS, SUB_KEYS, SEC_LABELS, NON_PDF_KEYS, PARENT_SECTION } from "./constants.js";

export const SIDEBAR_COLLAPSED_W = 38;

export function Sidebar({
  width, isEdit, hasPair, canEdit,
  validationErrors, activeSec,
  hasLabTopics, hasPracticeTopics,
  isCollapsed,
  generating,
  onToggleMode, onOpenPair, onGoTo, onOpenMeta, onAutoFillAll,
  onExpand,
}) {

  if (width <= SIDEBAR_COLLAPSED_W) {
    return <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (onExpand) onExpand(); }}
      title="Раскрыть панель разделов"
      style={{
        width: SIDEBAR_COLLAPSED_W,
        background: T.surface,
        border: "none",
        borderRight: "1px solid " + T.border,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        userSelect: "none",
        padding: 0,
        fontFamily: F,
      }}
    >
      <span style={{ color: T.accent, fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: -2 }}>››</span>
    </button>;
  }

  const showModes = !hasPair && canEdit;
  const showPair = !hasPair && onOpenPair && (isEdit || canEdit);
  const editClickable = !isEdit && canEdit;
  const viewClickable = isEdit;

  return <div style={{ width, background: T.surface, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
    {(showModes || showPair) && (
      <div style={{ display: "flex", borderBottom: "1px solid " + T.border, flexShrink: 0 }}>
        {showModes && <ToolbarBtn
          icon={<EyeIcon />}
          active={!isEdit}
          onClick={() => { if (viewClickable) onToggleMode(); }}
          disabled={!viewClickable}
          title={!isEdit ? "Текущий режим: просмотр" : "Переключиться в просмотр PDF"}
        />}
        {showModes && <ToolbarBtn
          icon={<PencilIcon />}
          active={isEdit}
          onClick={() => { if (editClickable) onToggleMode(); }}
          disabled={!editClickable && !isEdit}
          title={!canEdit && !isEdit ? "Редактирование недоступно при текущем статусе РПД" : (isEdit ? "Текущий режим: редактирование" : "Переключиться в режим редактирования")}
        />}
        {showPair && <ToolbarBtn
          icon={<SplitIcon />}
          onClick={onOpenPair}
          title={`Откроет копию РПД в режиме «${isEdit ? "просмотр" : "редактирование"}» во второй панели`}
        />}
      </div>
    )}

    {onOpenMeta && <button
      onClick={onOpenMeta}
      title="Дисциплина, наименование РПД, дисциплины БУПа, разработчики, комментарий"
      style={{
        display: "block", width: "100%", padding: "5px 8px",
        border: "none", borderBottom: "1px solid " + T.border,
        background: "transparent", color: T.textMuted,
        fontSize: 10, fontWeight: 700, letterSpacing: ".3px", fontFamily: F,
        cursor: "pointer", textAlign: "center", flexShrink: 0,
      }}
      onMouseEnter={e => e.currentTarget.style.background = T.bg}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >ⓘ Свойства РПД</button>}

    <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>{SIDEBAR_KEYS.map(k => {

      if (!isEdit && NON_PDF_KEYS.has(k)) return null;

      if (!isEdit && k === "4.1" && !hasLabTopics) return null;
      if (!isEdit && k === "4.2" && !hasPracticeTopics) return null;
      const hasErr = validationErrors.length > 0 && validationErrors.some(e => e.secKey === k);
      const isSub = SUB_KEYS.has(k);

      const parentKey = PARENT_SECTION[k];
      const parentCollapsed = isEdit && parentKey && isCollapsed && isCollapsed(parentKey);
      const isActive = activeSec === k;
      const baseBg = isActive ? T.accentLight : (parentCollapsed ? T.bg : "transparent");
      const baseColor = hasErr ? T.red : isActive ? T.accent : parentCollapsed ? T.textMuted : isSub ? T.textMuted : T.text;
      return <button key={k} onClick={() => onGoTo(k)} style={{
        display: "flex", width: "100%",
        padding: isSub ? "6px 12px 6px 28px" : "8px 12px",
        border: "none",
        borderLeft: hasErr ? "3px solid " + T.red : isActive ? "3px solid " + T.accent : "3px solid transparent",
        background: baseBg,
        cursor: "pointer", fontSize: isSub ? 10 : 11, fontFamily: F,
        fontStyle: isSub ? "italic" : "normal",
        fontWeight: isActive ? 700 : 400,
        color: baseColor,
        alignItems: "center", gap: 6, boxSizing: "border-box", textAlign: "left",
      }}>
        {isSub && <span style={{ color: T.textLight, flexShrink: 0 }}>›</span>}
        <span style={{ flex: 1, textAlign: "left", lineHeight: 1.3, wordBreak: "break-word" }}>{SEC_LABELS[k]}</span>
        {parentCollapsed && !hasErr && <span title="Раздел свёрнут — кликните, чтобы раскрыть" style={{ fontSize: 9, color: T.textLight, flexShrink: 0 }}>▸</span>}
        {hasErr && <span style={{ fontSize: 7, color: T.red, flexShrink: 0 }}>●</span>}
      </button>;
    })}</div>

    {onAutoFillAll && isEdit && canEdit && <div style={{ padding: 10, borderTop: "1px solid " + T.border, flexShrink: 0 }}>
      <button
        onClick={onAutoFillAll}
        disabled={!!generating}
        title="Последовательно сгенерировать содержание всех поддерживаемых разделов через LLM"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: "7px 12px",
          border: "1px solid transparent",
          borderRadius: 5,
          background: generating ? T.borderLight : T.accent,
          color: generating ? T.textMuted : "#fff",
          fontSize: 12, fontWeight: 600, fontFamily: F,
          cursor: generating ? "default" : "pointer",
          whiteSpace: "nowrap",
        }}
      ><SparkleIcon /> {generating ? "Генерация..." : "Сгенерировать всё"}</button>
    </div>}
  </div>;
}

function ToolbarBtn({ icon, active, onClick, disabled, title }) {
  const isReallyDisabled = disabled && !active;
  return <button
    onClick={isReallyDisabled || active ? undefined : onClick}
    disabled={isReallyDisabled}
    title={title}
    style={{
      flex: 1, padding: "8px 4px", border: "none",
      borderRight: "1px solid " + T.border,
      background: active ? T.bg : "transparent",
      color: active ? T.text : T.textMuted,
      cursor: isReallyDisabled || active ? "default" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: isReallyDisabled ? 0.35 : 1,
    }}
  >{icon}</button>;
}
