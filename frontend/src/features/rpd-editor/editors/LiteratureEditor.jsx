import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea, inlineInput, inlineNumber } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { MultiSelectDropdown } from "../../../components/MultiSelectDropdown.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { LITERATURE_TYPES, ELS_OPTIONS } from "../catalogs.js";
import { ConfirmDeleteModal } from "../EditorModals.jsx";
import { ClearSectionBtn } from "../ClearSectionBtn.jsx";
import { GenPlaque } from "../GenPlaque.jsx";
import { GenButton } from "../GenButton.jsx";

async function fetchLiteratureSuggestions(mode, sourceType, q) {
  const params = { q, mode };
  if (sourceType) params.source_type = sourceType;
  const r = await api.getSuggestions("literature_title", params);
  return r.data?.items || [];
}

export function LiteratureEditor({ kind }) {
  const { rpd, rpdId, isEdit, canEdit, reload, autoFill, generating, genBusy } = useRpdEditor();
  const editable = isEdit && canEdit;
  const isElectronic = kind === "electronic";
  const [pendingDelete, setPendingDelete] = useState(null);

  const items = (rpd.literature || []).filter(l => isElectronic ? !!l.url : !l.url);

  async function addRow(source_type) {
    const payload = isElectronic
      ? { source_type, title: "", url: " ", availability: [] }

      : { source_type, title: "", copies_count: 0 };
    try { await api.addLiterature(rpdId, payload); await reload(); } catch {}
  }

  async function performDelete(item) {
    if (!item) return;
    try { await api.deleteLiterature(item.id_literature); await reload(); } catch {}
  }
  function delRow(item) {
    const filled = isElectronic
      ? ((item.title || "").trim() || (item.url || "").trim()
         || (item.source_type || "").trim() || (item.availability?.length > 0))
      : ((item.title || "").trim() || (item.copies_count != null && item.copies_count !== 0));
    if (filled) { setPendingDelete(item); return; }
    performDelete(item);
  }

  async function saveField(item, patch) {
    try { await api.updateLiterature(item.id_literature, patch); await reload(); } catch {}
  }

  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (isElectronic || !editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    const hasMain = items.some(l => l.source_type === "Учебные и научные издания");
    if (!hasMain) addRow("Учебные и научные издания");

  }, [editable, isElectronic]);

  const confirmModal = pendingDelete ? <ConfirmDeleteModal
    title="Удалить запись?"
    message="Запись содержит данные. После удаления восстановить её будет нельзя."
    onClose={() => setPendingDelete(null)}
    onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
  /> : null;

  if (isElectronic) {
    return <>
      <ElectronicTable
        items={items}
        editable={editable}

        onAdd={() => addRow("")}
        onDelete={delRow}
        onSave={saveField}
      />
      {confirmModal}
    </>;
  }

  return <>
    <PrintedTable
      items={items}
      editable={editable}
      autoFill={autoFill}
      generating={generating}
      genBusy={genBusy}
      onAdd={addRow}
      onDelete={delRow}
      onSave={saveField}
    />
    {confirmModal}
  </>;
}

const ADDITIONAL_MAIN_TYPE = "Учебные и научные издания (дополнительные)";
const PRINTED_SECTIONS = [
  {
    title: "1. Основная литература",
    groups: [{ source_type: "Учебные и научные издания", genKey: "literature_printed_main" }],
  },
  {
    title: "2. Дополнительная литература",
    groups: [
      { subtitle: "2.1. Учебные и научные издания", source_type: ADDITIONAL_MAIN_TYPE, genKey: "literature_printed_additional" },
      { subtitle: "2.2. Периодические издания", source_type: "Периодические издания", genKey: "literature_periodicals" },
      { subtitle: "2.3. Нормативно-технические издания", source_type: "Нормативно-технические издания", genKey: "literature_normative" },
    ],
  },
  {
    title: "3. Методические указания для студентов по освоению дисциплины",
    groups: [{ source_type: "Методические указания для студентов по освоению дисциплины", genKey: "literature_methodical_students" }],
  },
  {
    title: "4. Учебно-методическое обеспечение самостоятельной работы студента",
    groups: [{ source_type: "Учебно-методическое обеспечение самостоятельной работы студента", genKey: "literature_methodical_self_study" }],
  },
];

