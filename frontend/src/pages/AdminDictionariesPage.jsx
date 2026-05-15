import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell, iconBtn } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { TrashIcon, PlusIcon, PencilIcon, UploadIcon } from "../components/icons.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { useSort, SortTh } from "../components/sortable.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";
import { LITERATURE_TYPES } from "../features/rpd-editor/catalogs.js";
import { BupsContent } from "./AdminBupsPage.jsx";
import { DirectionsContent } from "./AdminDirectionsPage.jsx";
import { DepartmentsContent } from "./AdminDepartmentsPage.jsx";

const KIND_GROUPS = [
  {
    label: "Общие",
    title: "Общие справочники",
    kinds: [
      { id: "discipline", label: "Дисциплины", valueLabel: "Название" },
      { id: "bup", label: "БУПы" },
      { id: "direction", label: "Направления" },
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
      { id: "software_purpose", label: "Назначение ПО", valueLabel: "Назначение" },
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
  {
    label: "LLM",
    title: "LLM — промпты и контекст",
    kinds: [
      { id: "llm_prompt", label: "Промпты по разделам" },
      { id: "document", label: "Документы для LLM" },
    ],
  },
];

const KINDS = KIND_GROUPS.flatMap(g => g.kinds);

function adaptDiscipline(d) {
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

const PARENT_LABELS = {
  indicator_code: { col: "Компетенция", input: "Код компетенции", placeholder: "напр. ОК-1" },
  indicator_description: { col: "Индикатор", input: "Код индикатора", placeholder: "напр. ИД-1ОК-1" },
};

const FILTERABLE_KINDS = new Set(["indicator_code", "indicator_description"]);
const INDICATOR_KINDS = new Set(["indicator_code", "indicator_description"]);

const INDEX_OPTIONS = [
  { value: "1", label: "1 — Знает" },
  { value: "2", label: "2 — Умеет" },
  { value: "3", label: "3 — Владеет" },
];

function parseIndicatorCode(code) {
  const m = (code || "").match(/^ИД-(\d+)([А-ЯЁа-яё]+)(.*)$/);
  if (!m) return { index: 9999, competency: code || "", prefix: "" };
  return {
    index: parseInt(m[1], 10) || 0,
    competency: m[2] + (m[3] || ""),
    prefix: m[2],
  };
}
function parseCompetencyCode(code) {
  const m = (code || "").match(/^([А-ЯЁа-яё]+)/);
  return { prefix: m ? m[1] : "" };
}
function buildIndicatorCode(competency, index) {
  return `ИД-${index}${competency}`;
}

const MODE_LABELS = { printed: "Печатная", electronic: "Электронная" };
const MODE_OPTIONS = [
  { value: "printed", label: "Печатная" },
  { value: "electronic", label: "Электронная" },
];
const LIT_TYPE_OPTIONS = LITERATURE_TYPES.map(t => ({ value: t, label: t }));

const SOURCE_LABELS = {
  manual: "Вручную",
  bup: "Из БУПа",
  approved_rpd: "Из согласованной РПД",
  seed: "Предзагружено",
};
function sourceLabel(s) {
  return SOURCE_LABELS[s] || "Вручную";
}

const DICT_ACCESSORS = {
  value: it => it.value || "",
  sourceType: it => it.source_type || "",
  mode: it => it.mode || "",
  source: it => sourceLabel(it.source),
  usage: it => (it.used_in_bups || 0) + (it.used_in_rpds || 0),
};

const DOC_ACCESSORS = {
  filename: d => d.filename || "",
  type: d => d.file_type || "",
  size: d => d.file_size || 0,
  uploaded: d => d.uploaded_at || "",
};

export function AdminDictionariesPage() {
  const [kind, setKind] = useState(KINDS[0].id);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [newValue, setNewValue] = useState("");
  const [newSourceType, setNewSourceType] = useState("");
  const [newMode, setNewMode] = useState("");
  const [newCompetency, setNewCompetency] = useState("");
  const [newIndex, setNewIndex] = useState("1");
  const [adding, setAdding] = useState(false);
  const [prefixFilter, setPrefixFilter] = useState("all");

  const [competencyOptions, setCompetencyOptions] = useState([]);

  const isLiterature = kind === "literature_title";
  const isIndicatorKind = INDICATOR_KINDS.has(kind);
  const isDiscipline = kind === "discipline";
  const isCustomKind = kind === "bup" || kind === "direction" || kind === "document" || kind === "department" || kind === "llm_prompt";
  const activeGroupIdx = Math.max(0, KIND_GROUPS.findIndex(g => g.kinds.some(k => k.id === kind)));
  const parentMeta = PARENT_LABELS[kind] || null;
  const useGroupedView = !!parentMeta;
  const showPrefixFilter = FILTERABLE_KINDS.has(kind);

  const fetchItems = () => isDiscipline
    ? api.adminListDisciplines().then(r => (r.data || []).map(adaptDiscipline))
    : api.adminListDictionary(kind, {}).then(r => r.data || []);

  const silentRefresh = () => {
    if (isCustomKind) return;
    fetchItems().then(setItems).catch(() => {});
  };
  const reload = silentRefresh;
  useEffect(() => {
    if (isCustomKind) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setItems([]);
    fetchItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    if (!isIndicatorKind) return;
    api.adminListDictionary("competency_code", {}).then(r => {
      const opts = [...new Set((r.data || []).map(it => it.value))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" }));
      setCompetencyOptions(opts);
    }).catch(() => setCompetencyOptions([]));
  }, [isIndicatorKind, kind]);

  useEffect(() => {
    setSearch("");
    setNewValue("");
    setNewSourceType("");
    setNewMode("");
    setNewCompetency("");
    setNewIndex("1");
    setPrefixFilter("all");
  }, [kind]);

  const prefixOf = (it) => {
    if (kind === "indicator_code") return parseCompetencyCode(it.source_type || "").prefix;
    if (kind === "indicator_description") return parseIndicatorCode(it.source_type || "").prefix;
    return "";
  };

  const prefixCounts = useMemo(() => {
    if (!showPrefixFilter) return null;
    const counts = new Map();
    let total = 0;
    for (const it of items) {
      total += 1;
      const p = prefixOf(it);
      if (!p) continue;
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    const list = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
    return { all: total, list };
  }, [items, showPrefixFilter, kind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (q) {
        const matches = (it.value || "").toLowerCase().includes(q)
          || (it.source_type || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (showPrefixFilter && prefixFilter !== "all" && prefixOf(it) !== prefixFilter) return false;
      return true;
    });
  }, [items, search, showPrefixFilter, prefixFilter, kind]);

  const { sort, toggleSort, sortItems } = useSort("value", "asc");
  const sortedRows = useMemo(
    () => sortItems(filtered, DICT_ACCESSORS),
    [filtered, sort]
  );

  const allGroups = useMemo(() => {
    if (!useGroupedView) return null;
    const buckets = new Map();
    for (const it of filtered) {
      const key = (it.source_type || "").trim() || "—";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(it);
    }
    const parentSortKey = (parent) => {
      if (parent === "—") return [Infinity, "", Infinity];
      if (kind === "indicator_description") {
        const p = parseIndicatorCode(parent);
        return [0, p.competency.toLowerCase(), p.index];
      }
      return [0, parent.toLowerCase(), 0];
    };
    const order = [...buckets.keys()].sort((a, b) => {
      const ka = parentSortKey(a), kb = parentSortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      const cmp = ka[1].localeCompare(kb[1], "ru", { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return ka[2] - kb[2];
    });
    return order.map(k => ({
      parent: k,
      rows: [...buckets.get(k)].sort(
        (a, b) => parseIndicatorCode(a.value).index - parseIndicatorCode(b.value).index
      ),
    }));
  }, [filtered, useGroupedView, kind]);

  const paginationSource = useGroupedView ? allGroups : sortedRows;
  const { page, setPage, pageSize, setPageSize, total: pgTotal, totalPages: pgTotalPages, pageItems } = usePagination(paginationSource, { defaultPageSize: 50, storageKey: `adminDict.${kind}.pageSize` });

  async function performDelete(item) {
    if (!item) return;
    try {
      if (item.kind === "discipline") {
        await api.adminDeleteDiscipline(item.id_entry);
      } else {
        await api.adminDeleteDictionary(item.id_entry);
      }
      reload();
    }
    catch (e) { setErrorMsg("Не удалось удалить: " + (e?.response?.data?.detail || e.message)); }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      if (isDiscipline) {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните название");
        await api.adminCreateDiscipline({ name: v });
        setNewValue("");
        reload();
        return;
      }
      let payload;
      if (kind === "indicator_code") {
        const comp = newCompetency.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        const code = buildIndicatorCode(comp, newIndex);
        payload = { value: code, source_type: comp };
      } else if (kind === "indicator_description") {
        const comp = newCompetency.trim();
        const desc = newValue.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        if (!desc) throw new Error("Заполните описание");
        payload = { value: desc, source_type: buildIndicatorCode(comp, newIndex) };
      } else if (isLiterature) {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните значение");
        if (!newSourceType) throw new Error("Выберите подраздел");
        if (!newMode) throw new Error("Выберите тип");
        payload = { value: v, source_type: newSourceType, mode: newMode };
      } else {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните значение");
        payload = { value: v };
      }
      await api.adminCreateDictionary(kind, payload);
      setNewValue("");
      if (kind === "indicator_code") setNewCompetency("");
      reload();
    } catch (e) {
      setErrorMsg("Не удалось добавить: " + (e?.response?.data?.detail || e.message));
    }
    setAdding(false);
  }

  const canAdd = kind === "indicator_code"
    ? !!newCompetency.trim()
    : kind === "indicator_description"
      ? !!newCompetency.trim() && !!newValue.trim()
      : isLiterature
        ? !!newValue.trim() && !!newSourceType && !!newMode
        : !!newValue.trim();

  const kindHint = kind === "bup" ? "Загруженные XLS-БУПы. При импорте дисциплины, компетенции и индикаторы попадают в справочники автоматически."
    : kind === "direction" ? "Направления подготовки: код, название, профиль и файл ФГОС. Базовые федеральные коды засидированы, остальное подтягивается при импорте БУПов. Отсюда же берутся подсказки кода/названия/профиля при создании РПД вручную."
    : kind === "document" ? "Документы, которые передаются LLM как контекст при генерации разделов РПД. Загруженные здесь файлы используются глобально для всех РПД."
    : kind === "department" ? "Кафедры, отделы и управления, к которым привязаны пользователи системы."
    : kind === "llm_prompt" ? "Шаблоны промптов, по которым LLM генерирует содержание разделов РПД. В шаблоне доступны плейсхолдеры: {discipline}, {direction}, {profile}, {total_hours}, {lecture_hours}, {practice_hours}, {lab_hours}, {self_study_hours}. Если system_prompt пуст — используется общий системный промпт."
    : isDiscipline ? "Перечень всех дисциплин, доступных для создания РПД вручную. Пополняется автоматически при импорте БУПов; при удалении БУПа дисциплины из справочника не удаляются."
    : "Записи отсюда подсказываются преподавателям при заполнении РПД. Автоматически дополняются после согласования каждой РПД.";

  return <div style={{ flex: 1, overflow: "auto", scrollbarGutter: "stable", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{kindHint}</div>

      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={groupLabelStyle}>Раздел</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {KIND_GROUPS.map((g, gi) => {
              const active = gi === activeGroupIdx;
              return <button key={gi} type="button" title={g.title}
                onClick={() => { if (!active) setKind(g.kinds[0].id); }}
                style={{
                  padding: "5px 12px",
                  border: "1px solid " + (active ? T.accent : T.border),
                  borderRadius: 5,
                  background: active ? T.accent : T.bg,
                  color: active ? "#fff" : T.text,
                  fontWeight: active ? 600 : 500,
                  fontSize: 12, fontFamily: F,
                  cursor: "pointer",
                }}>{g.label}</button>;
            })}
          </div>
        </div>
        <div style={{ height: 1, background: T.borderLight, margin: "0 -10px 8px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={groupLabelStyle}>Справочник</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {KIND_GROUPS[activeGroupIdx].kinds.map(k => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)}
                style={{
                  padding: "5px 12px",
                  border: "1px solid " + (kind === k.id ? T.accent : T.border),
                  borderRadius: 5,
                  background: kind === k.id ? T.accentLight : T.bg,
                  color: kind === k.id ? T.accent : T.text,
                  fontWeight: kind === k.id ? 600 : 500,
                  fontSize: 12, fontFamily: F,
                  cursor: "pointer",
                }}>{k.label}</button>
            ))}
          </div>
        </div>
      </div>

      {kind === "bup" && <BupsContent />}
      {kind === "direction" && <DirectionsContent />}
      {kind === "document" && <DocumentsContent />}
      {kind === "department" && <DepartmentsContent />}
      {kind === "llm_prompt" && <LlmPromptsContent />}

      {!isCustomKind && <>
      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
          Добавить запись
        </div>

        {isLiterature && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "1 1 320px", minWidth: 240 }}>
              <div style={miniLabel}>Подраздел <span style={{ color: T.red }}>*</span></div>
              <Dropdown value={newSourceType} options={LIT_TYPE_OPTIONS}
                onChange={setNewSourceType}
                placeholder="— не указано —" clearLabel="— не указано —" />
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div style={miniLabel}>Тип <span style={{ color: T.red }}>*</span></div>
              <Dropdown value={newMode} options={MODE_OPTIONS}
                onChange={setNewMode} placeholder="— не указано —" clearLabel="— не указано —" />
            </div>
          </div>
        )}

        {isIndicatorKind && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div style={miniLabel}>Компетенция <span style={{ color: T.red }}>*</span></div>
              {competencyOptions.length === 0
                ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>
                    Сначала добавьте компетенции во вкладке «Компетенции (коды)».
                  </div>
                : <Dropdown
                    value={newCompetency}
                    options={competencyOptions.map(c => ({ value: c, label: c }))}
                    onChange={setNewCompetency}
                    placeholder="— не указано —"
                    clearLabel="— не указано —"
                  />}
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div style={miniLabel}>Индекс</div>
              <Dropdown value={newIndex} options={INDEX_OPTIONS} onChange={setNewIndex} />
            </div>
            {kind === "indicator_code" && (
              <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                <div style={miniLabel}>Получится</div>
                <div style={{
                  ...miniInput,
                  fontWeight: 600,
                  color: newCompetency ? T.accent : T.textMuted,
                  background: newCompetency ? T.accentLight : T.bg,
                  border: "1px solid " + (newCompetency ? T.accent : T.borderLight),
                  fontStyle: newCompetency ? "normal" : "italic",
                }}>
                  {newCompetency ? buildIndicatorCode(newCompetency, newIndex) : "выберите компетенцию"}
                </div>
              </div>
            )}
          </div>
        )}

        {kind === "indicator_code" ? (
          <div style={{ color: T.textMuted, fontSize: 12, fontStyle: "italic", padding: "6px 0" }}>
            Код индикатора собирается автоматически из выбранной компетенции и индекса.
          </div>
        ) : (
          <div>
            <div style={miniLabel}>
              {KINDS.find(k => k.id === kind)?.valueLabel || "Значение"} <span style={{ color: T.red }}>*</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              {kind === "indicator_description" ? (
                <textarea
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder={'Например: "Знает методы…"'}
                  style={{ flex: 1, padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, outline: "none", minHeight: 60, resize: "vertical" }}
                />
              ) : (
                <input
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="Введите значение…"
                  style={{ flex: 1, padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, outline: "none" }}
                />
              )}
              <Btn small primary onClick={handleAdd} disabled={adding || !canAdd}>
                <PlusIcon /> Добавить
              </Btn>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по значению…"
          style={{
            flex: 1, minWidth: 220, maxWidth: 360,
            padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4,
            fontSize: 13, fontFamily: F, outline: "none",
          }}
        />
        {showPrefixFilter && prefixCounts && prefixCounts.list.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <FilterChip label="Все" count={prefixCounts.all} active={prefixFilter === "all"}
              onClick={() => setPrefixFilter("all")} />
            {prefixCounts.list.map(([p, count]) => (
              <FilterChip key={p} label={p} count={count}
                active={prefixFilter === p}
                onClick={() => setPrefixFilter(prev => prev === p ? "all" : p)} />
            ))}
          </div>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
          {filtered.length} {filtered.length === items.length ? "" : `из ${items.length}`}
        </span>
      </div>

      <div className="table-scroll">
        {loading
          ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
          : filtered.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
                {items.length === 0 ? "Записей пока нет — добавьте первую сверху." : "Ничего не нашлось."}
              </div>
            : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F, tableLayout: "fixed" }}>
              <thead><tr style={{ background: T.surface }}>
                {useGroupedView ? <>
                  <th style={{ ...hdr, width: 180 }}>{parentMeta.col}</th>
                  <th style={hdr}>Значение</th>
                  <th style={{ ...hdr, width: 200 }}>Источник</th>
                  <th style={{ ...hdr, textAlign: "center", width: 80 }} />
                </> : <>
                  {isLiterature && <SortTh sortKey="sourceType" sort={sort} onSort={toggleSort} style={{ width: 240 }}>Подраздел</SortTh>}
                  <SortTh sortKey="value" sort={sort} onSort={toggleSort}>{isDiscipline ? "Название дисциплины" : "Значение"}</SortTh>
                  {isLiterature && <SortTh sortKey="mode" sort={sort} onSort={toggleSort} style={{ width: 130 }}>Тип</SortTh>}
                  <SortTh sortKey={isDiscipline ? "usage" : "source"} sort={sort} onSort={toggleSort} style={{ width: 200 }}>{isDiscipline ? "Использование" : "Источник"}</SortTh>
                  <th style={{ ...hdr, textAlign: "center", width: 80 }} />
                </>}
              </tr></thead>
              <tbody>
                {useGroupedView
                  ? pageItems.flatMap(g => g.rows.map((it, i) => (
                    <tr key={it.id_entry}
                        onDoubleClick={() => setEditing(it)}
                        style={{ background: T.surface, borderTop: i === 0 ? "2px solid " + T.borderLight : "none", cursor: "pointer" }}
                        title="Двойной клик — редактировать">
                      {i === 0 && (
                        <td rowSpan={g.rows.length}
                          style={{ ...tcell, fontWeight: 700, color: g.parent === "—" ? T.textMuted : T.text, fontStyle: g.parent === "—" ? "italic" : "normal", whiteSpace: "nowrap", verticalAlign: "middle", textAlign: "center", borderRight: "1px solid " + T.borderLight, background: T.surface }}>
                          {g.parent}
                        </td>
                      )}
                      <td style={{ ...tcell, fontWeight: 500 }}>{it.value}</td>
                      <td style={{ ...tcell, fontSize: 11, color: T.textMuted }}>
                        {sourceLabel(it.source)}
                      </td>
                      <td style={{ ...tcell, textAlign: "center", padding: "8px 4px", whiteSpace: "nowrap" }} onDoubleClick={e => e.stopPropagation()}>
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setPendingDelete(it)} />
                      </td>
                    </tr>
                  )))
                  : pageItems.map(it => (
                    <tr key={it.id_entry}
                        onDoubleClick={() => setEditing(it)}
                        style={{ background: T.surface, cursor: "pointer" }}
                        title="Двойной клик — редактировать">
                      {isLiterature && <td style={{ ...tcell, color: it.source_type ? T.text : T.textMuted, fontStyle: it.source_type ? "normal" : "italic" }}>{it.source_type || "—"}</td>}
                      <td style={{ ...tcell, fontWeight: 500 }}>{it.value}</td>
                      {isLiterature && <td style={{ ...tcell, color: it.mode ? T.text : T.textMuted, fontStyle: it.mode ? "normal" : "italic" }}>{it.mode ? MODE_LABELS[it.mode] || it.mode : "—"}</td>}
                      <td style={{ ...tcell, fontSize: 11, color: T.textMuted }}>
                        {isDiscipline
                          ? <UsageInfo bups={it.used_in_bups} rpds={it.used_in_rpds} />
                          : sourceLabel(it.source)}
                      </td>
                      <td style={{ ...tcell, textAlign: "center", padding: "8px 4px", whiteSpace: "nowrap" }} onDoubleClick={e => e.stopPropagation()}>
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setPendingDelete(it)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>}
      </div>
      {!loading && (
        <Pagination page={page} totalPages={pgTotalPages} total={pgTotal} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
      </>}
    </div>

    {pendingDelete && <ConfirmDeleteModal
      title={pendingDelete.kind === "discipline" ? "Удалить дисциплину из справочника?" : "Удалить запись из справочника?"}
      message={pendingDelete.kind === "discipline"
        ? `«${pendingDelete.value}» больше не будет доступна для создания РПД вручную. Удаление возможно только если дисциплина не используется ни в одном БУПе и ни в одной РПД.`
        : `«${pendingDelete.value}» больше не будет предлагаться при заполнении РПД. На уже сохранённые РПД это не повлияет.`}
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const it = pendingDelete; setPendingDelete(null); await performDelete(it); }}
    />}
    {editing && <DictEditModal
      entry={editing}
      competencyOptions={competencyOptions}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); reload(); }}
      onError={msg => setErrorMsg(msg)}
      onDelete={() => { setPendingDelete(editing); setEditing(null); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

function UsageInfo({ bups, rpds }) {
  if (!bups && !rpds) {
    return <span style={{ fontStyle: "italic" }}>Не используется</span>;
  }
  const parts = [];
  if (bups) parts.push(`${bups} БУП${bups === 1 ? "" : "ов"}`);
  if (rpds) parts.push(`${rpds} РПД`);
  return <span>{parts.join(" · ")}</span>;
}

function DocumentsContent() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [sectionsCache, setSectionsCache] = useState({});
  const [loadingSections, setLoadingSections] = useState(() => new Set());
  const [reparsingId, setReparsingId] = useState(null);
  const fileRef = useRef(null);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListGlobalDocuments().then(r => setDocs(r.data || [])).catch(() => { if (!silent) setDocs([]); }).finally(() => { if (!silent) setLoading(false); });
  };
  const reload = () => fetchAll(true);
  useEffect(() => { fetchAll(false); }, []);

  async function loadSections(docId) {
    setLoadingSections(prev => { const n = new Set(prev); n.add(docId); return n; });
    try {
      const r = await api.adminListDocumentSections(docId);
      setSectionsCache(prev => ({ ...prev, [docId]: r.data || [] }));
    } catch {
      setSectionsCache(prev => ({ ...prev, [docId]: [] }));
    } finally {
      setLoadingSections(prev => { const n = new Set(prev); n.delete(docId); return n; });
    }
  }

  function toggleExpand(docId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
        if (sectionsCache[docId] === undefined) loadSections(docId);
      }
      return next;
    });
  }

  async function reparse(docId) {
    setReparsingId(docId);
    try {
      await api.adminReparseDocument(docId);
      delete sectionsCache[docId];
      setSectionsCache({ ...sectionsCache });
      if (expanded.has(docId)) await loadSections(docId);
    } catch (err) {
      setErrorMsg("Не удалось переразобрать: " + (err?.response?.data?.detail || err.message));
    }
    setReparsingId(null);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.adminUploadGlobalDocument(file);
      reload();
    } catch (err) {
      setErrorMsg("Не удалось загрузить: " + (err?.response?.data?.detail || err.message));
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function performDelete(d) {
    if (!d) return;
    try { await api.adminDeleteGlobalDocument(d.id_document); reload(); }
    catch (err) { setErrorMsg("Не удалось удалить: " + (err?.response?.data?.detail || err.message)); }
  }

  const { sort, toggleSort, sortItems } = useSort("uploaded", "desc");
  const sortedDocs = useMemo(() => sortItems(docs, DOC_ACCESSORS), [docs, sort]);

  const { page, setPage, pageSize, setPageSize, total, totalPages, pageItems } = usePagination(sortedDocs, { defaultPageSize: 50, storageKey: "adminDocs.pageSize" });

  return <>
    <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        Добавить запись
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
          PDF, DOCX, TXT, XLSX (до 50 МБ). Подмешивается LLM как контекст для генерации разделов.
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.xlsx,.xls" style={{ display: "none" }} onChange={handleUpload} />
        <Btn small primary onClick={() => fileRef.current?.click()} disabled={busy}>
          <UploadIcon /> {busy ? "Загрузка…" : "Загрузить документ"}
        </Btn>
      </div>
    </div>
    <div className="table-scroll">
      {loading
        ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
        : docs.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
              Документы для контекста LLM не загружены. PDF, DOCX, TXT, XLSX — до 50 МБ.
            </div>
          : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F, tableLayout: "fixed" }}>
            <thead><tr style={{ background: T.surface }}>
              <th style={{ ...hdr, width: 30 }} />
              <SortTh sortKey="filename" sort={sort} onSort={toggleSort}>Файл</SortTh>
              <SortTh sortKey="type" sort={sort} onSort={toggleSort} align="center" style={{ width: 100 }}>Тип</SortTh>
              <SortTh sortKey="size" sort={sort} onSort={toggleSort} align="right" style={{ width: 120 }}>Размер</SortTh>
              <SortTh sortKey="uploaded" sort={sort} onSort={toggleSort} style={{ width: 160 }}>Загружен</SortTh>
              <th style={{ ...hdr, width: 56 }} />
            </tr></thead>
            <tbody>
              {pageItems.map(d => {
                const isExpanded = expanded.has(d.id_document);
                const isLoadingSec = loadingSections.has(d.id_document);
                const sections = sectionsCache[d.id_document];
                return <>
                  <tr key={d.id_document} style={{ background: T.surface }}>
                    <td style={{ ...tcell, textAlign: "center", padding: "10px 4px" }}>
                      <button onClick={() => toggleExpand(d.id_document)} title={isExpanded ? "Свернуть" : "Показать секции"}
                        style={{ ...iconBtn, cursor: "pointer", color: T.textMuted, fontSize: 14 }}>
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    </td>
                    <td style={{ ...tcell, fontWeight: 500 }}>
                      <button onClick={() => {
                        const token = localStorage.getItem("token");
                        fetch(api.adminGlobalDocumentDownloadUrl(d.id_document), { headers: { Authorization: `Bearer ${token}` } })
                          .then(r => r.blob())
                          .then(blob => { const u = URL.createObjectURL(blob); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 10000); });
                      }} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, padding: 0, font: "inherit" }}>{d.filename}</button>
                    </td>
                    <td style={{ ...tcell, textAlign: "center", textTransform: "uppercase", color: T.textMuted, fontSize: 11 }}>{d.file_type}</td>
                    <td style={{ ...tcell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textMuted }}>{d.file_size ? (d.file_size / 1024).toFixed(0) + " КБ" : "—"}</td>
                    <td style={{ ...tcell, color: T.textMuted, fontSize: 11 }}>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleString("ru-RU") : "—"}</td>
                    <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap", width: 1, padding: "10px 8px" }}>
                      <button onClick={() => setPendingDelete(d)} title="Удалить файл" style={{ ...iconBtn, cursor: "pointer" }}><TrashIcon /></button>
                    </td>
                  </tr>
                  {isExpanded && <tr key={`${d.id_document}-sec`}>
                    <td colSpan={6} style={{ padding: 0, background: T.bg, borderBottom: "1px solid " + T.borderLight }}>
                      <DocumentSectionsView
                        docId={d.id_document}
                        loading={isLoadingSec}
                        sections={sections}
                        reparsing={reparsingId === d.id_document}
                        onReparse={() => reparse(d.id_document)}
                      />
                    </td>
                  </tr>}
                </>;
              })}
            </tbody>
          </table>}
    </div>
    {!loading && (
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={setPageSize} />
    )}
    {pendingDelete && <ConfirmDeleteModal
      title="Удалить документ?"
      message={`«${pendingDelete.filename}» больше не будет передаваться LLM при генерации разделов. Файл удалится из хранилища.`}
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performDelete(d); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function DocumentSectionsView({ docId, loading, sections, reparsing, onReparse }) {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  function toggle(key) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (loading) {
    return <div style={{ padding: 20, display: "flex", justifyContent: "center" }}><Spinner size={20} /></div>;
  }

  return <div style={{ padding: "12px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px" }}>
        {sections && sections.length > 0
          ? `Извлечено секций: ${sections.length}`
          : "Секции не извлечены — эвристика не распознала заголовки"}
      </div>
      <Btn small onClick={onReparse} disabled={reparsing}>
        {reparsing ? "Разбираем…" : "↻ Переразобрать"}
      </Btn>
    </div>
    {sections && sections.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sections.map(s => {
          const isExp = expandedKeys.has(s.section_key);
          const preview = (s.content || "").slice(0, 240);
          const needsToggle = (s.content || "").length > 240;
          return <div key={s.section_key} style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: isExp ? "1px solid " + T.borderLight : "none" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{s.section_label}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: T.textMuted }}>{s.section_key}</span>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: T.bg, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{s.char_count} симв.</span>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: T.accentLight, color: T.accent, textTransform: "uppercase", letterSpacing: ".3px" }}>{s.extraction_method}</span>
              {needsToggle && (
                <button onClick={() => toggle(s.section_key)} title={isExp ? "Свернуть" : "Развернуть"}
                  style={{ ...iconBtn, cursor: "pointer", color: T.textMuted, fontSize: 12, padding: "2px 6px" }}>
                  {isExp ? "▾" : "▸"}
                </button>
              )}
            </div>
            <div style={{ padding: "8px 10px", fontSize: 12, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: F, background: T.bg }}>
              {isExp ? s.content : (preview + (needsToggle ? "…" : ""))}
            </div>
          </div>;
        })}
      </div>
    ) : (
      <div style={{ padding: "12px 16px", color: T.textMuted, fontSize: 12, fontStyle: "italic", background: T.surface, border: "1px dashed " + T.border, borderRadius: 4 }}>
        Файл загружен, но эвристический парсер не нашёл в нём знакомых заголовков разделов РПД (например «1.1 Цели и задачи», «Содержание дисциплины», «Литература»). При генерации этот файл будет передан LLM целиком (legacy-режим).
      </div>
    )}
  </div>;
}

