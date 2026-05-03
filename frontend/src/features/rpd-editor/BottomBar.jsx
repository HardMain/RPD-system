import { T } from "../../theme.js";
import { Btn } from "../../components/Btn.jsx";

export function BottomBar({
  showPdf, isEdit, isHead, canEdit, savedTick, status,
  onBack, onSendApproval, onApprove, onReject,
}) {
  // Кнопка «Скачать PDF» в режиме редактирования убрана — она была дублёром
  // такой же кнопки в верхнем тулбаре режима просмотра. Кнопка «Сохранить»
  // убрана — все правки уезжают автоматически после того, как пользователь
  // покидает поле (потеря фокуса, по-английски onBlur). Подтверждает успех
  // короткая подпись «Сохранено» зелёным — она плавно появляется и затухает
  // (анимация saved-fade ниже в App.jsx <style>). Постоянной подсказки
  // «Изменения сохраняются автоматически» нет — она бросалась в глаза без
  // повода.
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", flexShrink: 0, background: T.surface, borderTop: "1px solid " + T.border }}>
    <Btn small onClick={onBack}>← Назад</Btn>
    {isEdit && canEdit && !isHead && <>
      {savedTick > 0 && (
        // key={savedTick} — при каждом сохранении монтируется НОВЫЙ span,
        // CSS-анимация запускается заново. Без ключа быстрые подряд сейвы не
        // перезапускали бы фейд, и подпись бы «прилипала».
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
