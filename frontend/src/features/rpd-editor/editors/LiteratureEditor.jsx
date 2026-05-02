import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { MultiSelectDropdown } from "../../../components/MultiSelectDropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { LITERATURE_TYPES, ELS_OPTIONS } from "../catalogs.js";

/**
 * Универсальный редактор разделов 6.1 (печатная) и 6.2 (электронная литература).
 * Шапка и группы 1:1 со структурой rpd_template.docx (TABLE 11/12) — то, что
 * увидит читатель в печатной форме.
 *
 * Печатная (6.1): группы по `source_type` (та же раскладка, что в backend
 *   PRINTED_BUCKETS), 3 колонки «№ п/п | Библиографическое описание | Количество
 *   экземпляров в библиотеке». Группа без записей таблицу не рисует — только
 *   заголовок и кнопку «+ Добавить запись».
 *
 * Электронная (6.2): одна общая таблица, 4 колонки «Вид литературы ЭБС |
 *   Наименование разработки | Ссылка на информационный ресурс | Доступность
 *   ЭБС». Дискриминатор «электронная» по факту наличия URL — это согласовано
 *   с backend (rpd_template_context.py: `if l.url: lit_el.append(...)`).
 *   Поэтому новой строке 6.2 кладём URL=" " (пробел), чтобы она не «утекла» в 6.1
 *   до того, как пользователь введёт настоящую ссылку.
 *
 * Inline-редактирование: значения правятся прямо в ячейках, сохранение по
 * onBlur (как в OutcomesEditor / SectionEditor). Корзина живёт справа за
 * границей таблицы — карточка редактора имеет 40px правого padding'а, в нём
 * как раз помещается иконка.
 */
export function LiteratureEditor({ kind }) {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const isElectronic = kind === "electronic";

  // Делим литературу по дискриминатору «есть URL — значит электронная».
  // Совпадает с rpd_template_context.py.
  const items = (rpd.literature || []).filter(l => isElectronic ? !!l.url : !l.url);

  async function addRow(source_type) {
    const payload = isElectronic
      ? { source_type, title: "", url: " ", availability: [] }
      : { source_type, title: "", copies_count: null };
    try { await api.addLiterature(rpdId, payload); await reload(); } catch {}
  }

  async function delRow(item) {
    // Пустую строку — без подтверждения. Считаем «пустой», когда пользователь
    // не ввёл ни одного поля и ничего не выбрал из выпадашек. Sentinel URL=" "
    // у новой 6.2-строки после .trim() становится пустым.
    const filled = isElectronic
      ? ((item.title || "").trim() || (item.url || "").trim()
         || (item.source_type || "").trim() || (item.availability?.length > 0))
      : ((item.title || "").trim() || item.copies_count != null);
    if (filled && !confirm("Удалить запись?")) return;
    try { await api.deleteLiterature(item.id_literature); await reload(); } catch {}
  }

  async function saveField(item, patch) {
    try { await api.updateLiterature(item.id_literature, patch); await reload(); } catch {}
  }

  // «1. Основная литература» — обязательный блок: автодобавляем одну пустую
  // строку, чтобы преподаватель сразу видел, куда печатать. Срабатывает один
  // раз на маунт редактора 6.1, в режиме редактирования. Пустая строка не
  // попадает в печатную форму (фильтр в rpd_template_context.py).
  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (isElectronic || !editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    const hasMain = items.some(l => l.source_type === "Учебные и научные издания");
    if (!hasMain) addRow("Учебные и научные издания");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, isElectronic]);

  if (isElectronic) {
    return <ElectronicTable
      items={items}
      editable={editable}
      // Новой 6.2-строке source_type=""  — в выпадашке покажется «Не выбрано»,
      // и сама строка считается «пустой» до того, как пользователь что-то
      // введёт/выберет. В печатную форму такая строка не попадает.
      onAdd={() => addRow("")}
      onDelete={delRow}
      onSave={saveField}
    />;
  }

  return <PrintedTable
    items={items}
    editable={editable}
    onAdd={addRow}
    onDelete={delRow}
    onSave={saveField}
  />;
}


// ─── 6.1 Печатная литература ────────────────────────────────────────────────

const PRINTED_GROUPS = [
  { title: "1. Основная литература", source_type: "Учебные и научные издания" },
  { title: "2.2. Периодические издания", source_type: "Периодические издания" },
  { title: "2.3. Нормативно-технические издания", source_type: "Нормативно-технические издания" },
  { title: "3. Методические указания для студентов по освоению дисциплины", source_type: "Методические указания для студентов по освоению дисциплины" },
  { title: "4. Учебно-методическое обеспечение самостоятельной работы студента", source_type: "Учебно-методическое обеспечение самостоятельной работы студента" },
];

