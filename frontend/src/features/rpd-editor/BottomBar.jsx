import { T } from "../../theme.js";
import { Btn } from "../../components/Btn.jsx";
import { DownloadIcon } from "../../components/icons.jsx";

export function BottomBar({
  showPdf, isEdit, isHead, canEdit, saving, status,
  rpdId, onBack, onExportPdf, onSave, onSendApproval, onApprove, onReject,
}) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", flexShrink: 0, background: T.surface, borderTop: "1px solid " + T.border }}>
    <Btn small onClick={onBack}>← Назад</Btn>
    {!showPdf && <Btn small onClick={() => onExportPdf(rpdId)}><DownloadIcon /> PDF</Btn>}
    {isEdit && canEdit && !isHead && <>
      <Btn small onClick={onSave} disabled={saving}>Сохранить</Btn>
      <div style={{ flex: 1 }} />
      <Btn primary onClick={onSendApproval}>Отправить на согласование</Btn>
    </>}
    {isHead && status === "На согласовании" && <>
      <div style={{ flex: 1 }} />
      <Btn primary onClick={onApprove}>Согласовать</Btn>
      <Btn danger onClick={onReject}>На доработку</Btn>
    </>}
    {showPdf && !(isHead && status === "На согласовании") && <>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: T.textMuted }}>Режим просмотра</span>
    </>}
  </div>;
}
