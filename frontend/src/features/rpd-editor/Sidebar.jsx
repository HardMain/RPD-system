import { T, F } from "../../theme.js";
import { Badge } from "../../components/Badge.jsx";
import { SIDEBAR_KEYS, SUB_KEYS, SEC_LABELS, NON_PDF_KEYS } from "./constants.js";

export function Sidebar({
  width, isEdit, hasPair, canEdit, isHead, status,
  validationErrors, activeSec,
  hasLabTopics, hasPracticeTopics,
  onToggleMode, onOpenPair, onGoTo, onOpenMeta,
}) {
  const viewTakenByPair = hasPair && isEdit;     // мы edit, значит view — это сосед
  const editTakenByPair = hasPair && !isEdit;    // мы view, значит edit — это сосед
  const viewClickable = isEdit && !viewTakenByPair;
  const editClickable = !isEdit && canEdit && !editTakenByPair;

  return <div style={{ width, background: T.surface, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0 }}>
    {/* Переключатель режима. Если та же РПД уже открыта в парной вкладке (hasPair),
        кнопку противоположного режима блокируем — этот режим занят соседней вкладкой. */}
    <div style={{ display: "flex", borderBottom: "1px solid " + T.border, flexShrink: 0 }}>
      <button
        onClick={() => { if (viewClickable) onToggleMode(); }}
        disabled={viewTakenByPair}
        title={viewTakenByPair ? "Этот режим уже открыт в парной вкладке" : (isEdit ? "Переключиться в просмотр PDF" : "Текущий режим")}
        style={{
          flex: 1, padding: "6px 4px", border: "none",
          borderRight: "1px solid " + T.border,
          background: !isEdit ? T.blueLight : "transparent",
          color: !isEdit ? T.blue : (viewTakenByPair ? T.textLight : T.textMuted),
          fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
          cursor: viewClickable ? "pointer" : "default", textAlign: "center",
          opacity: viewTakenByPair ? 0.5 : 1,
        }}>👁 ПРОСМОТР</button>
      <button
        onClick={() => { if (editClickable) onToggleMode(); }}
        disabled={(!canEdit && !isEdit) || editTakenByPair}
        title={editTakenByPair ? "Этот режим уже открыт в парной вкладке" : (!canEdit ? "Редактирование недоступно при текущем статусе РПД" : (!isEdit ? "Переключиться в режим редактирования" : "Текущий режим"))}
        style={{
          flex: 1, padding: "6px 4px", border: "none",
          background: isEdit ? T.orangeLight : "transparent",
          color: isEdit ? T.orange : (editTakenByPair ? T.textLight : (canEdit ? T.textMuted : T.textLight)),
          fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
          cursor: editClickable ? "pointer" : "default", textAlign: "center",
          opacity: ((!canEdit && !isEdit) || editTakenByPair) ? 0.5 : 1,
        }}>✏ РЕДАКТИРОВАНИЕ</button>
    </div>

    {/* «Свойства РПД» — открывает модалку со всем, что не относится к печатной форме:
        основные данные, привязанные дисциплины БУПа с ФГОС, комментарий, разработчики. */}
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

    {/* Discoverable-кнопка для пары: «Открыть рядом в [противоположном режиме]».
        Прячем когда пара уже есть. Если редактировать нельзя в принципе — тоже не показываем. */}
    {!hasPair && onOpenPair && (isEdit || canEdit) && <button
      onClick={onOpenPair}
      title={`Откроет копию РПД в режиме «${isEdit ? "просмотр" : "редактирование"}» во второй панели · при сохранении edit-вкладки парная view-вкладка обновится автоматически`}
      style={{
        display: "block", width: "100%", padding: "5px 8px",
        border: "none", borderBottom: "1px solid " + T.border,
        background: T.accentLight, color: T.accent,
        fontSize: 10, fontWeight: 700, letterSpacing: .3, fontFamily: F,
        cursor: "pointer", textAlign: "center", flexShrink: 0,
      }}>⧉ Открыть рядом в режиме «{isEdit ? "просмотр" : "редактор"}»</button>}

    {isHead && status === "На согласовании" && <div style={{ padding: "4px 10px", background: T.accentLight, borderBottom: "1px solid " + T.accent, fontSize: 10, fontWeight: 700, color: T.accent, textAlign: "center", letterSpacing: .3 }}>📋 СОГЛАСОВАНИЕ</div>}

    <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>{SIDEBAR_KEYS.map(k => {
      // Не-PDF разделы (метаинформация и т.п.) видимы только в режиме редактирования —
      // в печатной форме их нет.
      if (!isEdit && NON_PDF_KEYS.has(k)) return null;
      // В режиме просмотра прячем 4.1 / 4.2, если в РПД нет соответствующих тем —
      // скроллить там не к чему, и в PDF этих разделов тоже нет.
      if (!isEdit && k === "4.1" && !hasLabTopics) return null;
      if (!isEdit && k === "4.2" && !hasPracticeTopics) return null;
      const hasErr = validationErrors.length > 0 && validationErrors.some(e => e.secKey === k);
      const isSub = SUB_KEYS.has(k);
      return <button key={k} onClick={() => onGoTo(k)} style={{
        display: "flex", width: "100%",
        padding: isSub ? "6px 12px 6px 28px" : "8px 12px",
        border: "none",
        borderLeft: hasErr ? "3px solid " + T.red : activeSec === k ? "3px solid " + T.accent : "3px solid transparent",
        background: activeSec === k ? T.accentLight : "transparent",
        cursor: "pointer", fontSize: isSub ? 10 : 11, fontFamily: F,
        fontStyle: isSub ? "italic" : "normal",
        fontWeight: activeSec === k ? 700 : 400,
        color: hasErr ? T.red : activeSec === k ? T.accent : isSub ? T.textMuted : T.text,
        alignItems: "center", gap: 6, boxSizing: "border-box", textAlign: "left",
      }}>
        {isSub && <span style={{ color: T.textLight, flexShrink: 0 }}>›</span>}
        <span style={{ flex: 1, textAlign: "left", lineHeight: 1.3, wordBreak: "break-word" }}>{SEC_LABELS[k]}</span>
        {hasErr && <span style={{ fontSize: 7, color: T.red, flexShrink: 0 }}>●</span>}
      </button>;
    })}</div>

    <div style={{ borderTop: "1px solid " + T.borderLight, padding: "8px 12px", fontSize: 11, color: T.textMuted, flexShrink: 0 }}><Badge status={status} /></div>
  </div>;
}
