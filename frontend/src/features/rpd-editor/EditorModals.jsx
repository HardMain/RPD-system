import { T, F } from "../../theme.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";

// Унифицированный «футер» модалок: «Закрыть» справа снизу, нейтральный цвет.
// Опциональная primary-кнопка (действие) — слева от «Закрыть».
function ModalFooter({ children, onClose, closeLabel = "Закрыть" }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid " + T.borderLight }}>
    {children}
    <Btn onClick={onClose}>{closeLabel}</Btn>
  </div>;
}

export function SentModal({ onClose }) {
  return <Modal onClose={onClose} width={400}>
    <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>РПД отправлена на согласование</div>
    </div>
    <ModalFooter onClose={onClose} />
  </Modal>;
}

export function ErrorModal({ onClose }) {
  return <Modal onClose={onClose} width={440}>
    <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ошибка при отправке</div>
      <div style={{ fontSize: 13, color: T.textMuted }}>Проверьте заполненность разделов</div>
    </div>
    <ModalFooter onClose={onClose} />
  </Modal>;
}

export function ApprovedModal({ onClose }) {
  return <Modal onClose={onClose} width={400}>
    <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>РПД согласована</div>
    </div>
    <ModalFooter onClose={onClose} />
  </Modal>;
}

export function RejectModal({ comment, onChange, onClose, onSubmit }) {
  return <Modal onClose={onClose} width={440}>
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>Возврат на доработку</div>
      <textarea value={comment} onChange={e => onChange(e.target.value)} style={{ width: "100%", height: 120, border: "1px solid " + T.border, borderRadius: 6, padding: 12, fontSize: 13, fontFamily: F, resize: "vertical", outline: "none", boxSizing: "border-box" }} placeholder="Укажите причину..." />
    </div>
    <ModalFooter onClose={onClose}>
      <Btn primary onClick={onSubmit}>Отправить</Btn>
    </ModalFooter>
  </Modal>;
}

export function ValidationModal({ errors, onGoTo, onClose }) {
  return <Modal onClose={onClose} width={460}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Нельзя отправить на согласование</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Заполните все обязательные разделы</div>
      </div>
    </div>
    <div style={{ padding: "12px 16px" }}>
      {errors.map((e, i) => <div key={i} onClick={() => onGoTo(e.secKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 5, marginBottom: 4, background: T.bg, border: "1px solid " + T.borderLight, cursor: "pointer" }}
        onMouseEnter={ev => ev.currentTarget.style.borderColor = T.accent}
        onMouseLeave={ev => ev.currentTarget.style.borderColor = T.borderLight}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: T.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>✕</span>
        <span style={{ fontSize: 13, flex: 1 }}>{e.label}</span>
        <span style={{ fontSize: 11, color: T.accent }}>перейти →</span>
      </div>)}
    </div>
    <ModalFooter onClose={onClose} />
  </Modal>;
}
