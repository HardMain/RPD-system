import { useEffect, useRef, useState, memo, useMemo } from "react";
import * as api from "../../../api/client.js";
import { T, iconBtnDelete } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { ConfirmDeleteModal, AlertModal } from "../EditorModals.jsx";

const cell = { padding: "8px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 13, verticalAlign: "middle" };
const head = { ...cell, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", background: T.bg };
const fileLink = { color: T.accent, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" };

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
        <td style={cell}>
          <button onClick={openLink} style={fileLink}>{link.name || link.original_name}</button>
          {sizeMb && <span style={{ color: T.textMuted, fontSize: 11, marginLeft: 8 }}>({sizeMb} МБ)</span>}
        </td>
        <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
          {canEdit && <button onClick={() => setConfirming(true)} title="Открепить" style={{ ...iconBtnDelete, cursor: "pointer" }}><TrashIcon /></button>}
        </td>
      </tr>
      {modals}
    </>;
  }
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + T.borderLight, borderRadius: 6 }}>
      <button onClick={openLink} style={{ ...fileLink, flex: 1 }}>
        {link.name || link.original_name}
        {sizeMb && <span style={{ marginLeft: 8, color: T.textMuted, fontSize: 11, fontWeight: 400 }}>{sizeMb} МБ</span>}
      </button>
      {canEdit && <button onClick={() => setConfirming(true)} title="Открепить" style={{ ...iconBtnDelete, cursor: "pointer" }}><TrashIcon /></button>}
    </div>
    {modals}
  </>;
}

function FileActions({ rpdId, role, replace, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [libValue, setLibValue] = useState("");
  const [libItems, setLibItems] = useState([]);
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
      setLibItems(list);
    }).catch(() => setLibItems([]));
  }, [onChanged]);

  const libOptions = useMemo(() => libItems.map(it => ({
    value: String(it.id_file),
    label: it.name || it.original_name,
  })), [libItems]);

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

  async function handlePickFromLib(value) {
    if (!value) return;
    const it = libItems.find(x => String(x.id_file) === value);
    if (!it) return;
    setBusy(true);
    try {
      await api.selectFosFile(rpdId, { id_file: it.id_file, role, name: it.name, comment: it.comment });
      setLibValue("");
      onChanged?.();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message);
    }
    setBusy(false);
  }

  return <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFileChosen} style={{ display: "none" }} />
    <Btn small onClick={() => inputRef.current?.click()} disabled={busy}>
      {busy ? "Загрузка…" : (replace ? "Заменить файл" : (role === "main" ? "Загрузить файл ФОС" : "Загрузить новый"))}
    </Btn>
    <div style={{ flex: "1 1 260px", minWidth: 240, maxWidth: 420 }}>
      <Dropdown
        value={libValue}
        options={libOptions}
        onChange={handlePickFromLib}
        placeholder={libOptions.length === 0 ? "В хранилище нет файлов" : "Выбрать из хранилища…"}
        disabled={busy || libOptions.length === 0}
        clearLabel="— не выбрано —"
      />
    </div>
    {errorMsg && <AlertModal title="Не удалось загрузить" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

export const FosEditor = memo(FosEditorBase);