function LlmPromptsContent() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savedTick, setSavedTick] = useState(0);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListLlmPrompts().then(r => setPrompts(r.data || []))
      .catch(() => { if (!silent) setPrompts([]); })
      .finally(() => { if (!silent) setLoading(false); });
  };
  useEffect(() => { fetchAll(false); }, []);

  async function saveField(idPrompt, field, value) {
    try {
      await api.adminUpdateLlmPrompt(idPrompt, { [field]: value });
      setSavedTick(t => t + 1);
      fetchAll(true);
    } catch (err) {
      setErrorMsg("Не удалось сохранить: " + (err?.response?.data?.detail || err.message));
    }
  }

  if (loading) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>;
  }
  if (prompts.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
      Промпты ещё не созданы. Пересоздайте БД — seed добавит базовые шаблоны.
    </div>;
  }

  return <>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {prompts.map(p => <PromptCard key={p.id_prompt} prompt={p} onSave={saveField} />)}
    </div>
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function PromptCard({ prompt, onSave }) {
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt || "");
  const [userPromptTemplate, setUserPromptTemplate] = useState(prompt.user_prompt_template || "");
  const [description, setDescription] = useState(prompt.description || "");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => { setSystemPrompt(prompt.system_prompt || ""); }, [prompt.system_prompt]);
  useEffect(() => { setUserPromptTemplate(prompt.user_prompt_template || ""); }, [prompt.user_prompt_template]);
  useEffect(() => { setDescription(prompt.description || ""); }, [prompt.description]);

  function commitSystem() {
    if (systemPrompt === (prompt.system_prompt || "")) return;
    onSave(prompt.id_prompt, "system_prompt", systemPrompt || null);
  }
  function commitUserTemplate() {
    if (userPromptTemplate === (prompt.user_prompt_template || "")) return;
    onSave(prompt.id_prompt, "user_prompt_template", userPromptTemplate);
  }
  function commitDescription() {
    if (description === (prompt.description || "")) return;
    onSave(prompt.id_prompt, "description", description || null);
  }

  const updatedAt = prompt.updated_at ? new Date(prompt.updated_at).toLocaleString("ru-RU") : null;

  return <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    <button type="button" onClick={() => setCollapsed(c => !c)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", background: "transparent", border: "none",
        borderBottom: collapsed ? "none" : "1px solid " + T.borderLight,
        cursor: "pointer", textAlign: "left", fontFamily: F,
      }}>
      <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 22 }}>{prompt.order_index || ""}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1 }}>{prompt.section_label}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase",
        padding: "2px 8px", borderRadius: 10,
        background: prompt.is_structural ? T.accentLight : T.bg,
        color: prompt.is_structural ? T.accent : T.textMuted,
      }}>{prompt.is_structural ? "JSON" : "Текст"}</span>
      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>{prompt.section_key}</span>
      <span style={{ color: T.textMuted, fontSize: 14 }}>{collapsed ? "▸" : "▾"}</span>
    </button>
    {!collapsed && <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={miniLabel}>Описание / подсказка для админа</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={commitDescription}
          placeholder="Кратко: что именно генерируется, какой формат ожидается"
          rows={2}
          style={textareaStyle}
        />
      </div>
      <div>
        <label style={miniLabel}>System prompt <span style={{ color: T.textMuted, fontWeight: 400 }}>(оставьте пустым — будет использован общий системный промпт)</span></label>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          onBlur={commitSystem}
          placeholder="Опционально: переопределить системный промпт для этого раздела"
          rows={3}
          style={textareaStyle}
        />
      </div>
      <div>
        <label style={miniLabel}>User prompt template <span style={{ color: T.red, fontWeight: 700 }}>*</span></label>
        <textarea
          value={userPromptTemplate}
          onChange={e => setUserPromptTemplate(e.target.value)}
          onBlur={commitUserTemplate}
          placeholder="Шаблон промпта. Плейсхолдеры: {discipline}, {direction}, {profile}, {total_hours}, {lecture_hours}, {practice_hours}, {lab_hours}, {self_study_hours}"
          rows={8}
          style={{ ...textareaStyle, fontFamily: "monospace", fontSize: 12 }}
        />
      </div>
      {updatedAt && <div style={{ fontSize: 10, color: T.textMuted, textAlign: "right", fontStyle: "italic" }}>
        Обновлено: {updatedAt}
      </div>}
    </div>}
  </div>;
}

const textareaStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid " + T.border,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  background: T.surface,
};

function FilterChip({ label, count, active, onClick }) {
  return <button
    type="button"
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 12,
      border: "1px solid " + (active ? T.accent : T.border),
      background: active ? T.accentLight : T.surface,
      color: active ? T.accent : T.text,
      fontSize: 12, fontWeight: active ? 700 : 500,
      cursor: "pointer", fontFamily: F,
      whiteSpace: "nowrap",
    }}
  >
    {label}
    <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>({count})</span>
  </button>;
}

function RowActions({ onEdit, onDelete }) {
  return <div style={{ display: "inline-flex", gap: 4 }}>
    <button onClick={onEdit} title="Редактировать"
      style={{ ...iconBtn, cursor: "pointer", color: T.textMuted }}>
      <PencilIcon />
    </button>
    <button onClick={onDelete} title="Удалить запись"
      style={{ ...iconBtn, cursor: "pointer" }}>
      <TrashIcon />
    </button>
  </div>;
}

function DictEditModal({ entry, competencyOptions, onClose, onSaved, onError, onDelete }) {
  const isLiterature = entry.kind === "literature_title";
  const isIndicatorKind = INDICATOR_KINDS.has(entry.kind);

  const initialIndicatorContext = useMemo(() => {
    if (entry.kind === "indicator_code") {
      const p = parseIndicatorCode(entry.value || "");
      return { competency: p.competency || (entry.source_type || ""), index: String(p.index || 1) };
    }
    if (entry.kind === "indicator_description") {
      const p = parseIndicatorCode(entry.source_type || "");
      return { competency: p.competency || "", index: String(p.index || 1) };
    }
    return { competency: "", index: "1" };
  }, [entry]);

  const [value, setValue] = useState(entry.value || "");
  const [sourceType, setSourceType] = useState(entry.source_type || "");
  const [mode, setMode] = useState(entry.mode || "");
  const [competency, setCompetency] = useState(initialIndicatorContext.competency);
  const [index, setIndex] = useState(initialIndicatorContext.index);
  const [saving, setSaving] = useState(false);

  const longText = entry.kind === "indicator_description" || entry.kind === "literature_title";

  async function save() {
    setSaving(true);
    try {
      if (entry.kind === "discipline") {
        const v = value.trim();
        if (!v) throw new Error("Заполните название");
        await api.adminUpdateDiscipline(entry.id_entry, { name: v });
        onSaved();
        return;
      }
      let payload;
      if (entry.kind === "indicator_code") {
        const comp = competency.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        payload = { value: buildIndicatorCode(comp, index), source_type: comp };
      } else if (entry.kind === "indicator_description") {
        const comp = competency.trim();
        const desc = value.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        if (!desc) throw new Error("Заполните описание");
        payload = { value: desc, source_type: buildIndicatorCode(comp, index) };
      } else if (isLiterature) {
        const v = value.trim();
        if (!v) throw new Error("Заполните значение");
        if (!sourceType) throw new Error("Выберите подраздел");
        if (!mode) throw new Error("Выберите тип");
        payload = { value: v, source_type: sourceType, mode: mode };
      } else {
        const v = value.trim();
        if (!v) throw new Error("Заполните значение");
        payload = { value: v };
      }
      await api.adminUpdateDictionary(entry.id_entry, payload);
      onSaved();
    } catch (e) {
      onError("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  }

  return <Modal width={560} onClose={onClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, fontSize: 16, fontWeight: 700 }}>
      Редактирование записи
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      {isLiterature && (
        <>
          <div>
            <div style={miniLabel}>Подраздел <span style={{ color: T.red }}>*</span></div>
            <Dropdown value={sourceType} options={LIT_TYPE_OPTIONS} onChange={setSourceType}
              placeholder="— не указано —" clearLabel="— не указано —" />
          </div>
          <div>
            <div style={miniLabel}>Тип <span style={{ color: T.red }}>*</span></div>
            <Dropdown value={mode} options={MODE_OPTIONS} onChange={setMode} placeholder="— не указано —" clearLabel="— не указано —" />
          </div>
        </>
      )}
      {isIndicatorKind && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", minWidth: 220 }}>
            <div style={miniLabel}>Компетенция</div>
            {(competencyOptions || []).length === 0
              ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>—</div>
              : <Dropdown
                  value={competency}
                  options={competencyOptions.map(c => ({ value: c, label: c }))}
                  onChange={setCompetency}
                  placeholder="— не указано —"
                  clearLabel="— не указано —"
                />}
          </div>
          <div style={{ flex: "0 0 180px" }}>
            <div style={miniLabel}>Индекс</div>
            <Dropdown value={index} options={INDEX_OPTIONS} onChange={setIndex} />
          </div>
          {entry.kind === "indicator_code" && (
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <div style={miniLabel}>Получится</div>
              <div style={{
                ...miniInput,
                fontWeight: 600,
                color: competency ? T.accent : T.textMuted,
                background: competency ? T.accentLight : T.bg,
                border: "1px solid " + (competency ? T.accent : T.borderLight),
                fontStyle: competency ? "normal" : "italic",
              }}>
                {competency ? buildIndicatorCode(competency, index) : "выберите компетенцию"}
              </div>
            </div>
          )}
        </div>
      )}
      {entry.kind === "indicator_code" ? null : (
        <div>
          <div style={miniLabel}>{entry.kind === "indicator_description" ? "Описание" : "Значение"}</div>
          {longText
            ? <textarea
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              />
            : <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); }}
                style={inputStyle}
              />}
        </div>
      )}
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div>
        {onDelete && <Btn danger onClick={onDelete} disabled={saving}>Удалить</Btn>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
        <Btn onClick={onClose}>Отмена</Btn>
      </div>
    </div>
  </Modal>;
}

const miniLabel = { fontSize: 11, color: T.textMuted, marginBottom: 3 };
const miniInput = { width: "100%", padding: "6px 10px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, background: T.surface, fontFamily: F, boxSizing: "border-box" };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, boxSizing: "border-box", outline: "none" };const groupLabelStyle = { fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", flexShrink: 0, width: 90 };
