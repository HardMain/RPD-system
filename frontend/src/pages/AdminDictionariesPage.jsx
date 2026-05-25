import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client.js";
import { T, F, hdr, tcell, iconBtnEdit, iconBtnDelete, adminAddField, adminAddBtn, dataTable, adminAddPanel, adminToolbar, adminSearch, sectionLabel } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { FilterChip } from "../components/FilterChip.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { TrashIcon, PlusIcon, PencilIcon, UploadIcon, ResetIcon } from "../components/icons.jsx";
import { Pagination, usePagination } from "../components/Pagination.jsx";
import { useSort, SortTh } from "../components/sortable.jsx";
import { useStickyState } from "../hooks/useStickyState.js";
import { useColumnWidths, ResizeHandle } from "../hooks/useColumnWidths.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";
import {
  KIND_GROUPS, KINDS, adaptDiscipline, PARENT_LABELS, FILTERABLE_KINDS, INDICATOR_KINDS,
  INDEX_OPTIONS, parseIndicatorCode, parseCompetencyCode, buildIndicatorCode,
  MODE_LABELS, MODE_OPTIONS, litTypeOptions, SOFTWARE_TYPE_OPTIONS, sourceLabel,
  DICT_ACCESSORS, DOC_ACCESSORS, miniLabel, miniInput, inputStyle,
} from "./dictionaryHelpers.js";
import { DictEditModal } from "./DictEditModal.jsx";
import { BupsContent } from "./AdminBupsPage.jsx";
import { DirectionsContent } from "./AdminDirectionsPage.jsx";
import { DepartmentsContent } from "./AdminDepartmentsPage.jsx";
import { FosFilesContent } from "./AdminFosFilesPage.jsx";

