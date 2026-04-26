import { T, F } from "../../theme.js";

/* Чип-вкладка одной открытой РПД. Drag → переезд в другую панель. */
function TabChip({ tab, isCurrent, isPaired, isDragging, onDragStart, onDragEnd, onClick, onClose }) {
  return <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    title={isPaired ? "Эта РПД открыта в обоих режимах одновременно (edit ↔ view синхронизируются при сохранении)" : "Перетащите вниз, чтобы открыть в отдельной панели"}
    style={{
      display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
      borderRadius: "5px 5px 0 0",
      background: isCurrent ? T.surface : T.tabInactive,
      border: "1px solid " + (isCurrent ? T.accent : T.border),
      borderBottom: isCurrent ? "2px solid " + T.accent : "1px solid transparent",
      cursor: isDragging ? "grabbing" : "grab",
      fontSize: 11, fontWeight: isCurrent ? 700 : 400,
      color: isCurrent ? T.accent : T.text, flexShrink: 0,
      opacity: isDragging ? 0.5 : 1, userSelect: "none",
    }}>
    {/* [E]/[V] показывает текущий режим вкладки. Если открыта пара — добавляем «🔗»,
        чтобы было сразу видно что edit и view связаны и автоматически синхронизируются. */}
    <span style={{ fontSize: 10, opacity: 0.7, color: tab.mode === "edit" ? T.orange : T.blue, fontWeight: 700 }}>[{tab.mode === "edit" ? "E" : "V"}]</span>
    {isPaired && <span title="Связана с парной вкладкой" style={{ fontSize: 10, opacity: 0.6 }}>🔗</span>}
    <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.direction_code} {tab.discipline_name} {tab.academic_year}</span>
    <span onClick={e => { e.stopPropagation(); onClose(); }} style={{ cursor: "pointer", marginLeft: 4, opacity: 0.5, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>✕</span>
  </div>;
}

export function OpenRpdsBar({
  openRpds, panes, splitRatio, draggingTabId, activeTab,
  onSetActiveTab, onSetDragging, onFocusTab, onCloseTab, onMergePanes,
}) {
  if (openRpds.length === 0) return null;

  const findPaneOf = (tabId) => {
    if (panes.left.tabs.includes(tabId)) return "left";
    if (panes.right && panes.right.tabs.includes(tabId)) return "right";
    return null;
  };

  const renderTab = (t) => {
    const paneSide = findPaneOf(t.tabId);
    const isActiveInPane = paneSide === "left"
      ? panes.left.activeId === t.tabId
      : (panes.right && panes.right.activeId === t.tabId);
    const isCurrentTab = activeTab === "edit" && isActiveInPane;
    const isDragging = draggingTabId === t.tabId;
    const isPaired = openRpds.some(o => o.id_rpd === t.id_rpd && o.tabId !== t.tabId);
    return <TabChip
      key={t.tabId}
      tab={t}
      isCurrent={isCurrentTab}
      isPaired={isPaired}
      isDragging={isDragging}
      onDragStart={(e) => {
        onSetDragging(t.tabId);
        if (activeTab !== "edit") onSetActiveTab("edit");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.tabId); } catch { }
      }}
      onDragEnd={() => onSetDragging(null)}
      onClick={() => onFocusTab(t.tabId)}
      onClose={() => onCloseTab(t.tabId)}
    />;
  };

  const tabIdToTab = Object.fromEntries(openRpds.map(t => [t.tabId, t]));
  const leftTabRpds = panes.left.tabs.map(id => tabIdToTab[id]).filter(Boolean);
  const rightTabRpds = panes.right ? panes.right.tabs.map(id => tabIdToTab[id]).filter(Boolean) : [];
  const ratioPct = (splitRatio * 100).toFixed(3);
  const invRatioPct = ((1 - splitRatio) * 100).toFixed(3);

  // Чтобы стык в строке вкладок СОВПАДАЛ с разделителем редактора снизу, обе группы
  // должны делиться от ПОЛНОЙ ширины контейнера, а не от «оставшейся после метки/кнопки».
  // Поэтому метка живёт ВНУТРИ левой группы, кнопка — внутри правой; внешний padding 0.
  return <div style={{ display: "flex", alignItems: "stretch", padding: "4px 0 0", background: T.bg, borderBottom: "1px solid " + T.border, minHeight: 32 }}>
    {!panes.right ? (
      <div style={{ flex: 1, display: "flex", alignItems: "stretch", padding: "0 12px", minWidth: 0, boxSizing: "border-box" }}>
        <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6, alignSelf: "center", flexShrink: 0 }}>Открытые РПД:</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
          {leftTabRpds.map(renderTab)}
        </div>
      </div>
    ) : (
      <>
        <div style={{ width: `calc(${ratioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 6px 0 12px", minWidth: 0, boxSizing: "border-box" }}>
          <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6, alignSelf: "center", flexShrink: 0 }}>Открытые РПД:</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
            {leftTabRpds.map(renderTab)}
          </div>
        </div>
        <div title="Стык панелей" style={{ width: 2, alignSelf: "stretch", background: T.border, flexShrink: 0 }} />
        <div style={{ width: `calc(${invRatioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 12px 0 6px", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
            {rightTabRpds.map(renderTab)}
          </div>
          <button onClick={onMergePanes} title="Свести все вкладки в одну панель" style={{ marginLeft: 8, alignSelf: "center", border: "1px solid " + T.border, background: T.surface, borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: T.text, flexShrink: 0, fontFamily: F }}>↩ Объединить</button>
        </div>
      </>
    )}
  </div>;
}
