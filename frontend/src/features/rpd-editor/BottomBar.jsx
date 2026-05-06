import { useEffect, useState } from "react";
import { T, F } from "../../theme.js";
import { Btn } from "../../components/Btn.jsx";
import { StatusBadge } from "../../components/StatusBadge.jsx";

export function BottomBar({
  showPdf, isEdit, isHead, canEdit, savedTick, status,
  completion, onJumpToMissing, updatedAt,
  onSendApproval, onApprove, onReject,
}) {
  return <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", flexShrink: 0, background: T.surface, borderTop: "1px solid " + T.border }}>
    {status && <StatusBadge status={status} />}
    {completion && <CompletionIndicator completion={completion} onJumpToMissing={onJumpToMissing} />}
    {updatedAt && <UpdatedAgo updatedAt={updatedAt} />}
    {isEdit && canEdit && !isHead && <>
      {savedTick > 0 && (
        <span key={savedTick} className="saved-fade" style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
          Сохранено
        </span>
      )}
      <div style={{ flex: 1 }} />
      <Btn small primary onClick={onSendApproval}>Отправить на согласование</Btn>
    </>}
    {isHead && status === "На согласовании" && <>
      <div style={{ flex: 1 }} />
      <Btn small primary onClick={onApprove}>Согласовать</Btn>
      <Btn small danger onClick={onReject}>На доработку</Btn>
    </>}
    {showPdf && !(isHead && status === "На согласовании") && <>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: T.textMuted }}>Режим просмотра</span>
    </>}
  </div>;
}

function CompletionIndicator({ completion, onJumpToMissing }) {
  const { filled, total, missing } = completion;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const done = filled === total;
  const color = done ? T.green : T.accent;
  const tooltipMissing = missing.length ? `Не заполнено: ${missing.join(", ")}` : "Все обязательные разделы заполнены";
  const handleClick = () => {
    if (done) return;
    if (onJumpToMissing && missing[0]) onJumpToMissing(missing[0]);
  };
  return <button
    type="button"
    onClick={handleClick}
    title={tooltipMissing}
    style={{
      display: "flex", alignItems: "center", gap: 8,
      border: "none", background: "transparent",
      cursor: done ? "default" : "pointer",
      padding: 0, fontFamily: F,
    }}
  >
    <span style={{ fontSize: 12, color: T.textMuted }}>Заполнено:</span>
    <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: T.text, fontWeight: 600 }}>
      {filled}/{total}
    </span>
    <span style={{ width: 90, height: 6, background: T.borderLight, borderRadius: 3, overflow: "hidden" }}>
      <span style={{ display: "block", width: pct + "%", height: "100%", background: color, transition: "width .25s" }} />
    </span>
  </button>;
}

function UpdatedAgo({ updatedAt }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const text = formatRelative(updatedAt);
  if (!text) return null;
  const full = new Date(updatedAt).toLocaleString("ru-RU");
  return <span title={`Последнее изменение: ${full}`} style={{ fontSize: 12, color: T.textMuted }}>
    Изменено {text}
  </span>;
}

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} ${plural(diffMin, "минуту", "минуты", "минут")} назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ${plural(diffH, "час", "часа", "часов")} назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return `вчера в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffD < 7) return `${diffD} ${plural(diffD, "день", "дня", "дней")} назад`;
  return d.toLocaleDateString("ru-RU");
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
