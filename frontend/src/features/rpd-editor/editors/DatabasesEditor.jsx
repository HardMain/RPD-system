import { useEffect, useRef, useState, memo } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

const fetchDatabaseSuggestions = async (q) => {
  const r = await api.getSuggestions("database_name", { q });
  return r.data?.items || [];
};

function DatabasesEditorBase() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const items = rpd.databases || [];
  const tbodyRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [refsMap, setRefsMap] = useState(() => new Map());

  useEffect(() => {
    if (!editable) return;
    let alive = true;
    api.getDatabaseRefs().then(r => {
      if (!alive) return;
      const m = new Map();
      for (const it of (r.data?.items || [])) {
        if (it?.name && it?.url) m.set(it.name.trim().toLowerCase(), it.url);
      }
      setRefsMap(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [editable]);

  async function addRow() {
    try { await api.addDatabase(rpdId, { name: "", url: "" }); await reload(); } catch {}
  }

  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (!editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    if (items.length === 0) addRow();
  }, [editable]);
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
    const next = { ...patch };
    if (next.name !== undefined) {
      const url = refsMap.get((next.name || "").trim().toLowerCase());
      if (url) next.url = url;
    }
    try {
      await api.updateDatabase(item.id_database, {
        name: next.name ?? item.name ?? "",
        url: next.url !== undefined ? next.url : (item.url ?? ""),
      });
      await reload();
    } catch {}
  }

  return <div>
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
              deletable={items.length > 1}
              onSave={(patch) => saveRow(item, patch)}
              disciplineId={rpd.id_discipline}
            />
          ))}
        </tbody>
      </table>
      </div>
      {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить запись" />}
    </div>
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

function DatabaseRow({ item, editable, deletable = true, onSave, disciplineId }) {
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

  const trashProps = deletable ? { "data-trash-row": "", "data-trash-id": item.id_database } : {};
  return <tr {...trashProps}>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.name || ""}
        onCommit={commitName}
        fetchSuggestions={(q) => fetchDatabaseSuggestions(q)}
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

export const DatabasesEditor = memo(DatabasesEditorBase);
