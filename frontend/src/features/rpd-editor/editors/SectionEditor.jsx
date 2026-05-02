import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { PlanSummary } from "./PlanSummary.jsx";

export function SectionEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;

  async function addEmpty() {
    const next = (rpd.sections?.length || 0) + 1;
    try {
      await api.addSection(rpdId, {
        section_number: next,
        title: "",
        brief_content: "",
        lecture_hours: 0,
        practice_hours: 0,
        lab_hours: 0,
        self_study_hours: 0,
      });
      await reload();
    } catch {}
  }

  // Если у РПД ещё нет ни одного раздела — добавляем одну пустую строку, чтобы
  // пользователь сразу видел, куда печатать. Срабатывает один раз на маунт
  // редактора (после удаления всех строк второго авто-добавления не будет).
  // В печатную форму пустые строки не попадают (фильтр в rpd_template_context).
  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (!editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    if ((rpd.sections || []).length === 0) addEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  function isSectionEmpty(s) {
    return !(s.title || "").trim()
      && !(s.brief_content || "").trim()
      && !s.lecture_hours && !s.practice_hours
      && !s.lab_hours && !s.self_study_hours;
  }

  async function delSec(s) {
    // Пустая строка — удаляем без подтверждения: пользователь её всё равно
    // добавил случайно или передумал, терять нечего.
    if (!isSectionEmpty(s) && !confirm("Удалить раздел?")) return;
    try { await api.deleteSection(s.id_section); await reload(); } catch {}
  }

  async function saveSec(section, patch) {
    try {
      await api.updateSection(section.id_section, {
        section_number: section.section_number,
        title: patch.title ?? section.title ?? "",
        brief_content: patch.brief_content ?? section.brief_content ?? "",
        lecture_hours: patch.lecture_hours ?? section.lecture_hours ?? 0,
        practice_hours: patch.practice_hours ?? section.practice_hours ?? 0,
        lab_hours: patch.lab_hours ?? section.lab_hours ?? 0,
        self_study_hours: patch.self_study_hours ?? section.self_study_hours ?? 0,
      });
      await reload();
    } catch {}
  }

  // Корзина «висит» снаружи таблицы — последняя ячейка со СРС держит её через
  // position:absolute (left: 100% + offset). Сама таблица занимает 100% ширины
  // (как PlanSummary и таблицы разделов 3/6/7), а кнопка выезжает в правый
  // padding карточки редактора (40px справа в RpdEditor.jsx) — там как раз
  // достаточно места и ничего не обрезается.
  return <div>
    <PlanSummary bupDisciplines={rpd.bup_disciplines} sections={rpd.sections} />
      {/* Шапка 1:1 со шаблоном rpd_template.docx (TABLE 6): один логический столбец
           «Наименование разделов с кратким содержанием», группа аудиторных часов
           Л|ЛР|ПЗ и отдельный столбец «Объём внеаудиторных» с подзаголовком СРС. */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>
          <col />
          <col style={{ width: 50 }} />
          <col style={{ width: 50 }} />
          <col style={{ width: 50 }} />
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Наименование разделов дисциплины с кратким содержанием</th>
            <th colSpan={3} style={{ ...th, textAlign: "center" }}>Объём аудиторных занятий по видам в часах</th>
            <th style={{ ...th, textAlign: "center" }}>Объём внеаудиторных занятий по видам в часах</th>
          </tr>
          <tr>
            <th style={{ ...th, textAlign: "center" }}>Л</th>
            <th style={{ ...th, textAlign: "center" }}>ЛР</th>
            <th style={{ ...th, textAlign: "center" }}>ПЗ</th>
            <th style={{ ...th, textAlign: "center" }}>СРС</th>
          </tr>
        </thead>
        <tbody>
          {(rpd.sections || []).map((s, i) => (
            <SectionRow
              key={s.id_section}
              section={s}
              number={i + 1}
              editable={editable}
              onSave={(patch) => saveSec(s, patch)}
              onDelete={() => delSec(s)}
            />
          ))}
          {(!rpd.sections || rpd.sections.length === 0) && (
            <tr>
              <td colSpan={5} style={{ ...td, textAlign: "center", color: T.textMuted, fontStyle: "italic" }}>
                Разделы не добавлены
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && (
        <div style={{ marginTop: 10 }}>
          <Btn small onClick={addEmpty}><PlusIcon /> Добавить раздел</Btn>
        </div>
      )}
  </div>;
}


// ─── Row with inline editing ────────────────────────────────────────────────
//
// Все поля редактируются прямо в ячейках (как в разделе 2 — outcome textarea):
// onChange меняет локальный буфер, onBlur коммитит изменения на бэк, если они
// есть. Кнопка-корзина живёт ВНУТРИ последней ячейки (СРС), но визуально
// плавает справа от таблицы за счёт left:calc(100%+8px) + overflow:visible
// у td. Таблица при этом сохраняет ширину 100% — как у разделов 3/6/7.
function SectionRow({ section, number, editable, onSave, onDelete }) {
  const [local, setLocal] = useState(section);
  useEffect(() => { setLocal(section); }, [section]);

  function patch(k, v) { setLocal(p => ({ ...p, [k]: v })); }
  function commitField(k) {
    const cur = local[k] ?? "";
    const orig = section[k] ?? "";
    if (cur === orig) return;
    onSave({ [k]: cur });
  }
  function commitNum(k) {
    const cur = +local[k] || 0;
    const orig = +section[k] || 0;
    if (cur === orig) return;
    onSave({ [k]: cur });
  }

  if (!editable) {
    return <tr>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{number}. {section.title || <span style={{ color: T.textMuted, fontStyle: "italic" }}>Без названия</span>}</div>
        {section.brief_content && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{section.brief_content}</div>
        )}
      </td>
      <td style={cellNum}>{section.lecture_hours}</td>
      <td style={cellNum}>{section.lab_hours}</td>
      <td style={cellNum}>{section.practice_hours}</td>
      <td style={cellNum}>{section.self_study_hours}</td>
    </tr>;
  }

  return <tr>
    <td style={{ ...td, padding: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontWeight: 700, color: T.textMuted, flexShrink: 0, minWidth: 18 }}>{number}.</span>
        <input
          value={local.title || ""}
          onChange={e => patch("title", e.target.value)}
          onBlur={() => commitField("title")}
          placeholder="Название раздела"
          style={inlineInput}
        />
      </div>
      <textarea
        value={local.brief_content || ""}
        onChange={e => patch("brief_content", e.target.value)}
        onBlur={() => commitField("brief_content")}
        placeholder="Краткое содержание (необязательно)"
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.lecture_hours} onChange={v => patch("lecture_hours", v)} onBlur={() => commitNum("lecture_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.lab_hours} onChange={v => patch("lab_hours", v)} onBlur={() => commitNum("lab_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.practice_hours} onChange={v => patch("practice_hours", v)} onBlur={() => commitNum("practice_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center", position: "relative", overflow: "visible" }}>
      <HourInput value={local.self_study_hours} onChange={v => patch("self_study_hours", v)} onBlur={() => commitNum("self_study_hours")} />
      <button
        onClick={onDelete}
        title="Удалить раздел"
        style={trashBtn}
      ><TrashIcon /></button>
    </td>
  </tr>;
}

function HourInput({ value, onChange, onBlur }) {
  return <input
    type="number"
    min="0"
    value={value ?? 0}
    onChange={e => onChange(e.target.value === "" ? 0 : +e.target.value)}
    onBlur={onBlur}
    style={hourInput}
  />;
}


// ─── Styles ─────────────────────────────────────────────────────────────────

const cellNum = { ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" };

const inlineInput = {
  flex: 1, minWidth: 0,
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontWeight: 600, fontFamily: F,
  background: T.surface,
  outline: "none",
};

const inlineTextarea = {
  width: "100%",
  marginTop: 4,
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 11, fontFamily: F, lineHeight: 1.45,
  color: T.textMuted,
  background: T.surface,
  resize: "vertical",
  minHeight: 28,
  boxSizing: "border-box",
  outline: "none",
};

const hourInput = {
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

// Корзина живёт «снаружи» таблицы — left:calc(100% + 8px) выводит её правее
// правой границы СРС-ячейки, в зарезервированный paddingRight обёртки.
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
