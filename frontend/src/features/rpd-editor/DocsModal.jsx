import { T, modalFooter } from "../../styles/index.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";
import { DocsUpload } from "./editors/DocsUpload.jsx";

export function DocsModal({ onClose }) {
  return <Modal onClose={onClose} width={620}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Документы для LLM</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
        Контекст для автогенерации содержания этой РПД. В печатную форму не попадают.
      </div>
    </div>
    <div style={{ padding: "18px 24px" }}>
      <DocsUpload />
    </div>
    <div style={modalFooter}>
      <Btn onClick={onClose}>Закрыть</Btn>
    </div>
  </Modal>;
}
