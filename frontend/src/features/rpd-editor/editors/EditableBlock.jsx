import { T, F } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function EditableBlock({ skey, label, fieldKey }) {
  const { isEdit, canEdit, generating, autoFill, editing, setEditing, editTexts, setEditTexts } = useRpdEditor();
  const val = editTexts[fieldKey] || "";
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {isEdit && canEdit && <div style={{ display: "flex", gap: 8 }}>
        <Btn small primary onClick={() => autoFill(skey)} disabled={!!generating}>{generating === skey ? "Генерация..." : "Автозаполнить"}</Btn>
        <Btn small onClick={() => setEditing(editing === skey ? null : skey)}>{editing === skey ? "Скрыть" : "Редактировать"}</Btn>
      </div>}
    </div>
    {generating === skey
      ? <div style={{ padding: 20, textAlign: "center", color: T.accent, fontSize: 13, border: "1px dashed " + T.accent, borderRadius: 6, background: T.accentLight }}>Генерация содержания с помощью LLM...</div>
      : editing === skey
        ? <textarea value={val} onChange={e => setEditTexts(p => ({ ...p, [fieldKey]: e.target.value }))} style={{ width: "100%", minHeight: 150, padding: 16, border: "1px solid " + T.accent, borderRadius: 6, background: "#fff", fontSize: 13, fontFamily: F, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        : <div style={{ padding: 16, border: "1px solid " + T.borderLight, borderRadius: 6, background: T.bg, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: 40 }}>{val || <span style={{ color: T.textMuted }}>Не заполнено</span>}</div>}
  </div>;
}