export function AdminDictionariesPage() {
  const [kind, setKind] = useStickyState("adminDict.kind.v1", KINDS[0].id);
  useEffect(() => {
    if (!KINDS.some(k => k.id === kind)) setKind(KINDS[0].id);
  }, []);
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
  const [newDirectionCode, setNewDirectionCode] = useState("");
  const [newDisciplineId, setNewDisciplineId] = useState("");
  const [newExtra, setNewExtra] = useState("");
  const [adding, setAdding] = useState(false);
  const [prefixFilter, setPrefixFilter] = useState("all");

  const [competencyOptions, setCompetencyOptions] = useState([]);
  const [directionOptions, setDirectionOptions] = useState([]);
  const [disciplineOptions, setDisciplineOptions] = useState([]);

  const isLiterature = kind === "literature_title";
  const isIndicatorKind = INDICATOR_KINDS.has(kind);
  const isDiscipline = kind === "discipline";
  const isCustomKind = kind === "bup" || kind === "direction" || kind === "department" || kind === "fos";
  const isDirectionScoped = kind === "indicator_description";
  const isDisciplineScoped = kind === "literature_title";
  const isSoftware = kind === "software_name";
  const isDatabase = kind === "database_name";
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
    if (!isDirectionScoped) return;
    api.adminListDirections().then(r => {
      const items = (r.data?.items || r.data || [])
        .filter(d => d?.code)
        .map(d => ({ code: d.code, name: d.name || "" }))
        .sort((a, b) => a.code.localeCompare(b.code, "ru", { numeric: true, sensitivity: "base" }));
      setDirectionOptions(items);
    }).catch(() => setDirectionOptions([]));
  }, [isDirectionScoped, kind]);

  useEffect(() => {
    if (!isDisciplineScoped) return;
    api.adminListDisciplines().then(r => {
      const items = (r.data || [])
        .filter(d => d?.id_discipline && d?.name)
        .map(d => ({ id: d.id_discipline, name: d.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
      setDisciplineOptions(items);
    }).catch(() => setDisciplineOptions([]));
  }, [isDisciplineScoped, kind]);

  const disciplineNameById = useMemo(() => {
    const m = new Map();
    for (const d of disciplineOptions) m.set(d.id, d.name);
    return m;
  }, [disciplineOptions]);
  const directionNameByCode = useMemo(() => {
    const m = new Map();
    for (const d of directionOptions) m.set(d.code, d.name);
    return m;
  }, [directionOptions]);

  useEffect(() => {
    setSearch("");
    setNewValue("");
    setNewSourceType("");
    setNewMode("");
    setNewCompetency("");
    setNewIndex("1");
    setNewDirectionCode("");
    setNewDisciplineId("");
    setNewExtra("");
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
        const haystack = [
          it.value,
          it.source_type,
          it.direction_code,
          directionNameByCode.get(it.direction_code),
          disciplineNameById.get(it.id_discipline),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (showPrefixFilter && prefixFilter !== "all" && prefixOf(it) !== prefixFilter) return false;
      return true;
    });
  }, [items, search, showPrefixFilter, prefixFilter, kind, directionNameByCode, disciplineNameById]);

  const { sort, toggleSort, sortItems } = useSort("value", "asc", "adminDict.sort.v1");
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
    const rowSorter = kind === "indicator_description"
      ? (a, b) => (a.direction_code || "").localeCompare(b.direction_code || "", "ru", { numeric: true, sensitivity: "base" })
      : (a, b) => parseIndicatorCode(a.value).index - parseIndicatorCode(b.value).index;
    return order.map(k => ({
      parent: k,
      rows: [...buckets.get(k)].sort(rowSorter),
    }));
  }, [filtered, useGroupedView, kind]);

  const paginationSource = useGroupedView ? allGroups : sortedRows;
  const { page, setPage, pageSize, setPageSize, total: pgTotal, totalPages: pgTotalPages, pageItems } = usePagination(paginationSource, { defaultPageSize: 50, storageKey: `adminDict.${kind}.pageSize` });

  const dictCols = useMemo(() => {
    const cols = [];
    if (useGroupedView) {
      cols.push({ key: "parent", label: parentMeta.col, defaultWidth: 180, align: "center" });
      if (isDirectionScoped) cols.push({ key: "direction_code", label: "Направление", defaultWidth: 130 });
      cols.push({ key: "value", label: "Значение", defaultWidth: 460 });
      cols.push({ key: "source", label: "Источник", defaultWidth: 180 });
    } else {
      if (isLiterature) cols.push({ key: "sourceType", label: "Подраздел", defaultWidth: 200, sortKey: "sourceType" });
      if (isSoftware) cols.push({ key: "sourceType", label: "Вид ПО", defaultWidth: 240, sortKey: "sourceType" });
      cols.push({ key: "value", label: isDiscipline ? "Название дисциплины" : "Значение", defaultWidth: 340, sortKey: "value" });
      if (isLiterature) cols.push({ key: "mode", label: "Тип", defaultWidth: 110, sortKey: "mode" });
      if (isDatabase) cols.push({ key: "extra", label: "Ссылка на информационный ресурс", defaultWidth: 240 });
      if (isDisciplineScoped) cols.push({ key: "discipline", label: "Дисциплина", defaultWidth: 170 });
      cols.push({ key: "source", label: isDiscipline ? "Использование" : "Источник", defaultWidth: 160, sortKey: isDiscipline ? "usage" : "source" });
    }
    const sumOther = cols.reduce((s, c) => s + c.defaultWidth, 0);
    const actionsDefault = Math.max(35, Math.round(70 * sumOther / 1010));
    cols.push({ key: "actions", label: "", defaultWidth: actionsDefault, align: "right" });
    return cols;
  }, [useGroupedView, isDirectionScoped, isLiterature, isSoftware, isDatabase, isDisciplineScoped, isDiscipline, parentMeta]);

  const dictDefaults = useMemo(() => {
    const d = {};
    for (const c of dictCols) d[c.key] = c.defaultWidth;
    return d;
  }, [dictCols]);

  const dictStorageKey = `adminDict.${kind}.${useGroupedView ? "g" : "u"}.v7`;
  const tableContainerRef = useRef(null);
  const { widths: dictWidths, makeResizer: makeDictResizer, resetWidths: resetDictWidths } = useColumnWidths(dictStorageKey, dictDefaults, tableContainerRef);

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
        if (!newDirectionCode) throw new Error("Выберите направление");
        payload = { value: desc, source_type: buildIndicatorCode(comp, newIndex), direction_code: newDirectionCode };
      } else if (isLiterature) {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните значение");
        if (!newSourceType) throw new Error("Выберите подраздел");
        if (!newMode) throw new Error("Выберите тип");
        if (!newDisciplineId) throw new Error("Выберите дисциплину");
        payload = { value: v, source_type: newSourceType, mode: newMode, id_discipline: newDisciplineId };
      } else if (isSoftware) {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните значение");
        if (!newSourceType) throw new Error("Выберите вид ПО");
        payload = { value: v, source_type: newSourceType };
      } else if (isDatabase) {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните наименование");
        if (!newExtra.trim()) throw new Error("Укажите ссылку на информационный ресурс");
        payload = { value: v, extra: newExtra.trim() };
      } else {
        const v = newValue.trim();
        if (!v) throw new Error("Заполните значение");
        payload = { value: v };
      }
      await api.adminCreateDictionary(kind, payload);
      setNewValue("");
      if (isDatabase) setNewExtra("");
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
      ? !!newCompetency.trim() && !!newValue.trim() && !!newDirectionCode
      : isLiterature
        ? !!newValue.trim() && !!newSourceType && !!newMode && !!newDisciplineId
        : isSoftware
          ? !!newValue.trim() && !!newSourceType
          : isDatabase
            ? !!newValue.trim() && !!newExtra.trim()
            : !!newValue.trim();

  return <div style={{ flex: 1, overflow: "auto", scrollbarGutter: "stable", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
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
      {kind === "department" && <DepartmentsContent />}
      {kind === "fos" && <FosFilesContent />}

      {!isCustomKind && <>
      <div style={adminAddPanel}>
        <div style={sectionLabel}>
          Добавить запись
        </div>

        {isLiterature && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "0 0 200px" }}>
              <div style={miniLabel}>Тип <span style={{ color: T.red }}>*</span></div>
              <Dropdown value={newMode} options={MODE_OPTIONS}
                onChange={(v) => {
                  setNewMode(v);
                  const opts = litTypeOptions(v).map(o => o.value);
                  if (newSourceType && !opts.includes(newSourceType)) setNewSourceType("");
                }}
                placeholder="— не указано —" clearLabel="— не указано —" />
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 240 }}>
              <div style={miniLabel}>Подраздел <span style={{ color: T.red }}>*</span></div>
              <Dropdown value={newSourceType} options={litTypeOptions(newMode)}
                onChange={setNewSourceType}
                disabled={!newMode}
                placeholder={newMode ? "— не указано —" : "Сначала выберите тип"}
                clearLabel="— не указано —" />
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 240 }}>
              <div style={miniLabel}>Дисциплина <span style={{ color: T.red }}>*</span></div>
              {disciplineOptions.length === 0
                ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>Сначала добавьте дисциплины.</div>
                : <Dropdown
                    value={newDisciplineId ? String(newDisciplineId) : ""}
                    options={disciplineOptions.map(d => ({ value: String(d.id), label: d.name }))}
                    onChange={v => setNewDisciplineId(v ? Number(v) : "")}
                    placeholder="— не указано —"
                    clearLabel="— не указано —"
                  />}
            </div>
          </div>
        )}
        {isSoftware && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "1 1 320px", minWidth: 260 }}>
              <div style={miniLabel}>Вид ПО <span style={{ color: T.red }}>*</span></div>
              <Dropdown
                value={newSourceType}
                options={SOFTWARE_TYPE_OPTIONS}
                onChange={setNewSourceType}
                placeholder="— не указано —"
                clearLabel="— не указано —"
              />
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
            {isDirectionScoped && (
              <div style={{ flex: "1 1 260px", minWidth: 240 }}>
                <div style={miniLabel}>Направление <span style={{ color: T.red }}>*</span></div>
                {directionOptions.length === 0
                  ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>
                      Сначала добавьте направления во вкладке «Направления».
                    </div>
                  : <Dropdown
                      value={newDirectionCode}
                      options={directionOptions.map(d => ({ value: d.code, label: `${d.code} ${d.name}` }))}
                      onChange={setNewDirectionCode}
                      placeholder="— не указано —"
                      clearLabel="— не указано —"
                    />}
              </div>
            )}
          </div>
        )}

        {kind === "indicator_code" ? (
          <div style={{ color: T.textMuted, fontSize: 12, fontStyle: "italic", padding: "6px 0" }}>
            Код индикатора собирается автоматически из выбранной компетенции и индекса.
          </div>
        ) : isDatabase ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={miniLabel}>{KINDS.find(k => k.id === kind)?.valueLabel || "Значение"} <span style={{ color: T.red }}>*</span></div>
              <input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Введите наименование…"
                style={{ ...adminAddField, width: "100%" }}
              />
            </div>
            <div>
              <div style={miniLabel}>Ссылка на информационный ресурс <span style={{ color: T.red }}>*</span></div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input
                  value={newExtra}
                  onChange={e => setNewExtra(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="https://… или «локальная сеть»"
                  style={{ ...adminAddField, flex: 1 }}
                />
                <Btn small primary onClick={handleAdd} disabled={adding || !canAdd} style={adminAddBtn}>
                  <PlusIcon /> Добавить
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={miniLabel}>
              {KINDS.find(k => k.id === kind)?.valueLabel || "Значение"} <span style={{ color: T.red }}>*</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {kind === "indicator_description" ? (
                <textarea
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder={'Например: "Знает методы…"'}
                  style={{ ...adminAddField, flex: 1, minHeight: 34, padding: "7px 10px", resize: "vertical" }}
                />
              ) : (
                <input
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="Введите значение…"
                  style={{ ...adminAddField, flex: 1 }}
                />
              )}
              <Btn small primary onClick={handleAdd} disabled={adding || !canAdd} style={adminAddBtn}>
                <PlusIcon /> Добавить
              </Btn>
            </div>
          </div>
        )}
      </div>

      <div style={adminToolbar}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по значению…"
          style={adminSearch(360)}
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

      <div ref={tableContainerRef} className="table-scroll">
        {loading
          ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
          : filtered.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
                {items.length === 0 ? "Записей пока нет — добавьте первую сверху." : "Ничего не нашлось."}
              </div>
            : <table style={{ ...dataTable, tableLayout: "fixed" }}>
              <colgroup>
                {dictCols.map(c => <col key={c.key} style={{ width: dictWidths[c.key] }} />)}
              </colgroup>
              <thead><tr style={{ background: T.surface }}>
                {dictCols.map((c, i) => {
                  const nextCol = dictCols[i + 1];
                  const onResize = nextCol ? makeDictResizer(c.key, nextCol.key) : undefined;
                  const isActions = c.key === "actions";
                  if (c.sortKey) {
                    return <SortTh key={c.key} sortKey={c.sortKey} sort={sort} onSort={toggleSort} onResize={onResize}>{c.label}</SortTh>;
                  }
                  const headerAlign = "center";
                  return <th key={c.key} style={{ ...hdr, padding: 0, position: "relative" }}>
                    <div style={{ padding: "10px 12px", paddingRight: onResize ? 18 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: headerAlign }}>
                      {isActions
                        ? <button type="button" onClick={resetDictWidths} title="Восстановить ширину колонок по умолчанию"
                            style={{ border: "none", background: "none", color: T.text, cursor: "pointer", padding: 2, display: "inline-flex" }}><ResetIcon /></button>
                        : c.label}
                    </div>
                    {onResize && <ResizeHandle onMouseDown={onResize} />}
                  </th>;
                })}
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
                      {isDirectionScoped && (
                        <td style={{ ...tcell, fontSize: 11, textAlign: "center", color: it.direction_code ? T.text : T.textMuted, fontStyle: it.direction_code ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.direction_code || "—"}
                        </td>
                      )}
                      <td style={{ ...tcell, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.value}>{it.value}</td>
                      <td style={{ ...tcell, fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sourceLabel(it.source)}
                      </td>
                      <td style={{ ...tcell, textAlign: "right", padding: "8px 4px", whiteSpace: "nowrap", overflow: "hidden" }} onDoubleClick={e => e.stopPropagation()}>
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setPendingDelete(it)} />
                      </td>
                    </tr>
                  )))
                  : pageItems.map(it => (
                    <tr key={it.id_entry}
                        onDoubleClick={() => setEditing(it)}
                        style={{ background: T.surface, cursor: "pointer" }}
                        title="Двойной клик — редактировать">
                      {isLiterature && <td style={{ ...tcell, color: it.source_type ? T.text : T.textMuted, fontStyle: it.source_type ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.source_type || ""}>{it.source_type || "—"}</td>}
                      {isSoftware && <td style={{ ...tcell, color: it.source_type ? T.text : T.textMuted, fontStyle: it.source_type ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.source_type || ""}>{it.source_type || "— не указан —"}</td>}
                      <td style={{ ...tcell, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.value}>{it.value}</td>
                      {isLiterature && <td style={{ ...tcell, color: it.mode ? T.text : T.textMuted, fontStyle: it.mode ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.mode ? MODE_LABELS[it.mode] || it.mode : "—"}</td>}
                      {isDatabase && <td style={{ ...tcell, fontSize: 12, color: it.extra ? T.text : T.textMuted, fontStyle: it.extra ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.extra || ""}>{it.extra || "— не указана —"}</td>}
                      {isDisciplineScoped && (
                        <td style={{ ...tcell, fontSize: 12, color: it.id_discipline ? T.text : T.textMuted, fontStyle: it.id_discipline ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={disciplineNameById.get(it.id_discipline) || ""}>
                          {disciplineNameById.get(it.id_discipline) || "—"}
                        </td>
                      )}
                      <td style={{ ...tcell, fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isDiscipline
                          ? <UsageInfo bups={it.used_in_bups} rpds={it.used_in_rpds} />
                          : sourceLabel(it.source)}
                      </td>
                      <td style={{ ...tcell, textAlign: "right", padding: "8px 4px", whiteSpace: "nowrap", overflow: "hidden" }} onDoubleClick={e => e.stopPropagation()}>
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
      directionOptions={directionOptions}
      disciplineOptions={disciplineOptions}
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

function RowActions({ onEdit, onDelete }) {
  return <div style={{ display: "inline-flex", gap: 4 }}>
    <button onClick={onEdit} title="Редактировать"
      style={{ ...iconBtnEdit, cursor: "pointer" }}>
      <PencilIcon />
    </button>
    <button onClick={onDelete} title="Удалить запись"
      style={{ ...iconBtnDelete, cursor: "pointer" }}>
      <TrashIcon />
    </button>
  </div>;
}

const groupLabelStyle = { fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", flexShrink: 0, width: 90 };
