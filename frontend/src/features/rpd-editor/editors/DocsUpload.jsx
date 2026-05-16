import { useRef } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function DocsUpload() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const fileRef = useRef(null);
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await api.uploadDocument(rpdId, file); await reload(); } catch { }
    fileRef.current.value = "";
  };
  const del = async (id) => { await api.deleteDocument(id); await reload(); };

  return <div>
    {rpd.uploaded_documents?.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{rpd.uploaded_documents.map((d, i) => <div key={d.id_document} style={{ padding: "10px 14px", borderBottom: i < rpd.uploaded_documents.length - 1 ? "1px solid " + T.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{d.filename}</span>
        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{d.file_size ? (d.file_size / 1024).toFixed(0) + " КБ" : ""}</span>
      </div>
      {isEdit && <button onClick={() => del(d.id_document)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}
    </div>)}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Документы не загружены</div>}
    {isEdit && canEdit && <div style={{ marginTop: 12 }}>
      <input ref={fileRef} type="file" onChange={handleUpload} accept=".pdf,.docx,.doc,.txt,.xlsx" style={{ display: "none" }} />
      <Btn small onClick={() => fileRef.current.click()}>Загрузить документ</Btn>
      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>PDF, DOCX, TXT, XLSX (до 50 МБ)</span>
    </div>}
  </div>;
}
