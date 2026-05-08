import { useMemo, useState } from "react";
import { T, F } from "../theme.js";
import { Btn } from "./Btn.jsx";

export function ReviewerChain({ reviewers, selectedIds, onChange, readOnly = false, statuses = null }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const byId = useMemo(() => Object.fromEntries(reviewers.map(r => [r.id_user, r])), [reviewers]);
  const available = reviewers.filter(r => !selectedIds.includes(r.id_user));

  function move(idx, dir) {
    const next = [...selectedIds];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }
  function remove(idx) { onChange(selectedIds.filter((_, i) => i !== idx)); }
  function add(uid) { onChange([...selectedIds, uid]); setPickerOpen(false); }

  return <div style={{ border: "1px solid " + T.border, borderRadius: 6, padding: 10, background: T.surface }}>
    {selectedIds.length === 0 && (
      <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", marginBottom: 8 }}>
        Не задан. Без согласующих РПД нельзя будет отправить на утверждение.
      </div>
    )}
    {selectedIds.map((uid, i) => {
      const u = byId[uid];
      if (!u) return null;
      const status = statuses ? statuses[i] : null;
      return <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: T.textMuted, width: 18 }}>{i + 1}.</span>
        <div style={{ flex: 1, padding: "6px 10px", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.bg, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>
            {u.full_name}
            {status && <StatusChip status={status} />}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{[u.title, u.role, u.department].filter(Boolean).join(" · ")}</div>
        </div>
        {!readOnly && <>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
            style={iconBtnStyle(i === 0)}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === selectedIds.length - 1}
            style={iconBtnStyle(i === selectedIds.length - 1)}>↓</button>
          <button type="button" onClick={() => remove(i)} style={iconBtnStyle(false)}>✕</button>
        </>}
      </div>;
    })}
    {!readOnly && available.length > 0 && (
      pickerOpen
        ? <div style={{ marginTop: 4, border: "1px solid " + T.borderLight, borderRadius: 4, maxHeight: 220, overflowY: "auto", background: T.bg }}>
            {available.map(u => (
              <button key={u.id_user} type="button" onClick={() => add(u.id_user)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{[u.title, u.role, u.department].filter(Boolean).join(" · ")}</div>
              </button>
            ))}
            <div style={{ padding: 6, textAlign: "right" }}>
              <Btn small onClick={() => setPickerOpen(false)}>Отмена</Btn>
            </div>
          </div>
        : <Btn small onClick={() => setPickerOpen(true)}>+ Добавить согласующего</Btn>
    )}
  </div>;
}

function iconBtnStyle(disabled) {
  return {
    border: "1px solid " + T.border, background: T.bg, borderRadius: 4,
    padding: "4px 8px", cursor: disabled ? "default" : "pointer",
    opacity: disabled ? .4 : 1, fontSize: 12,
  };
}

function StatusChip({ status }) {
  const map = {
    waiting: { text: "ожидает", color: T.textMuted, bg: T.borderLight },
    pending: { text: "на согласовании", color: T.accent, bg: T.accentLight },
    approved: { text: "согласовано", color: T.green, bg: T.greenLight || "#e8f5e9" },
    rejected: { text: "отклонено", color: T.red, bg: T.redLight || "#ffebee" },
  };
  const s = map[status] || { text: status, color: T.textMuted, bg: T.borderLight };
  return <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, padding: "1px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: .3 }}>{s.text}</span>;
}
