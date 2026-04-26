import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { Badge } from "../../../components/Badge.jsx";
import { PlusIcon, SparkleIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

export function LiteratureEditor({ kind }) {
  // kind: "printed" — без url; "electronic" — с url
  const { rpd, rpdId, isEdit, canEdit, generating, autoFill, reload } = useRpdEditor();
  const isElectronic = kind === "electronic";
  const filterFn = (l) => isElectronic ? !!l.url : !l.url;
  const items = (rpd.literature || []).filter(filterFn);
  const [showAdd, setShowAdd] = useState(false);
  const initialForm = { source_type: isElectronic ? "Дополнительная" : "Основная", title: "", authors: "", year: 2024, publisher: "", url: "", copies_count: "" };
  const [form, setForm] = useState(initialForm);

  const addLit = async () => {
    const payload = { ...form, year: form.year ? +form.year : null, copies_count: form.copies_count ? +form.copies_count : null };
    if (!isElectronic) payload.url = null;
    try { await api.addLiterature(rpdId, payload); setShowAdd(false); setForm(initialForm); await reload(); } catch { }
  };
  const delLit = async (id) => { await api.deleteLiterature(id); await reload(); };

  const inputStyle = { width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, marginBottom: 8, boxSizing: "border-box" };

  return <div>
    {items.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{items.map((l, i) => <div key={l.id_literature} style={{ padding: "10px 14px", borderBottom: i < items.length - 1 ? "1px solid " + T.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{l.title}</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>{l.authors}{l.year ? ", " + l.year : ""}{l.publisher ? " — " + l.publisher : ""}{l.copies_count ? " (экз. " + l.copies_count + ")" : ""}</div>
        {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.blue, wordBreak: "break-all" }}>{l.url}</a>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Badge status={l.source_type === "Основная" ? "На согласовании" : "Черновик"} />
        {isEdit && canEdit && <button onClick={() => delLit(l.id_literature)} style={{ border: "none", background: "none", cursor: "pointer" }}><TrashIcon /></button>}
      </div>
    </div>)}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>{isElectronic ? "Электронная" : "Печатная"} литература не добавлена</div>}
    {isEdit && canEdit && <div style={{ marginTop: 12 }}>
      {!showAdd ? <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={() => setShowAdd(true)}><PlusIcon /> Добавить</Btn>
          {!isElectronic && <Btn small primary onClick={() => autoFill("literature")} disabled={!!generating}><SparkleIcon /> Автоподбор</Btn>}
        </div>
        : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))} style={{ padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13 }}><option>Основная</option><option>Дополнительная</option></select>
            <input placeholder="Год" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} style={{ width: 80, padding: "6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />
            {!isElectronic && <input placeholder="Кол-во экз." type="number" value={form.copies_count} onChange={e => setForm(p => ({ ...p, copies_count: e.target.value }))} style={{ width: 110, padding: "6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, textAlign: "center" }} />}
          </div>
          <input placeholder="Авторы" value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))} style={inputStyle} />
          <input placeholder="Название" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
          <input placeholder="Издательство" value={form.publisher} onChange={e => setForm(p => ({ ...p, publisher: e.target.value }))} style={inputStyle} />
          {isElectronic && <input placeholder="URL электронного ресурса" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={inputStyle} />}
          <div style={{ display: "flex", gap: 8 }}><Btn small primary onClick={addLit}>Добавить</Btn><Btn small onClick={() => setShowAdd(false)}>Отмена</Btn></div>
        </div>}
    </div>}
  </div>;
}
