import { T, F } from "../../theme.js";

function TabChip({ tab, isCurrent, pairNumber, isDragging, onDragStart, onDragEnd, onClick, onClose }) {

  const tag = (tab.mode === "edit" ? "E" : "V") + (pairNumber ?? "");
  const isPaired = pairNumber != null;
  return <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    title={isPaired ? `Пара ${pairNumber}: edit ↔ view синхронизируются при сохранении` : "Перетащите вниз, чтобы открыть в отдельной панели"}
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
    <span style={{ fontSize: 10, opacity: 0.7, color: tab.mode === "edit" ? T.orange : T.blue, fontWeight: 700 }}>[{tag}]</span>
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

  const pairNumberByRpd = {};
  const seenForPair = new Set();
  let pairCounter = 0;
  for (const t of openRpds) {
    if (seenForPair.has(t.id_rpd)) continue;
    seenForPair.add(t.id_rpd);
    const tabsOfThisRpd = openRpds.filter(o => o.id_rpd === t.id_rpd);
    if (tabsOfThisRpd.length > 1) {
      pairCounter += 1;
      pairNumberByRpd[t.id_rpd] = pairCounter;
    }
  }

  const renderTab = (t) => {
    const paneSide = findPaneOf(t.tabId);
    const isActiveInPane = paneSide === "left"
      ? panes.left.activeId === t.tabId
      : (panes.right && panes.right.activeId === t.tabId);
    const isCurrentTab = activeTab === "edit" && isActiveInPane;
    const isDragging = draggingTabId === t.tabId;
    return <TabChip
      key={t.tabId}
      tab={t}
      isCurrent={isCurrentTab}
      pairNumber={pairNumberByRpd[t.id_rpd]}
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

  const tabsScrollStyle = {
    display: "flex", alignItems: "flex-start", gap: 2,
    overflowX: "auto", overflowY: "hidden",
    flex: 1, minWidth: 0,
    transform: "rotateX(180deg)",
  };
  const flipBack = { transform: "rotateX(180deg)", display: "flex", gap: 2 };
  const labelStyle = { fontSize: 11, color: T.textMuted, marginRight: 6, alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 };

  return <div style={{ display: "flex", alignItems: "stretch", background: T.bg, borderBottom: "1px solid " + T.border, height: 35 }}>
    {!panes.right ? (
      <div style={{ flex: 1, display: "flex", alignItems: "stretch", padding: "0 12px", minWidth: 0, boxSizing: "border-box" }}>
        <span style={labelStyle}>Открытые РПД:</span>
        <div style={tabsScrollStyle}>
          <div style={flipBack}>{leftTabRpds.map(renderTab)}</div>
        </div>
      </div>
    ) : (
      <>
        <div style={{ width: `calc(${ratioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 6px 0 12px", minWidth: 0, boxSizing: "border-box" }}>
          <span style={labelStyle}>Открытые РПД:</span>
          <div style={tabsScrollStyle}>
            <div style={flipBack}>{leftTabRpds.map(renderTab)}</div>
          </div>
        </div>

        <div title="Стык панелей" style={{ width: 2, alignSelf: "stretch", background: T.border, flexShrink: 0 }} />
        <div style={{ width: `calc(${invRatioPct}% - 1px)`, display: "flex", alignItems: "stretch", padding: "0 12px 0 6px", minWidth: 0, boxSizing: "border-box" }}>
          <div style={tabsScrollStyle}>
            <div style={flipBack}>{rightTabRpds.map(renderTab)}</div>
          </div>
          <button onClick={onMergePanes} title="Свести все вкладки в одну панель" style={{ marginLeft: 8, alignSelf: "flex-end", marginBottom: 2, border: "1px solid " + T.border, background: T.surface, borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: T.text, flexShrink: 0, fontFamily: F }}>↩ Объединить</button>
        </div>
      </>
    )}
  </div>;
}