const PRINTED_TYPES = PRINTED_SECTIONS.flatMap(s => s.groups.map(g => g.source_type));

function PrintedTable({ items, editable, autoFill, generating, genBusy, onAdd, onDelete, onSave }) {

  const grouped = Object.fromEntries(PRINTED_TYPES.map(t => [t, []]));
  for (const it of items) {
    if (grouped[it.source_type] !== undefined) grouped[it.source_type].push(it);
    else grouped["Учебные и научные издания"].push(it);
  }

  function renderGroup(g) {
    const rows = grouped[g.source_type];
    return <PrintedGroup
      key={g.source_type}
      g={g}
      rows={rows}
      editable={editable}
      autoFill={autoFill}
      generating={generating}
      genBusy={genBusy}
      required={g.source_type === "Учебные и научные издания"}
      onAdd={onAdd}
      onDelete={onDelete}
      onSave={onSave}
    />;
  }

  return <div>
    {PRINTED_SECTIONS.map(section => {
      const isSingleGroup = section.groups.length === 1;
      let titleSlot = (
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid " + T.borderLight }}>
          {section.title}
        </div>
      );
      if (isSingleGroup) {
        const g = section.groups[0];
        const rows = grouped[g.source_type];
        const required = g.source_type === "Учебные и научные издания";
        const showTable = rows.length > 0 || required;
        const showBtn = editable && showTable && !!g.genKey;
        titleSlot = (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{section.title}</div>
            {showBtn && <span style={{ display: "flex", gap: 8, flexShrink: 0 }}><ClearSectionBtn skey={g.genKey} /><GenButton skey={g.genKey} /></span>}
          </div>
        );
      }
      return <div key={section.title} style={{ marginBottom: 22 }}>
        {titleSlot}
        {section.groups.map(renderGroup)}
      </div>;
    })}
  </div>;
}

