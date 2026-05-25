import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, hdr, tcell, iconBtnDelete, iconBtnEdit, dataTable, sectionLabel, adminAddPanel, adminToolbar, adminSearch, adminAddBtn, linkBtn } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { useSort, SortTh } from "../components/sortable.jsx";
import { TrashIcon, PencilIcon, UploadIcon, ResetIcon } from "../components/icons.jsx";
import { useColumnWidths } from "../hooks/useColumnWidths.jsx";
import { Input } from "../components/Input.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";
import { formatDateTimeRu } from "../utils/format.js";

const FOS_ACCESSORS = {
  original_name: f => f.original_name || "",
  size: f => f.size_bytes || 0,
  usage_count: f => f.usage_count || 0,
  uploaded_at: f => f.uploaded_at || "",
};

export function FosFilesContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListFosFiles().then(r => setItems(r.data || [])).catch(() => { if (!silent) setItems([]); }).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setErrorMsg("Ожидается PDF-файл."); return; }
    setBusy(true);
    try { await api.adminUploadFosFile(file); reload(); }
    catch (err) { setErrorMsg(err?.response?.data?.detail || err.message); }
    setBusy(false);
  }

  async function performDelete(f) {
    if (!f) return;
    try { await api.adminDeleteFosFile(f.id_file); reload(); }
    catch (e) { setErrorMsg(e?.response?.data?.detail || "Не удалось удалить"); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(f => (f.original_name || "").toLowerCase().includes(q));
  }, [items, search]);

  const { sort, toggleSort, sortItems } = useSort("uploaded_at", "desc");
  const sorted = useMemo(() => sortItems(filtered, FOS_ACCESSORS), [filtered, sort]);
  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(sorted, { defaultPageSize: 50, storageKey: "adminFos.pageSize" });
  const tableContainerRef = useRef(null);
  const { widths, makeResizer, resetWidths } = useColumnWidths("adminFos.v1", { original_name: 360, size: 110, usage_count: 130, uploaded_at: 180, actions: 58 }, tableContainerRef);

  return <>
    <div style={adminAddPanel}>
      <div style={sectionLabel}>Добавить файл ФОС</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
          PDF до 10 МБ. После загрузки файл доступен в редакторе РПД через «Выбрать из хранилища».
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUpload} style={{ display: "none" }} />
        <Btn small primary onClick={() => fileInputRef.current?.click()} disabled={busy} style={adminAddBtn}>
          <UploadIcon /> {busy ? "Загрузка…" : "Загрузить PDF"}
        </Btn>
      </div>
    </div>

    <div style={adminToolbar}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по имени файла…"
        style={adminSearch(360)}
      />
      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
        {filtered.length} {filtered.length === items.length ? "" : `из ${items.length}`}
      </span>
    </div>

    <div ref={tableContainerRef} className="table-scroll">
      {loading
        ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : filtered.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
              {items.length === 0 ? "Файлов ФОС пока нет — загрузите первый сверху." : "Ничего не нашлось."}
            </div>
          : <table style={{ ...dataTable, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: widths.original_name }} />
              <col style={{ width: widths.size }} />
              <col style={{ width: widths.usage_count }} />
              <col style={{ width: widths.uploaded_at }} />
              <col style={{ width: widths.actions }} />
            </colgroup>
            <thead><tr style={{ background: T.surface }}>
              <SortTh sortKey="original_name" sort={sort} onSort={toggleSort} onResize={makeResizer("original_name", "size")}>Имя файла</SortTh>
              <SortTh sortKey="size" sort={sort} onSort={toggleSort} onResize={makeResizer("size", "usage_count")}>Размер</SortTh>
              <SortTh sortKey="usage_count" sort={sort} onSort={toggleSort} onResize={makeResizer("usage_count", "uploaded_at")}>Использование</SortTh>
              <SortTh sortKey="uploaded_at" sort={sort} onSort={toggleSort} onResize={makeResizer("uploaded_at", "actions")}>Загружен</SortTh>
              <th style={{ ...hdr, textAlign: "center" }}>
                <button type="button" onClick={resetWidths} title="Восстановить ширину колонок по умолчанию"
                  style={{ border: "none", background: "none", color: T.text, cursor: "pointer", padding: 2, display: "inline-flex" }}><ResetIcon /></button>
              </th>
            </tr></thead>
            <tbody>
              {pageItems.map(f => {
                const sizeMb = f.size_bytes ? (f.size_bytes / 1024 / 1024).toFixed(2) : null;
                const cellEllipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                return <tr key={f.id_file}
                    onDoubleClick={() => setEditing(f)}
                    style={{ background: T.surface, cursor: "pointer" }}
                    title="Двойной клик — редактировать">
                  <td style={{ ...tcell, fontWeight: 600, ...cellEllipsis }} title={f.original_name}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); api.openFile(f.id_file).catch(() => setErrorMsg("Не удалось открыть файл.")); }}
                      style={{ ...linkBtn, font: "inherit", fontWeight: 600 }}>{f.original_name}</button>
                  </td>
                  <td style={{ ...tcell, textAlign: "center", ...cellEllipsis }}>{sizeMb ? `${sizeMb} МБ` : "—"}</td>
                  <td style={{ ...tcell, textAlign: "center", fontSize: 11, color: f.usage_count ? T.text : T.textMuted, fontStyle: f.usage_count ? "normal" : "italic", ...cellEllipsis }}>
                    {f.usage_count ? `${f.usage_count} РПД` : "Не используется"}
                  </td>
                  <td style={{ ...tcell, fontSize: 12, color: T.textMuted, ...cellEllipsis }}>{f.uploaded_at ? formatDateTimeRu(f.uploaded_at) : "—"}</td>
                  <td style={{ ...tcell, textAlign: "right", whiteSpace: "nowrap", padding: "10px 8px", overflow: "hidden" }} onDoubleClick={e => e.stopPropagation()}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(f); }} title="Переименовать" style={{ ...iconBtnEdit, cursor: "pointer" }}><PencilIcon /></button>
                      <button onClick={(e) => { e.stopPropagation(); setPendingDelete(f); }} title="Удалить файл" style={{ ...iconBtnDelete, cursor: "pointer" }}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>}
    </div>
    {!loading && (
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={setPageSize} />
    )}

    {editing && <FosEditModal
      data={editing}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); reload(); }}
      onError={setErrorMsg}
    />}
    {pendingDelete && <ConfirmDeleteModal
      title={`Удалить файл «${pendingDelete.original_name}»?`}
      message={pendingDelete.usage_count > 0
        ? `Файл используется в ${pendingDelete.usage_count} РПД. Сначала открепите его.`
        : "Файл будет удалён из хранилища навсегда."}
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const f = pendingDelete; setPendingDelete(null); await performDelete(f); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function FosEditModal({ data, onClose, onSaved, onError }) {
  const [name, setName] = useState(data.original_name || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Имя не может быть пустым"); return; }
    setSaving(true);
    setErr("");
    try {
      await api.adminUpdateFosFile(data.id_file, { original_name: name.trim() });
      onSaved();
    } catch (e) {
      const msg = "Не удалось сохранить: " + (e?.response?.data?.detail || e.message);
      setErr(msg);
      onError && onError(msg);
    }
    setSaving(false);
  }

  return <Modal width={520} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      Переименование файла ФОС
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Input required label="Имя файла" value={name} onChange={e => setName(e.target.value)} />
      {err && <div style={{ background: T.redSoft, color: T.red, padding: 8, borderRadius: 4, fontSize: 13 }}>{err}</div>}
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
      <Btn onClick={onClose}>Отмена</Btn>
    </div>
  </Modal>;
}
