import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { MultiSelectDropdown } from "../../../components/MultiSelectDropdown.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
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
      // У печатной по умолчанию «0 экземпляров», а не null/прочерк. Чаще всего
      // именно 0 и есть стартовое значение, а ставить «—» при добавлении и
      // потом править — лишний шаг.
      : { source_type, title: "", copies_count: 0 };
    try { await api.addLiterature(rpdId, payload); await reload(); } catch {}
  }

  async function delRow(item) {
    // Пустую строку — без подтверждения. Считаем «пустой», когда пользователь
    // не ввёл ни одного поля и ничего не выбрал из выпадашек. Sentinel URL=" "
    // у новой 6.2-строки после .trim() становится пустым. copies_count=0 —
    // тоже считается пустым (это дефолт, выставленный кнопкой «+»).
    const filled = isElectronic
      ? ((item.title || "").trim() || (item.url || "").trim()
         || (item.source_type || "").trim() || (item.availability?.length > 0))
      : ((item.title || "").trim() || (item.copies_count != null && item.copies_count !== 0));
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

// Структура печатной литературы 1:1 с типовой формой РПД ПНИПУ:
// 1. Основная литература (одна группа «Учебные и научные»)
// 2. Дополнительная литература — три подгруппы 2.1 / 2.2 / 2.3
// 3. Методические указания для студентов
// 4. Учебно-методическое обеспечение СРС
//
// 2.1 «Учебные и научные» — отдельная подгруппа, отличается от 1-й только
// контекстом (вспомогательная литература). Чтобы записи не путались, у них
// отдельный source_type — «Учебные и научные издания (дополнительные)».
// Бэкенд знает этот тип через PRINTED_BUCKETS и кладёт в bucket
// `additional_study`.
const ADDITIONAL_MAIN_TYPE = "Учебные и научные издания (дополнительные)";
const PRINTED_SECTIONS = [
  {
    title: "1. Основная литература",
    groups: [{ source_type: "Учебные и научные издания" }],
  },
  {
    title: "2. Дополнительная литература",
    groups: [
      { subtitle: "2.1. Учебные и научные издания", source_type: ADDITIONAL_MAIN_TYPE },
      { subtitle: "2.2. Периодические издания", source_type: "Периодические издания" },
      { subtitle: "2.3. Нормативно-технические издания", source_type: "Нормативно-технические издания" },
    ],
  },
  {
    title: "3. Методические указания для студентов по освоению дисциплины",
    groups: [{ source_type: "Методические указания для студентов по освоению дисциплины" }],
  },
  {
    title: "4. Учебно-методическое обеспечение самостоятельной работы студента",
    groups: [{ source_type: "Учебно-методическое обеспечение самостоятельной работы студента" }],
  },
];

// Все source_type, известные печатной форме (плоский список — для проверки и
// fallback'a при бакетировании items).
const PRINTED_TYPES = PRINTED_SECTIONS.flatMap(s => s.groups.map(g => g.source_type));

function PrintedTable({ items, editable, onAdd, onDelete, onSave }) {
  // Несовпавшие по виду (legacy/неизвестные source_type) — кладём в основную,
  // как делает backend (PRINTED_BUCKETS fallback на main).
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
      onAdd={onAdd}
      onDelete={onDelete}
      onSave={onSave}
    />;
  }

  return <div>
    {PRINTED_SECTIONS.map(section => (
      <div key={section.title} style={{ marginBottom: 22 }}>
        {/* Заголовок-секция (1 / 2 / 3 / 4) — крупнее и с разделительной чертой,
            чтобы на глаз отделять «Основную» от «Дополнительной» и т.д. */}
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid " + T.borderLight }}>
          {section.title}
        </div>
        {section.groups.map(renderGroup)}
      </div>
    ))}
  </div>;
}

function PrintedGroup({ g, rows, editable, onAdd, onDelete, onSave }) {
  const tbodyRef = useRef(null);
  function delById(id) {
    const item = rows.find(it => String(it.id_literature) === String(id));
    if (item) onDelete(item);
  }
  return <div style={{ marginBottom: 16 }}>
    {g.subtitle && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{g.subtitle}</div>}
    {rows.length > 0 ? (
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
  </div>;
}

function PrintedRow({ item, index, editable, onSave }) {
  const [title, setTitle] = useState(item.title || "");
  // copies всегда число: при стирании value сразу становится 0, как у
  // HourInput в SectionEditor (раздел 4). Так пользователь не может оставить
  // ячейку пустой / получить серый placeholder — минимум всегда 0.
  const [copies, setCopies] = useState(item.copies_count ?? 0);
  // Защита от «отката» свежего ввода: пока пользователь правит ячейку, у этой
  // строки может прилететь reload (например, blur на title в этой же строке
  // или редактирование соседней). useEffect раньше безусловно перезатирал
  // буфер значением с сервера — клик по спиннеру copies показывал «4», и через
  // миг откатывал к «3». Сравниваем с предыдущим серверным значением: если
  // local буфер уже отличается, не трогаем его — пусть live-ввод проживёт до
  // своего blur'а.
  const titleRef = useRef(item.title || "");
  const copiesRef = useRef(item.copies_count ?? 0);
  useEffect(() => {
    const next = item.title || "";
    if (title === titleRef.current) setTitle(next);
    titleRef.current = next;
  }, [item.title]);
  useEffect(() => {
    const next = item.copies_count ?? 0;
    if (copies === copiesRef.current) setCopies(next);
    copiesRef.current = next;
  }, [item.copies_count]);

  function commitTitle() {
    if (title === (item.title || "")) return;
    onSave({ title });
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

  return <tr data-trash-row data-trash-id={item.id_literature}>
    <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
    <td style={{ ...td, padding: 4 }}>
      <ExpandableTextarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={commitTitle}
        placeholder="Например: Курс физики (Трофимова Т.И., Академия, 2019, 560 с.)"
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


// ─── 6.2 Электронная литература ─────────────────────────────────────────────

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
  const [title, setTitle] = useState(item.title || "");
  // URL=" " — это sentinel, который backend трактует как «электронная». В инпуте
  // показываем пусто, чтобы пользователь видел чистое поле и не подумал, что
  // у него пробел в URL.
  const [url, setUrl] = useState(((item.url || "").trim() ? item.url : ""));
  // см. PrintedRow — защита от «отката» свежего ввода при reload во время редактирования.
  const titleRef = useRef(item.title || "");
  const urlRef = useRef((item.url || "").trim() ? item.url : "");
  useEffect(() => {
    const next = item.title || "";
    if (title === titleRef.current) setTitle(next);
    titleRef.current = next;
  }, [item.title]);
  useEffect(() => {
    const next = (item.url || "").trim() ? item.url : "";
    if (url === urlRef.current) setUrl(next);
    urlRef.current = next;
  }, [item.url]);

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

  // В 6.2 выпадашка не должна показывать «(дополнительные)» — этот тип нужен
  // только для разделения 1-й и 2.1 групп в печатной 6.1; для электронной
  // литературы (6.2) это бессмыслица.
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
      <ExpandableTextarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={commitTitle}
        placeholder="Например: Информатика. Базовый курс (Денисова Э.В., 2017)"
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


// ─── Styles ─────────────────────────────────────────────────────────────────

const inlineTextarea = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F, lineHeight: 1.45,
  background: T.surface,
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

// `field-sizing: content` — ширина инпута следует за длиной цифры, чтобы
// auto-layout колонки не схлопывал её в 0.
const inlineNumber = {
  width: "auto",
  fieldSizing: "content",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
};

