import { LITERATURE_TYPES, ELECTRONIC_LITERATURE_TYPES, SOFTWARE_TYPES } from "../features/rpd-editor/catalogs.js";
import { T, F, adminAddLabel, inputBase } from "../styles/index.js";

export const miniLabel = adminAddLabel;
export const miniInput = { width: "100%", padding: "6px 10px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, background: T.surface, fontFamily: F, boxSizing: "border-box" };
export const inputStyle = inputBase;

export const KIND_GROUPS = [
  {
    label: "Общие",
    title: "Общие справочники",
    kinds: [
      { id: "discipline", label: "Дисциплины", valueLabel: "Название" },
      { id: "bup", label: "БУПы" },
      { id: "direction", label: "Направления" },
      { id: "fos", label: "Файлы ФОС" },
    ],
  },
  {
    label: "Пользователи",
    title: "Справочники пользователей",
    kinds: [
      { id: "faculty", label: "Факультеты", valueLabel: "Факультет" },
      { id: "employee_title", label: "Должности", valueLabel: "Должность" },
      { id: "department", label: "Подразделения" },
    ],
  },
  {
    label: "Раздел 2",
    title: "Раздел 2 — Планируемые результаты обучения",
    kinds: [
      { id: "competency_code", label: "Компетенции (коды)", valueLabel: "Код" },
      { id: "indicator_code", label: "Индикаторы (коды)" },
      { id: "indicator_description", label: "Индикаторы достижения", valueLabel: "Описание" },
      { id: "assessment_tool", label: "Средства оценки", valueLabel: "Средство оценки" },
    ],
  },
  {
    label: "Раздел 6",
    title: "Раздел 6 — Литература, ПО, базы данных",
    kinds: [
      { id: "literature_title", label: "Литература", valueLabel: "Источник" },
      { id: "software_name", label: "ПО", valueLabel: "Программное обеспечение" },
      { id: "database_name", label: "БД и ИСС", valueLabel: "База данных / ИСС" },
    ],
  },
  {
    label: "Раздел 7",
    title: "Раздел 7 — Материально-техническое обеспечение",
    kinds: [
      { id: "room_type", label: "Виды занятий (МТО)", valueLabel: "Вид занятий" },
      { id: "equipment", label: "Оборудование", valueLabel: "Оборудование" },
    ],
  },
];

export const KINDS = KIND_GROUPS.flatMap(g => g.kinds);

export function adaptDiscipline(d) {
  return {
    id_entry: d.id_discipline,
    kind: "discipline",
    value: d.name,
    source_type: null,
    mode: null,
    source: "manual",
    used_in_bups: d.used_in_bups || 0,
    used_in_rpds: d.used_in_rpds || 0,
  };
}

export const PARENT_LABELS = {
  indicator_code: { col: "Компетенция", input: "Код компетенции", placeholder: "напр. ОК-1" },
  indicator_description: { col: "Индикатор", input: "Код индикатора", placeholder: "напр. ИД-1ОК-1" },
};

export const FILTERABLE_KINDS = new Set(["indicator_code", "indicator_description"]);
export const INDICATOR_KINDS = new Set(["indicator_code", "indicator_description"]);

export const INDEX_OPTIONS = [
  { value: "1", label: "1 — Знает" },
  { value: "2", label: "2 — Умеет" },
  { value: "3", label: "3 — Владеет" },
];

export function parseIndicatorCode(code) {
  const m = (code || "").match(/^ИД-(\d+)([А-ЯЁа-яё]+)(.*)$/);
  if (!m) return { index: 9999, competency: code || "", prefix: "" };
  return {
    index: parseInt(m[1], 10) || 0,
    competency: m[2] + (m[3] || ""),
    prefix: m[2],
  };
}
export function parseCompetencyCode(code) {
  const m = (code || "").match(/^([А-ЯЁа-яё]+)/);
  return { prefix: m ? m[1] : "" };
}
export function buildIndicatorCode(competency, index) {
  return `ИД-${index}${competency}`;
}

export const MODE_LABELS = { printed: "Печатная", electronic: "Электронная" };
export const MODE_OPTIONS = [
  { value: "printed", label: "Печатная" },
  { value: "electronic", label: "Электронная" },
];
const LIT_TYPE_OPTIONS_PRINTED = LITERATURE_TYPES.map(t => ({ value: t, label: t }));
const LIT_TYPE_OPTIONS_ELECTRONIC = ELECTRONIC_LITERATURE_TYPES.map(t => ({ value: t, label: t }));
export const litTypeOptions = (mode) => (mode === "electronic" ? LIT_TYPE_OPTIONS_ELECTRONIC : LIT_TYPE_OPTIONS_PRINTED);
export const SOFTWARE_TYPE_OPTIONS = SOFTWARE_TYPES.map(t => ({ value: t, label: t }));

const SOURCE_LABELS = {
  manual: "Вручную",
  bup: "Из БУПа",
  approved_rpd: "Из согласованной РПД",
  seed: "Предзагружено",
};
export function sourceLabel(s) {
  return SOURCE_LABELS[s] || "Вручную";
}

export const DICT_ACCESSORS = {
  value: it => it.value || "",
  sourceType: it => it.source_type || "",
  mode: it => it.mode || "",
  source: it => sourceLabel(it.source),
  usage: it => (it.used_in_bups || 0) + (it.used_in_rpds || 0),
};

export const DOC_ACCESSORS = {
  filename: d => d.filename || "",
  type: d => d.file_type || "",
  size: d => d.file_size || 0,
  uploaded: d => d.uploaded_at || "",
};