function PrintedGroup({ g, rows, editable, required = false, autoFill, generating, genBusy, onAdd, onDelete, onSave }) {
  const tbodyRef = useRef(null);
  function delById(id) {
    const item = rows.find(it => String(it.id_literature) === String(id));
    if (item) onDelete(item);
  }
  const showTable = rows.length > 0 || required;
  const showBtn = editable && showTable && !!g.genKey;
  return <div style={{ marginBottom: 16 }}>
    {g.subtitle && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{g.subtitle}</div>
        {showBtn && <span style={{ display: "flex", gap: 8, flexShrink: 0 }}><ClearSectionBtn skey={g.genKey} /><GenButton skey={g.genKey} /></span>}
      </div>
    )}
    <GenPlaque skey={g.genKey}>
    {showTable ? (
      <div style={{ position: "relative" }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: 50 }} />
          <col />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "center" }}>№ п/п</th>
            <th style={th}>Библиографическое описание (автор, заглавие, вид издания, место, издательство, год издания, количество страниц)</th>
            <th style={{ ...th, textAlign: "center" }}>Количество экземпляров в библиотеке</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {rows.map((item, i) => (
            <PrintedRow
              key={item.id_literature}
              item={item}
              index={i + 1}
              editable={editable}
              deletable={!required || rows.length > 1}
              sourceType={g.source_type}
              onSave={(patch) => onSave(item, patch)}
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
        <Btn small onClick={() => onAdd(g.source_type)}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
    </GenPlaque>
  </div>;
}

function PrintedRow({ item, index, editable, deletable = true, sourceType, onSave }) {
  const [copies, setCopies] = useState(item.copies_count ?? 0);
  const copiesRef = useRef(item.copies_count ?? 0);
  useEffect(() => {
    const next = item.copies_count ?? 0;
    if (copies === copiesRef.current) setCopies(next);
    copiesRef.current = next;
  }, [item.copies_count]);

  function commitTitle(v) {
    if (v === (item.title || "")) return;
    onSave({ title: v });
  }
  function commitCopies() {
    const cur = +copies || 0;
    const orig = item.copies_count ?? 0;
    if (cur === orig) return;
    onSave({ copies_count: cur });
  }

  if (!editable) {
    return <tr>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
      <td style={td}>{item.title || ""}</td>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{item.copies_count ?? 0}</td>
    </tr>;
  }

  const trashProps = deletable ? { "data-trash-row": "", "data-trash-id": item.id_literature } : {};
  return <tr {...trashProps}>
    <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.title || ""}
        onCommit={commitTitle}
        fetchSuggestions={(q) => fetchLiteratureSuggestions("printed", sourceType, q)}
        placeholder="Например: Курс физики (Трофимова Т.И., Академия, 2019, 560 с.)"
        textarea
        collapsedMaxHeight={70}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <input
        type="number"
        min="0"
        value={copies ?? 0}
        onChange={e => setCopies(e.target.value === "" ? 0 : +e.target.value)}
        onBlur={commitCopies}
        style={inlineNumber}
      />
    </td>
  </tr>;
}

function ElectronicTable({ items, editable, onAdd, onDelete, onSave }) {
  const tbodyRef = useRef(null);
  function delById(id) {
    const item = items.find(it => String(it.id_literature) === String(id));
    if (item) onDelete(item);
  }
  return <div>
    {items.length > 0 ? (
      <div style={{ position: "relative" }}>
      <div className="table-scroll">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>Вид литературы ЭБС</th>
            <th style={th}>Наименование разработки</th>
            <th style={th}>Ссылка на информационный ресурс</th>
            <th style={th}>Доступность ЭБС (сеть Интернет / локальная сеть; авторизованный / свободный доступ)</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {items.map(item => (
            <ElectronicRow
              key={item.id_literature}
              item={item}
              editable={editable}
              onSave={(patch) => onSave(item, patch)}
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
        <Btn small onClick={onAdd}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
  </div>;
}

function ElectronicRow({ item, editable, onSave }) {
  const [url, setUrl] = useState(((item.url || "").trim() ? item.url : ""));
  const urlRef = useRef((item.url || "").trim() ? item.url : "");
  useEffect(() => {
    const next = (item.url || "").trim() ? item.url : "";
    if (url === urlRef.current) setUrl(next);
    urlRef.current = next;
  }, [item.url]);

  function commitTitle(v) {
    if (v === (item.title || "")) return;
    onSave({ title: v });
  }
  function commitUrl() {
    const clean = url.trim();
    const next = clean ? clean : " ";
    if (next === (item.url || "")) return;
    onSave({ url: next });
  }
  function changeType(v) {
    if (v === item.source_type) return;
    onSave({ source_type: v });
  }
  function changeAvail(arr) {
    onSave({ availability: arr });
  }

  if (!editable) {
    const avail = Array.isArray(item.availability) ? item.availability : [];
    const cleanUrl = (item.url || "").trim();
    return <tr>
      <td style={td}>{item.source_type || ""}</td>
      <td style={td}>{item.title || ""}</td>
      <td style={{ ...td, wordBreak: "break-all" }}>
        {cleanUrl
          ? <a href={cleanUrl} target="_blank" rel="noreferrer" style={{ color: T.accent }}>{cleanUrl}</a>
          : ""}
      </td>
      <td style={td}>{avail.length ? avail.join(", ") : ""}</td>
    </tr>;
  }

  const typeOptions = LITERATURE_TYPES
    .filter(t => t !== ADDITIONAL_MAIN_TYPE)
    .map(t => ({ value: t, label: t }));

  return <tr data-trash-row data-trash-id={item.id_literature}>
    <td style={{ ...td, padding: 4 }}>
      <Dropdown
        value={item.source_type || ""}
        options={typeOptions}
        onChange={changeType}
        placeholder="Выбрать вид"
        clearLabel="Не выбрано"
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <Combobox
        value={item.title || ""}
        onCommit={commitTitle}
        fetchSuggestions={(q) => fetchLiteratureSuggestions("electronic", item.source_type, q)}
        placeholder="Например: Информатика. Базовый курс (Денисова Э.В., 2017)"
        textarea
        collapsedMaxHeight={70}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onBlur={commitUrl}
        placeholder="https://…"
        style={inlineInput}
      />
    </td>
    <td style={{ ...td, padding: 4 }}>
      <MultiSelectDropdown
        value={Array.isArray(item.availability) ? item.availability : []}
        options={ELS_OPTIONS}
        onChange={changeAvail}
        placeholder="Выбрать ЭБС"
      />
    </td>
  </tr>;
}


