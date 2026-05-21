import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

const fetchDatabaseSuggestions = async (q, id_discipline) => {
  const params = { q };
  if (id_discipline) params.id_discipline = id_discipline;
  const r = await api.getSuggestions("database_name", params);
  return r.data?.items || [];
};

export function DatabasesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.databases || [];
  const tbodyRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function addRow() {
    try { await api.addDatabase(rpdId, { name: "", url: "" }); await reload(); } catch {}
  }
  async function performDelete(item) {
    if (!item) return;
    try { await api.deleteDatabase(item.id_database); await reload(); } catch {}
  }
  function delRow(item) {
    const filled = (item.name || "").trim() || (item.url || "").trim();
    if (filled) { setPendingDelete(item); return; }
    performDelete(item);
  }
  function delById(id) {
    const item = items.find(it => String(it.id_database) === String(id));
    if (item) delRow(item);
  }
  async function saveRow(item, patch) {
    try {
      await api.updateDatabase(item.id_database, {
        name: patch.name ?? item.name ?? "",
        url: patch.url !== undefined ? patch.url : (item.url ?? ""),
      });
      await reload();
    } catch {}
  }

  return <div>
    {items.length > 0 ? (
      <div style={{ position: "relative" }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "55%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>Наименование</th>
            <th style={th}>Ссылка на информационный ресурс</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {items.map(item => (
            <DatabaseRow
              key={item.id_database}
              item={item}
              editable={editable}
              onSave={(patch) => saveRow(item, patch)}
              disciplineId={rpd.id_discipline}
            />
          ))}
        </tbody>
      </table>
      </div>
      {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить запись" />}
      </div>
    ) : (
      <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
        Не используется
      </div>
    )}
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={addRow}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
    {pendingDelete && <ConfirmDeleteModal
      title="Удалить запись?"
      message="Запись содержит данные. После удаления восстановить её будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
    />}
  </div>;
}

function DatabaseRow({ item, editable, onSave, disciplineId }) {
  const [url, setUrl] = useState(item.url || "");
  const urlRef = useRef(item.url || "");
  useEffect(() => {
    const next = item.url || "";
    if (url === urlRef.current) setUrl(next);
    urlRef.current = next;
  }, [item.url]);

  function commitName(v) {
    if (v === (item.name || "")) return;
    onSave({ name: v });
  }
  function commitUrl() {
    if (url === (item.url || "")) return;
    onSave({ url: url });
  }

  if (!editable) {
    const cleanUrl = (item.url || "").trim();
    const isLink = /^https?:\/\//i.test(cleanUrl);
    return <tr>
      <td style={td}>{item.name || ""}</td>
      <td style={{ ...td, wordBreak: "break-all" }}>
        {isLink
          ? <a href={cleanUrl} target="_blank" rel="noreferrer" style={{ color: T.accent }}>{cleanUrl}</a>
          : (cleanUrl || "")}
      </td>
    </tr>;
  }

  return <tr data-trash-row data-trash-id={item.id_database}>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.name || ""}
        onCommit={commitName}
        fetchSuggestions={(q) => fetchDatabaseSuggestions(q, disciplineId)}
        placeholder="Например: Электронно-библиотечная система Лань"
        textarea
        collapsedMaxHeight={64}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <ExpandableTextarea
        value={url}
        onChange={e => setUrl(e.target.value)}
        onBlur={commitUrl}
        placeholder="https://… или «локальная сеть»"
        collapsedMaxHeight={64}
        style={{ ...inlineTextarea, wordBreak: "break-all" }}
      />
    </td>
  </tr>;
}
