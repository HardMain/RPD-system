import { useEffect, useRef, useState, memo } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Modal } from "../../../components/Modal.jsx";
import { LoadingOverlay } from "../../../components/LoadingOverlay.jsx";
import { TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal, AlertModal } from "../EditorModals.jsx";

const cell = { padding: "8px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 13, verticalAlign: "middle" };
const head = { ...cell, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", background: T.bg };

function FosEditorBase() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const main = rpd.fos_main;
  const other = rpd.fos_other || [];

  return <div>

    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Файл ФОС</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
        Прикрепляется к печатной форме РПД. Только PDF, до 10 МБ. Один на РПД — повторная загрузка заменит существующий.
      </div>
      {main
        ? <FileRow link={main} canEdit={isEdit && canEdit} onChanged={reload} />
        : <EmptyRow text="Не заполнено" />}
      {isEdit && canEdit && <FileActions rpdId={rpdId} role="main" replace={!!main} onChanged={reload} />}
    </div>

    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Прочие файлы ФОС</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
        Дополнительные материалы фонда оценочных средств. В печатную форму не попадают.
      </div>
      {other.length === 0
        ? <EmptyRow text="Не используется" />
        : <div className="table-scroll" style={{ border: "1px solid " + T.borderLight, borderRadius: 6, overflowY: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={head}>Наименование</th>
                <th style={head}>Комментарий</th>
                <th style={head}>Файл</th>
                <th style={head} />
              </tr></thead>
              <tbody>
                {other.map(f => (
                  <FileRow key={f.id_rpd_fos} link={f} canEdit={isEdit && canEdit} onChanged={reload} asTable />
                ))}
              </tbody>
            </table>
          </div>}
      {isEdit && canEdit && <FileActions rpdId={rpdId} role="other" onChanged={reload} />}
    </div>
  </div>;
}

function EmptyRow({ text }) {
  return <div style={{ padding: 10, background: T.bg, borderRadius: 4, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>{text}</div>;
}

function FileRow({ link, canEdit, onChanged, asTable }) {
  const sizeMb = link.size_bytes ? (link.size_bytes / 1024 / 1024).toFixed(2) : null;
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  async function performUnlink() {
    try { await api.deleteFosLink(link.id_rpd_fos); onChanged?.(); }
    catch { setErrorMsg("Не удалось открепить файл."); }
  }
  const openLink = (e) => {
    e.preventDefault();
    api.openFile(link.id_file).catch(() => setErrorMsg("Не удалось открыть файл."));
  };
  const linkStyle = { color: T.accent, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" };
  const modals = <>
    {confirming && <ConfirmDeleteModal
      title="Открепить файл от РПД?"
      message="Файл будет отвязан от этой РПД. Сам файл в общем хранилище останется."
      confirmLabel="Открепить"
      onClose={() => setConfirming(false)}
      onConfirm={async () => { setConfirming(false); await performUnlink(); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
  if (asTable) {
    return <>
      <tr>
        <td style={cell}><b>{link.name || link.original_name}</b></td>
        <td style={cell}>{link.comment || ""}</td>
        <td style={cell}><button onClick={openLink} style={linkStyle}>📄 {link.original_name}</button> {sizeMb && <span style={{ color: T.textMuted, fontSize: 11 }}>({sizeMb} МБ)</span>}</td>
        <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
          {canEdit && <button onClick={() => setConfirming(true)} title="Открепить" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><TrashIcon /></button>}
        </td>
      </tr>
      {modals}
    </>;
  }
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + T.borderLight, borderRadius: 6 }}>
      <button onClick={openLink} style={{ ...linkStyle, flex: 1 }}>
        📄 {link.name || link.original_name}
        <span style={{ marginLeft: 8, color: T.textMuted, fontSize: 11, fontWeight: 400 }}>{link.original_name}{sizeMb ? ` · ${sizeMb} МБ` : ""}</span>
      </button>
      {canEdit && <button onClick={() => setConfirming(true)} title="Открепить" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><TrashIcon /></button>}
    </div>
    {modals}
  </>;
}

function FileActions({ rpdId, role, replace, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [showLib, setShowLib] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setErrorMsg("Ожидается PDF-файл."); return; }
    setBusy(true);
    try { await api.uploadFosFile(rpdId, file, role); onChanged?.(); }
    catch (err) { setErrorMsg(err?.response?.data?.detail || err.message); }
    setBusy(false);
  }

  return <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
    <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFileChosen} style={{ display: "none" }} />
    <Btn small onClick={() => inputRef.current?.click()} disabled={busy}>
      {busy ? "Загрузка…" : (replace ? "Заменить файл" : (role === "main" ? "Загрузить файл ФОС" : "Загрузить новый"))}
    </Btn>
    <Btn small onClick={() => setShowLib(true)}>Выбрать из хранилища…</Btn>
    {showLib && <FosLibraryModal rpdId={rpdId} role={role} onClose={() => setShowLib(false)} onPicked={() => { setShowLib(false); onChanged?.(); }} />}
    {errorMsg && <AlertModal title="Не удалось загрузить" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

function FosLibraryModal({ rpdId, role, onClose, onPicked }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    api.getFosLibrary().then(r => {

      const seen = new Set();
      const list = [];
      for (const it of r.data) {
        if (seen.has(it.id_file)) continue;
        seen.add(it.id_file);
        list.push(it);
      }
      setItems(list);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const filtered = q
    ? items.filter(it => (it.name || "").toLowerCase().includes(q.toLowerCase()) || (it.original_name || "").toLowerCase().includes(q.toLowerCase()))
    : items;

  async function pick(it) {
    setBusyId(it.id_file);
    try {
      await api.selectFosFile(rpdId, { id_file: it.id_file, role, name: it.name, comment: it.comment });
      onPicked();
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || e.message);
    }
    setBusyId(null);
  }

  if (loading) {
    return <LoadingOverlay onClose={onClose} />;
  }

  return <Modal width={620} onClose={onClose}>
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Выбор файла ФОС из хранилища</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск…"
        style={{ width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, marginBottom: 12, boxSizing: "border-box" }} />
      <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid " + T.borderLight, borderRadius: 6, background: T.surface }}>
        {filtered.length === 0 && <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>В хранилище нет ФОС-файлов. Загрузите новый PDF.</div>}
        {filtered.map(it => (
          <div key={it.id_file} style={{ padding: "10px 12px", borderBottom: "1px solid " + T.borderLight, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name || it.original_name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {it.original_name}{it.size_bytes ? ` · ${(it.size_bytes / 1024 / 1024).toFixed(2)} МБ` : ""} · {it.role === "main" ? "Основной" : "Прочий"}
              </div>
            </div>
            <button onClick={() => api.openFile(it.id_file).catch(() => setErrorMsg("Не удалось открыть файл."))} style={{ color: T.accent, fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>Просмотр</button>
            <Btn small primary onClick={() => pick(it)} disabled={busyId === it.id_file}>Выбрать</Btn>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <Btn onClick={onClose}>Закрыть</Btn>
      </div>
    </div>
    {errorMsg && <AlertModal title="Не удалось выбрать файл" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </Modal>;
}

export const FosEditor = memo(FosEditorBase);