function PrintedTable({ items, editable, onAdd, onDelete, onSave }) {
  // Несовпавшие по виду (legacy/неизвестные source_type) — кладём в основную,
  // как делает backend (PRINTED_BUCKETS fallback на main).
  const grouped = Object.fromEntries(PRINTED_GROUPS.map(g => [g.source_type, []]));
  for (const it of items) {
    if (grouped[it.source_type] !== undefined) grouped[it.source_type].push(it);
    else grouped["Учебные и научные издания"].push(it);
  }

  return <div>
    {PRINTED_GROUPS.map(g => {
      const rows = grouped[g.source_type];
      return <div key={g.source_type} style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{g.title}</div>
        {rows.length > 0 ? (
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
            <tbody>
              {rows.map((item, i) => (
                <PrintedRow
                  key={item.id_literature}
                  item={item}
                  index={i + 1}
                  editable={editable}
                  onSave={(patch) => onSave(item, patch)}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </tbody>
          </table>
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
      </div>;
    })}
  </div>;
}

function PrintedRow({ item, index, editable, onSave, onDelete }) {
  const [title, setTitle] = useState(item.title || "");
  const [copies, setCopies] = useState(item.copies_count == null ? "" : String(item.copies_count));
  useEffect(() => { setTitle(item.title || ""); }, [item.title]);
  useEffect(() => { setCopies(item.copies_count == null ? "" : String(item.copies_count)); }, [item.copies_count]);

  function commitTitle() {
    if (title === (item.title || "")) return;
    onSave({ title });
  }
  function commitCopies() {
    const n = copies.trim() === "" ? null : Number(copies);
    if (n === item.copies_count) return;
    onSave({ copies_count: n });
  }

  if (!editable) {
    return <tr>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
      <td style={td}>{item.title || <span style={{ color: T.textMuted, fontStyle: "italic" }}>Без описания</span>}</td>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{item.copies_count ?? "—"}</td>
    </tr>;
  }

  return <tr>
    <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
    <td style={{ ...td, padding: 4 }}>
      <textarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={commitTitle}
        placeholder="Например: Курс физики (Трофимова Т.И., Академия, 2019, 560 с.)"
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center", position: "relative", overflow: "visible" }}>
      <input
        type="number"
        min="0"
        value={copies}
        onChange={e => setCopies(e.target.value)}
        onBlur={commitCopies}
        placeholder="—"
        style={inlineNumber}
      />
      <button onClick={onDelete} title="Удалить запись" style={trashBtn}><TrashIcon /></button>
    </td>
  </tr>;
}


// ─── 6.2 Электронная литература ─────────────────────────────────────────────

function ElectronicTable({ items, editable, onAdd, onDelete, onSave }) {
  return <div>
    {items.length > 0 ? (
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
        <tbody>
          {items.map(item => (
            <ElectronicRow
              key={item.id_literature}
              item={item}
              editable={editable}
              onSave={(patch) => onSave(item, patch)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </tbody>
      </table>
    ) : (
      <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
        Электронных ресурсов нет
      </div>
    )}
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={onAdd}><PlusIcon /> Добавить запись</Btn>
      </div>
    )}
  </div>;
}

function ElectronicRow({ item, editable, onSave, onDelete }) {
  const [title, setTitle] = useState(item.title || "");
  // URL=" " — это sentinel, который backend трактует как «электронная». В инпуте
  // показываем пусто, чтобы пользователь видел чистое поле и не подумал, что
  // у него пробел в URL.
  const [url, setUrl] = useState(((item.url || "").trim() ? item.url : ""));
  useEffect(() => { setTitle(item.title || ""); }, [item.title]);
  useEffect(() => { setUrl(((item.url || "").trim() ? item.url : "")); }, [item.url]);

  function commitTitle() {
    if (title === (item.title || "")) return;
    onSave({ title });
  }
  function commitUrl() {
    // Если поле очистили — кладём sentinel " " (а не "" / null), иначе строка
    // мигрирует из 6.2 в 6.1 (см. discriminator в backend и в верхнем фильтре).
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
      <td style={td}>{item.source_type || <span style={{ color: T.textMuted, fontStyle: "italic" }}>—</span>}</td>
      <td style={td}>{item.title || <span style={{ color: T.textMuted, fontStyle: "italic" }}>Без названия</span>}</td>
      <td style={{ ...td, wordBreak: "break-all" }}>
        {cleanUrl
          ? <a href={cleanUrl} target="_blank" rel="noreferrer" style={{ color: T.accent }}>{cleanUrl}</a>
          : <span style={{ color: T.textMuted, fontStyle: "italic" }}>—</span>}
      </td>
      <td style={td}>{avail.length ? avail.join(", ") : <span style={{ color: T.textMuted, fontStyle: "italic" }}>—</span>}</td>
    </tr>;
  }

  const typeOptions = LITERATURE_TYPES.map(t => ({ value: t, label: t }));

  return <tr>
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
      <textarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={commitTitle}
        placeholder="Например: Информатика. Базовый курс (Денисова Э.В., 2017)"
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
    <td style={{ ...td, padding: 4, position: "relative", overflow: "visible" }}>
      <MultiSelectDropdown
        value={Array.isArray(item.availability) ? item.availability : []}
        options={ELS_OPTIONS}
        onChange={changeAvail}
        placeholder="Выбрать ЭБС"
      />
      <button onClick={onDelete} title="Удалить запись" style={trashBtn}><TrashIcon /></button>
    </td>
  </tr>;
}


// ─── Styles ─────────────────────────────────────────────────────────────────

const inlineTextarea = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F, lineHeight: 1.45,
  background: T.surface,
  resize: "vertical",
  minHeight: 32,
  boxSizing: "border-box",
  outline: "none",
};

const inlineInput = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};

const inlineNumber = {
  width: "100%",
  padding: "4px 2px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
};

const trashBtn = {
  position: "absolute",
  left: "calc(100% + 8px)",
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: 4,
  color: T.textMuted,
  display: "inline-flex",
};
