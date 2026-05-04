import { T } from "../../theme.js";

export function PaneDropZones({ draggingTabId, dragOverSide, onSetDragOverSide, onDropToSide }) {
  if (draggingTabId === null) return null;

  const zoneStyle = (side) => {
    const active = dragOverSide === side;
    return {
      flex: 1, margin: 8,
      border: (active ? "4px" : "3px") + " dashed " + T.accent,
      borderRadius: 10,
      background: active ? "rgba(155,89,180,0.28)" : "rgba(155,89,180,0.10)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: active ? T.accentDark : T.accent,
      fontWeight: 700, fontSize: 18,
      pointerEvents: "auto",
      transition: "background-color 80ms, border-width 80ms",
      boxShadow: active ? "0 0 0 3px rgba(155,89,180,0.20) inset" : "none",
    };
  };

  return <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", pointerEvents: "none" }}>
    <div
      onDragEnter={() => onSetDragOverSide("left")}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverSide !== "left") onSetDragOverSide("left"); }}
      onDrop={e => { e.preventDefault(); onDropToSide("left"); }}
      style={zoneStyle("left")}
    >◀ В левую панель</div>
    <div
      onDragEnter={() => onSetDragOverSide("right")}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverSide !== "right") onSetDragOverSide("right"); }}
      onDrop={e => { e.preventDefault(); onDropToSide("right"); }}
      style={zoneStyle("right")}
    >В правую панель ▶</div>
  </div>;
}
