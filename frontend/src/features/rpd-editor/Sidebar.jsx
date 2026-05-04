import { T, F } from "../../theme.js";
import { EyeIcon, PencilIcon, SplitIcon } from "../../components/icons.jsx";
import { SIDEBAR_KEYS, SUB_KEYS, SEC_LABELS, NON_PDF_KEYS, PARENT_SECTION } from "./constants.js";

// Ширина свёрнутого сайдбара — узкая «полоска-handle» ≈1см. Внутри неё
// сиреневая иконка «››», по которой видно куда тянуть, чтобы раскрыть.
export const SIDEBAR_COLLAPSED_W = 38;

export function Sidebar({
  width, isEdit, hasPair, canEdit, isHead, status,
  validationErrors, activeSec,
  hasLabTopics, hasPracticeTopics,
  isCollapsed,
  onToggleMode, onOpenPair, onGoTo, onOpenMeta,
  onExpand,
}) {
  // Свёрнутый режим: вместо содержимого — узкая белая кнопка со значком «››».
  // Click → раскрыть. Drag оттуда НЕ запускается — для изменения ширины есть
  // отдельный 5px ресайзер справа (он уже визуально намекает курсором col-resize).
  // Так у пользователя нет когнитивной путаницы «то ли тянуть, то ли кликать».
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
  // Тулбар сверху сайдбара: 3 иконки в одной строке — глаз (просмотр),
  // карандаш (редактирование), две страницы (открыть рядом). Активный режим
  // подсвечен. Когда РПД уже открыта в паре (hasPair=true) — переключатели и
  // кнопка пары пропадают: режимы разведены по двум панелям, переключаться
  // некуда. «Свойства РПД» — отдельной строкой ПОД тулбаром.
  // Если РПД нельзя редактировать (архивная, согласованная и т.п.) — переключение
  // режимов скрываем целиком: возможен только просмотр, выбирать не из чего.
  // Останется одна кнопка «Свойства РПД» — как и в режиме пары.
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
      // В режиме редактирования отдельные разделы можно сворачивать (как в Word).
      // Если родительский блок этого пункта свёрнут — подсвечиваем строку
      // мягким приглушённым фоном и иконкой, чтобы было видно, что чтобы
      // увидеть содержимое надо сначала раскрыть. Клик по такому пункту
      // сам разворачивает родителя (этой логикой занимается onGoTo сверху).
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

    <div style={{ borderTop: "1px solid " + T.borderLight, padding: "8px 12px", fontSize: 11, color: T.text, flexShrink: 0 }}>{status}</div>
  </div>;
}

// Иконочная кнопка тулбара. Активная (текущий режим) — тёмная заливка фона
// (T.bg) и чёрный значок (T.text), кликом ничего не делает. Неактивная и
// доступная — приглушённый цвет, кликом переключает. Disabled (нельзя
// переключиться, например edit при «Согласовано») — полупрозрачная.
// Активная кнопка НЕ считается disabled, даже если onClick для неё бесполезен —
// иначе глаз в режиме просмотра становился бы серым полупрозрачным, тогда как
// карандаш в режиме редактирования рисовался бы чёрным. Несимметрично.
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
