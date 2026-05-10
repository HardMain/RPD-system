import { useEffect, useMemo, useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../theme.js";
import { hdr, tcell } from "../styles.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { TrashIcon, PlusIcon, PencilIcon } from "../components/icons.jsx";
import { ConfirmDeleteModal, AlertModal } from "../features/rpd-editor/EditorModals.jsx";
import { LITERATURE_TYPES } from "../features/rpd-editor/catalogs.js";

const KINDS = [
  { id: "discipline", label: "Дисциплины" },
  { id: "software_name", label: "ПО" },
  { id: "database_name", label: "БД и ИСС" },
  { id: "equipment", label: "Оборудование" },
  { id: "room_type", label: "Виды занятий (МТО)" },
  { id: "literature_title", label: "Литература" },
  { id: "assessment_tool", label: "Средства оценки" },
  { id: "competency_code", label: "Компетенции (коды)" },
  { id: "indicator_code", label: "Индикаторы (коды)" },
  { id: "indicator_description", label: "Индикаторы достижения" },
  { id: "software_purpose", label: "Назначение ПО" },
];

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
  const [newMode, setNewMode] = useState("printed");
  const [newCompetency, setNewCompetency] = useState("");
  const [newIndex, setNewIndex] = useState("1");
  const [adding, setAdding] = useState(false);
  const [prefixFilter, setPrefixFilter] = useState("all");

  const [competencyOptions, setCompetencyOptions] = useState([]);

  const isLiterature = kind === "literature_title";
  const isIndicatorKind = INDICATOR_KINDS.has(kind);
  const isDiscipline = kind === "discipline";
  const parentMeta = PARENT_LABELS[kind] || null;
  const useGroupedView = !!parentMeta;
  const showPrefixFilter = FILTERABLE_KINDS.has(kind);

  const fetchItems = () => isDiscipline
    ? api.adminListDisciplines().then(r => (r.data || []).map(adaptDiscipline))
    : api.adminListDictionary(kind, {}).then(r => r.data || []);

  const silentRefresh = () => {
    fetchItems().then(setItems).catch(() => {});
  };
  const reload = silentRefresh;
  useEffect(() => {
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
    setNewMode("printed");
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

  const grouped = useMemo(() => {
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
      rows: kind === "indicator_code"
        ? [...buckets.get(k)].sort((a, b) => parseIndicatorCode(a.value).index - parseIndicatorCode(b.value).index)
        : buckets.get(k),
    }));
  }, [filtered, useGroupedView, kind]);

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
        payload = { value: v, source_type: newSourceType || null, mode: newMode || null };
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
      : !!newValue.trim();

  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Справочники</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
        {isDiscipline
          ? "Перечень всех дисциплин, доступных для создания РПД вручную. Пополняется автоматически при импорте БУПов; при удалении БУПа дисциплины из справочника не удаляются."
          : "Записи отсюда подсказываются преподавателям при заполнении РПД. Автоматически дополняются после согласования каждой РПД."}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
        {KINDS.map(k => (
          <button key={k.id} type="button" onClick={() => setKind(k.id)}
            style={{
              padding: "6px 12px",
              border: "1px solid " + (kind === k.id ? T.accent : T.border),
              borderRadius: 5,
              background: kind === k.id ? T.accentLight : T.surface,
              color: kind === k.id ? T.accent : T.text,
              fontWeight: kind === k.id ? 600 : 500,
              fontSize: 12, fontFamily: F,
              cursor: "pointer",
            }}>{k.label}</button>
        ))}
      </div>

      <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
          Добавить запись
        </div>

        {isLiterature && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "1 1 320px", minWidth: 240 }}>
              <div style={miniLabel}>Подраздел</div>
              <Dropdown value={newSourceType} options={LIT_TYPE_OPTIONS}
                onChange={setNewSourceType}
                placeholder="Любой подраздел" clearLabel="Любой подраздел" />
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div style={miniLabel}>Тип</div>
              <Dropdown value={newMode} options={MODE_OPTIONS}
                onChange={setNewMode} placeholder="—" />
            </div>
          </div>
        )}

        {isIndicatorKind && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div style={miniLabel}>Компетенция</div>
              {competencyOptions.length === 0
                ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>
                    Сначала добавьте компетенции во вкладке «Компетенции (коды)».
                  </div>
                : <Dropdown
                    value={newCompetency}
                    options={competencyOptions.map(c => ({ value: c, label: c }))}
                    onChange={setNewCompetency}
                    placeholder="Выберите компетенцию"
                    clearLabel="—"
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

        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          {kind === "indicator_code" ? (
            <div style={{ flex: 1, color: T.textMuted, fontSize: 12, alignSelf: "center", fontStyle: "italic" }}>
              Код индикатора собирается автоматически из выбранной компетенции и индекса.
            </div>
          ) : kind === "indicator_description" ? (
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
              placeholder={isDiscipline ? "Название дисциплины и нажмите «Добавить»…" : "Введите значение и нажмите «Добавить»…"}
              style={{ flex: 1, padding: "7px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, outline: "none" }}
            />
          )}
          <Btn small primary onClick={handleAdd} disabled={adding || !canAdd}>
            <PlusIcon /> Добавить
          </Btn>
        </div>
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
            : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F }}>
              <thead><tr style={{ background: T.surface }}>
                {useGroupedView && <th style={{ ...hdr, width: 180 }}>{parentMeta.col}</th>}
                {isLiterature && <th style={hdr}>Подраздел</th>}
                <th style={hdr}>{isDiscipline ? "Название дисциплины" : "Значение"}</th>
                {isLiterature && <th style={hdr}>Тип</th>}
                <th style={{ ...hdr, width: 200 }}>{isDiscipline ? "Использование" : "Источник"}</th>
                <th style={{ ...hdr, textAlign: "center", width: 80 }} />
              </tr></thead>
              <tbody>
                {useGroupedView
                  ? grouped.flatMap(g => g.rows.map((it, i) => (
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
                        {it.source === "approved_rpd" ? "Из согласованной РПД" : "Вручную"}
                      </td>
                      <td style={{ ...tcell, textAlign: "center", padding: "8px 4px", whiteSpace: "nowrap" }} onDoubleClick={e => e.stopPropagation()}>
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setPendingDelete(it)} />
                      </td>
                    </tr>
                  )))
                  : filtered.map(it => (
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
                          : (it.source === "approved_rpd" ? "Из согласованной РПД" : "Вручную")}
                      </td>
                      <td style={{ ...tcell, textAlign: "center", padding: "8px 4px", whiteSpace: "nowrap" }} onDoubleClick={e => e.stopPropagation()}>
                        <RowActions onEdit={() => setEditing(it)} onDelete={() => setPendingDelete(it)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>}
      </div>
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
      style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "inline-flex", color: T.textMuted }}>
      <PencilIcon />
    </button>
    <button onClick={onDelete} title="Удалить запись"
      style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "inline-flex" }}>
      <TrashIcon />
    </button>
  </div>;
}

function DictEditModal({ entry, competencyOptions, onClose, onSaved, onError }) {
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
  const [mode, setMode] = useState(entry.mode || "printed");
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
        payload = { value: v, source_type: sourceType || "", mode: mode || "" };
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
            <div style={miniLabel}>Подраздел</div>
            <Dropdown value={sourceType} options={LIT_TYPE_OPTIONS} onChange={setSourceType}
              placeholder="Любой подраздел" clearLabel="Любой подраздел" />
          </div>
          <div>
            <div style={miniLabel}>Тип</div>
            <Dropdown value={mode} options={MODE_OPTIONS} onChange={setMode} placeholder="—" />
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
                  placeholder="Выберите компетенцию"
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
    <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.borderLight, display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
    </div>
  </Modal>;
}

const miniLabel = { fontSize: 11, color: T.textMuted, marginBottom: 3 };
const miniInput = { width: "100%", padding: "6px 10px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, background: T.surface, fontFamily: F, boxSizing: "border-box" };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, boxSizing: "border-box", outline: "none" };
