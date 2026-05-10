import { useMemo, useState } from "react";
import { T, F } from "../theme.js";
import { Btn } from "./Btn.jsx";
import { TrashIcon, PlusIcon, DragHandleIcon } from "./icons.jsx";
import { ConfirmDeleteModal } from "../features/rpd-editor/EditorModals.jsx";

export function ReviewerChain({ reviewers, selectedIds, onChange, readOnly = false, statuses = null }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const byId = useMemo(() => Object.fromEntries(reviewers.map(r => [r.id_user, r])), [reviewers]);
  const available = reviewers.filter(r => !selectedIds.includes(r.id_user));

  function reorder(from, to) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...selectedIds];
    const [item] = next.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    next.splice(insertAt, 0, item);
    onChange(next);
  }
  function performRemove(idx) { onChange(selectedIds.filter((_, i) => i !== idx)); }
  function askRemove(idx) {
    const uid = selectedIds[idx];
    const u = byId[uid];
    setPendingDelete({ idx, name: u?.full_name || "" });
  }
  function add(uid) { onChange([...selectedIds, uid]); setPickerOpen(false); }

  const hasRows = selectedIds.length > 0;
  const showAddArea = !readOnly && (available.length > 0 || pickerOpen);

  return <div>
    <div
      style={{ border: "1px solid " + T.borderLight, borderRadius: 6, background: T.surface, overflow: "hidden" }}
      onDragLeave={readOnly ? undefined : (e) => {
        const next = e.relatedTarget;
        if (!next || !(next instanceof Node) || !e.currentTarget.contains(next)) {
          setOverIdx(null);
        }
      }}
    >
      {!hasRows && (
        <div style={{ padding: "10px 14px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
          Не задан. Без согласующих РПД нельзя будет отправить на утверждение.
        </div>
      )}
      {selectedIds.map((uid, i) => {
        const u = byId[uid];
        if (!u) return null;
        const status = statuses ? statuses[i] : null;
        const isDragging = dragIdx === i;
        const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
        return <div
          key={uid}
          draggable={!readOnly}
          onDragStart={readOnly ? undefined : (e) => {
            setDragIdx(i);
            try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } catch {}
          }}
          onDragOver={readOnly ? undefined : (e) => {
            e.preventDefault();
            if (overIdx !== i) setOverIdx(i);
          }}
          onDrop={readOnly ? undefined : (e) => {
            e.preventDefault();
            if (dragIdx !== null && dragIdx !== i) reorder(dragIdx, i);
            setDragIdx(null);
            setOverIdx(null);
          }}
          onDragEnd={readOnly ? undefined : () => { setDragIdx(null); setOverIdx(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            borderTop: i === 0 ? "none" : "1px solid " + T.borderLight,
            background: isOver ? T.accentLight : T.surface,
            cursor: readOnly ? "default" : (isDragging ? "grabbing" : "grab"),
            opacity: isDragging ? 0.4 : 1,
            userSelect: "none",
          }}>
          {!readOnly && <span aria-hidden style={{ color: T.textLight, display: "inline-flex", alignItems: "center", flexShrink: 0 }}><DragHandleIcon /></span>}
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, width: 18, flexShrink: 0 }}>{i + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</span>
              {status && <StatusChip status={status} />}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{[u.title, u.role, u.department].filter(Boolean).join(" · ")}</div>
          </div>
          {!readOnly && <button
            type="button"
            onClick={(e) => { e.stopPropagation(); askRemove(i); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Убрать"
            style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "inline-flex", flexShrink: 0 }}
          ><TrashIcon /></button>}
        </div>;
      })}
      {showAddArea && (
        pickerOpen
          ? <ReviewerPicker
              available={available}
              onPick={add}
              onCancel={() => setPickerOpen(false)}
            />
          : <div style={{ padding: 8, borderTop: hasRows ? "1px solid " + T.borderLight : "none" }}>
              <Btn small onClick={() => setPickerOpen(true)}><PlusIcon /> Добавить согласующего</Btn>
            </div>
      )}
    </div>
    {pendingDelete && <ConfirmDeleteModal
      title="Убрать согласующего?"
      message={`«${pendingDelete.name}» будет убран из маршрута согласования.`}
      confirmLabel="Убрать"
      onClose={() => setPendingDelete(null)}
      onConfirm={() => { const idx = pendingDelete.idx; setPendingDelete(null); performRemove(idx); }}
    />}
  </div>;
}

function ReviewerPicker({ available, onPick, onCancel }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return available;
    return available.filter(u =>
      (u.full_name || "").toLowerCase().includes(s)
      || (u.title || "").toLowerCase().includes(s)
      || (u.role || "").toLowerCase().includes(s)
      || (u.department || "").toLowerCase().includes(s)
    );
  }, [available, q]);

  return <div style={{ padding: 10, borderTop: "1px solid " + T.borderLight, background: T.bg }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      <input
        autoFocus
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Поиск по ФИО, должности, подразделению…"
        style={{ flex: 1, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, outline: "none" }}
      />
      <Btn small onClick={onCancel}>Отмена</Btn>
    </div>
    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.surface }}>
      {filtered.length === 0
        ? <div style={{ padding: 10, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>Никого не нашлось</div>
        : filtered.map(u => (
          <button key={u.id_user} type="button" onClick={() => onPick(u.id_user)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{u.full_name}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{[u.title, u.role, u.department].filter(Boolean).join(" · ")}</div>
          </button>
        ))}
    </div>
  </div>;
}

function StatusChip({ status }) {
  const map = {
    waiting: { text: "ожидает", color: T.textMuted, bg: T.borderLight },
    pending: { text: "на согласовании", color: T.accent, bg: T.accentLight },
    approved: { text: "согласовано", color: T.green, bg: T.greenLight || "#e8f5e9" },
    rejected: { text: "отклонено", color: T.red, bg: T.redLight || "#ffebee" },
  };
  const s = map[status] || { text: status, color: T.textMuted, bg: T.borderLight };
  return <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, padding: "1px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: .3 }}>{s.text}</span>;
}
