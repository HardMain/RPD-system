import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import * as api from "../../../api/client.js";
import { T, F, td, th } from "../../../styles/index.js";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { BupDropdown } from "../BupDropdown.jsx";
import { Combobox } from "../../../components/Combobox.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { ConfirmDeleteModal, AlertModal } from "../EditorModals.jsx";
import { GenPlaque } from "../GenPlaque.jsx";

const fetchAssessmentToolSuggestions = async (q) => {
  const r = await api.getSuggestions("assessment_tool", { q });
  return r.data?.items || [];
};

const PLACEHOLDER_VERBS = { 1: "Знает", 2: "Умеет", 3: "Владеет" };

function isPlaceholderDescription(desc) {
  return (desc || "").toLowerCase().includes("требуется заполнение");
}

function indicatorIndex(code) {
  const m = (code || "").match(/^ИД-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function placeholderHint(indicatorCode) {
  const idx = indicatorIndex(indicatorCode);
  const verb = PLACEHOLDER_VERBS[idx];
  return verb ? `${verb}… (требуется заполнение)` : "(требуется заполнение)";
}

function compareOutcomeRows(a, b) {
  const ac = (a.competency_code || "").trim();
  const bc = (b.competency_code || "").trim();
  if (ac !== bc) {
    if (!ac) return 1;
    if (!bc) return -1;
    const cmp = ac.localeCompare(bc, "ru", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp;
  }
  const ai = (a.indicator_code || "").trim();
  const bi = (b.indicator_code || "").trim();
  if (!ai && bi) return 1;
  if (ai && !bi) return -1;
  return ai.localeCompare(bi, "ru", { numeric: true, sensitivity: "base" });
}

function OutcomesEditorBase() {
  const { rpd, rpdId, isEdit, canEdit, canManageSources, reload, setOutcomesVisibleIds, setOutcomesCurrentBdId } = useRpdEditor();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const bds = rpd?.bup_disciplines || [];
  const isManual = bds.some(b => b.is_manual);
  const [currentBdId, setCurrentBdId] = useState(() => bds[0]?.id_bup_discipline || null);

  useEffect(() => {
    if (bds.length === 0) { setCurrentBdId(null); return; }
    if (!bds.some(b => b.id_bup_discipline === currentBdId)) {
      setCurrentBdId(bds[0].id_bup_discipline);
    }
  }, [bds, currentBdId]);

  useEffect(() => {
    setOutcomesCurrentBdId?.(currentBdId);
    return () => setOutcomesCurrentBdId?.(null);
  }, [currentBdId, setOutcomesCurrentBdId]);

  const reloadRows = useCallback(async () => {
    try {
      const r = await api.getOutcomesTable(rpdId, currentBdId);
      const data = [...(r.data || [])].sort(compareOutcomeRows);
      setRows(data);
      setOutcomesVisibleIds?.(data.map(x => x.id_outcome).filter(Boolean));
      setLoaded(true);
    } catch { setLoaded(true); }
  }, [rpdId, currentBdId, setOutcomesVisibleIds]);

  useEffect(() => {
    reloadRows();
  }, [reloadRows]);

  useEffect(() => () => setOutcomesVisibleIds?.(null), [setOutcomesVisibleIds]);

  const reloadRowsRef = useRef(reloadRows);
  useEffect(() => { reloadRowsRef.current = reloadRows; }, [reloadRows]);
  const tableWrapRef = useRef(null);
  const tableActiveRef = useRef(false);
  const reloadPendingRef = useRef(false);
  const reorderPendingRef = useRef(false);
  const pendingSavesRef = useRef(0);
  const prevUpdatedAt = useRef(rpd?.updated_at);
  useEffect(() => {
    if (!loaded) return;
    const curr = rpd?.updated_at;
    if (curr === prevUpdatedAt.current) return;
    prevUpdatedAt.current = curr;
    if (tableActiveRef.current || pendingSavesRef.current > 0) {
      reloadPendingRef.current = true;
      return;
    }
    reloadRowsRef.current();
  }, [rpd?.updated_at, loaded]);

  function flushReorder() {
    if (reloadPendingRef.current) {
      if (pendingSavesRef.current > 0 || tableActiveRef.current) return;
      reloadPendingRef.current = false;
      reorderPendingRef.current = false;
      reloadRowsRef.current();
    } else if (reorderPendingRef.current) {
      reorderPendingRef.current = false;
      setRows(prev => [...prev].sort(compareOutcomeRows));
    }
  }

  function maybeFlushDeferredReload() {
    if (pendingSavesRef.current > 0) return;
    if (!reloadPendingRef.current) return;
    if (tableActiveRef.current) return;
    reloadPendingRef.current = false;
    reorderPendingRef.current = false;
    reloadRowsRef.current();
  }
  function handleTableFocus() {
    tableActiveRef.current = true;
  }
  function handleTableBlur(e) {
    const wrap = tableWrapRef.current;
    const to = e.relatedTarget;
    const fromRow = e.target.closest ? e.target.closest("tr") : null;
    const toRow = (to && to.closest) ? to.closest("tr") : null;
    const stillInTable = !!(to && wrap && wrap.contains(to));
    if (!stillInTable) tableActiveRef.current = false;
    if (!toRow || toRow !== fromRow) setTimeout(flushReorder, 0);
  }

  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (autoAddedRef.current) return;
    if (!loaded || !isManual || !isEdit || !canEdit) return;
    if (rows.length > 0) return;
    autoAddedRef.current = true;
    addManualRow({});
  }, [loaded, isManual, isEdit, canEdit, rows.length]);

  async function saveRow(idx, patch) {
    const row = rows[idx];
    const next = { ...row, ...patch };
    setRows(prev => prev.map((r, i) => i === idx ? next : r));
    pendingSavesRef.current += 1;
    try {
      const isSnapshotPatch = "competency_code" in patch || "competency_name" in patch
        || "indicator_code" in patch || "indicator_description" in patch;
      if (isSnapshotPatch && row.id_outcome) {
        await api.patchOutcomeSnapshot(row.id_outcome, patch);
      } else {
        const r = await api.upsertOutcome(rpdId, {
          id_outcome: row.id_outcome || null,
          id_indicator: row.id_indicator || null,
          outcome_text: next.outcome_text || "",
          assessment_tool: next.assessment_tool || "",
        });
        const id_outcome = r.data.id_outcome || null;
        setRows(prev => prev.map((rr, i) => i === idx ? { ...rr, id_outcome } : rr));
      }
      const sortAffected = "competency_code" in patch || "indicator_code" in patch;
      if (sortAffected) reorderPendingRef.current = true;
      reload?.();
    } catch (e) {
      setRows(prev => prev.map((r, i) => i === idx ? row : r));
      setErrorMsg("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    } finally {
      pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
      maybeFlushDeferredReload();
    }
  }

  async function addManualRow(seed = {}) {
    try {
      const r = await api.addManualOutcome(rpdId, {
        id_indicator: seed.id_indicator || null,
        id_bup_discipline: currentBdId || null,
        competency_code: seed.competency_code || "",
        competency_name: seed.competency_name || "",
        indicator_code: seed.indicator_code || "",
        indicator_description: seed.indicator_description || "",
        outcome_text: "",
        assessment_tool: "",
      });
      await reloadRows();
      reload?.();
      return r.data;
    } catch (e) {
      setErrorMsg("Не удалось добавить строку: " + (e?.response?.data?.detail || e.message));
    }
  }

  async function performDelete(row) {
    if (!row?.id_outcome) return;
    try {
      await api.deleteOutcome(row.id_outcome);
      await reloadRows();
      reload?.();
    } catch (e) {
      setErrorMsg("Не удалось удалить: " + (e?.response?.data?.detail || e.message));
    }
  }
  function deleteRow(row) {
    if (!row.id_outcome) return;
    const hasFilledField = !!row.id_indicator
      || (row.competency_code || "").trim()
      || (row.competency_name || "").trim()
      || (row.indicator_code || "").trim()
      || (row.indicator_description || "").trim()
      || (row.outcome_text || "").trim()
      || (row.assessment_tool || "").trim();
    if (hasFilledField) { setPendingDelete(row); return; }
    performDelete(row);
  }
  function deleteById(id) {
    const row = rows.find(r => String(r.id_outcome) === String(id));
    if (row) deleteRow(row);
  }
  const tbodyRef = useRef(null);

  const usedIndicatorCodes = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const c = (r.indicator_code || "").trim().toLowerCase();
      if (c) s.add(c);
    }
    return s;
  }, [rows]);
  const fullCompetencies = useMemo(() => {
    const byComp = new Map();
    for (const r of rows) {
      const m = (r.indicator_code || "").trim().match(/^ИД-(\d+)(.+)$/i);
      if (!m) continue;
      const comp = m[2].trim().toLowerCase();
      if (!byComp.has(comp)) byComp.set(comp, new Set());
      byComp.get(comp).add(parseInt(m[1], 10));
    }
    const full = new Set();
    for (const [comp, idxs] of byComp) {
      if (idxs.has(1) && idxs.has(2) && idxs.has(3)) full.add(comp);
    }
    return full;
  }, [rows]);

  if (!loaded) return null;

  if (bds.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      РПД не привязана ни к одной БУП-дисциплине — раздел 2 заполнить нечем. Привязка задаётся при создании РПД.
    </div>;
  }

  const currentBd = bds.find(b => b.id_bup_discipline === currentBdId) || bds[0];
  const editable = isEdit && canEdit;
  const structuralEditing = editable && (isManual || canManageSources);

  const wrap = { wordBreak: "normal", overflowWrap: "break-word" };
  return <GenPlaque skey="learning_outcomes"><div>
    {bds.length > 1 && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0 }}>Дисциплина:</span>
        <BupDropdown
          bds={bds}
          value={currentBdId}
          onChange={setCurrentBdId}
          compact
          title="Переключить текущую БУП-дисциплину"
        />
      </div>
    )}
    {bds.length > 1 && currentBd && (currentBd.direction_code || currentBd.direction_name) && (
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
        {currentBd.direction_code || ""} {currentBd.direction_name || ""}
        {currentBd.direction_profile ? ` · ${currentBd.direction_profile}` : ""}
      </div>
    )}

    {rows.length === 0 && !isManual && (
      <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
        В разделе 2 нет ни одной строки.{structuralEditing
          ? " Добавьте компетенции из базы кнопкой ниже."
          : " Состав компетенций подтягивается из БУП и редактируется сотрудниками УМУ."}
      </div>
    )}

    {(rows.length > 0 || isManual) && (
    <div ref={tableWrapRef} onFocusCapture={handleTableFocus} onBlurCapture={handleTableBlur} style={{ position: "relative" }}>
    <div className="table-scroll">

    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
      <colgroup>
        <col style={{ width: "14%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "23%" }} />
        <col style={{ width: "17%" }} />
      </colgroup>
      <thead><tr>
        <th style={{ ...th, ...wrap }}>Компетенция</th>
        <th style={{ ...th, ...wrap }}>Индекс индикатора</th>
        <th style={{ ...th, ...wrap }}>Планируемые результаты обучения по дисциплине (знать, уметь, владеть)</th>
        <th style={{ ...th, ...wrap }}>Индикатор достижения компетенции, с которым соотнесены планируемые результаты обучения</th>
        <th style={{ ...th, ...wrap }}>Средства оценки</th>
      </tr></thead>
      <tbody ref={tbodyRef}>
        {rows.map((r, idx) => {
          const fromBase = !!r.id_indicator;
          const codeEditable = editable && (!fromBase || canManageSources);
          const descIsPlaceholder = isPlaceholderDescription(r.indicator_description);
          const descEditable = editable;
          const deletable = rows.length > 1;
          const trProps = (structuralEditing && r.id_outcome && deletable)
            ? { "data-trash-row": "", "data-trash-id": String(r.id_outcome) }
            : {};
          return <tr key={r.id_outcome || `ind-${r.id_indicator}` || `idx-${idx}`} {...trProps}>
            <td style={{ ...td, padding: codeEditable ? 4 : undefined, ...wrap }}>
              {codeEditable
                ? <SnapshotInput value={r.competency_code || ""} onSave={v => saveRow(idx, { competency_code: v })} placeholder="напр. ОПК-1" bold kind="competency_code" exclude={fullCompetencies} />
                : <b>{r.competency_code}</b>}
            </td>
            <td style={{ ...td, padding: codeEditable ? 4 : undefined, ...wrap }}>
              {codeEditable
                ? <SnapshotInput value={r.indicator_code || ""} onSave={v => saveRow(idx, { indicator_code: v })} placeholder="ОПК-1.1" kind="indicator_code" parent={r.competency_code || ""} exclude={usedIndicatorCodes} />
                : (r.indicator_code || "")}
            </td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <OutcomeTextarea
                value={r.outcome_text || ""}
                disabled={!editable}
                onSave={v => saveRow(idx, { outcome_text: v })}
              />
            </td>
            <td style={{ ...td, padding: descEditable ? 4 : undefined, ...wrap }}>
              {descEditable
                ? <SnapshotTextarea
                    value={descIsPlaceholder ? "" : (r.indicator_description || "")}
                    onSave={v => saveRow(idx, { indicator_description: v })}
                    placeholder={placeholderHint(r.indicator_code)}
                    parent={r.indicator_code || ""}
                    directionCode={currentBd?.direction_code || ""}
                  />
                : (descIsPlaceholder
                    ? <span style={{ color: T.textMuted, fontStyle: "italic" }}>{placeholderHint(r.indicator_code)}</span>
                    : (r.indicator_description || ""))}
            </td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <AssessmentToolPicker
                value={r.assessment_tool || ""}
                disabled={!editable}
                onSave={v => saveRow(idx, { assessment_tool: v })}
              />
            </td>
          </tr>;
        })}
      </tbody>
    </table>
    </div>
    {structuralEditing && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={deleteById} title="Удалить строку" />}
    </div>
    )}

    {structuralEditing && (
      <div style={{ marginTop: 8 }}>
        <CompetencyAdder
          onAdd={addManualRow}
          bdId={currentBdId}
          existingIndicatorIds={new Set(rows.map(r => r.id_indicator).filter(Boolean))}
          existingKeys={new Set(
            rows
              .map(r => `${(r.competency_code || "").trim().toLowerCase()}|${(r.indicator_code || "").trim().toLowerCase()}`)
              .filter(k => k !== "|")
          )}
        />
      </div>
    )}

    {pendingDelete && <ConfirmDeleteModal
      title="Удалить строку?"
      message="Строка содержит данные. После удаления восстановить её будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const r = pendingDelete; setPendingDelete(null); await performDelete(r); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div></GenPlaque>;
}

async function fetchKind(kind, q, source_type, direction_code) {
  const params = { q };
  if (source_type) params.source_type = source_type;
  if (direction_code) params.direction_code = direction_code;
  const r = await api.getSuggestions(kind, params);
  return r.data?.items || [];
}

function SnapshotInput({ value, onSave, placeholder, bold, kind, parent, exclude }) {
  const style = { width: "100%", minHeight: 48, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontWeight: bold ? 700 : 400, fontFamily: F, background: T.surface, outline: "none", boxSizing: "border-box" };
  return <Combobox
    value={value || ""}
    onCommit={v => { if (v !== (value || "")) onSave(v); }}
    fetchSuggestions={async (q) => {
      if (kind === "indicator_code" && !(parent || "").trim()) return [];
      const arr = await fetchKind(kind, q, parent);
      if (!exclude || !exclude.size) return arr;
      return (arr || []).filter(s => !exclude.has((s || "").trim().toLowerCase()));
    }}
    resetKey={`${kind}|${parent || ""}`}
    placeholder={placeholder}
    textarea
    collapsedMaxHeight={56}
    style={style}
  />;
}

function SnapshotTextarea({ value, onSave, placeholder, parent, directionCode }) {
  const style = { width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none", boxSizing: "border-box" };
  return <Combobox
    value={value || ""}
    onCommit={v => { if (v !== (value || "")) onSave(v); }}
    fetchSuggestions={(q) => (parent || "").trim() ? fetchKind("indicator_description", q, parent, directionCode) : []}
    resetKey={`${parent || ""}|${directionCode || ""}`}
    placeholder={placeholder}
    textarea
    collapsedMaxHeight={72}
    style={style}
  />;
}

function CompetencyAdder({ onAdd, existingIndicatorIds, existingKeys, bdId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [comps, setComps] = useState([]);
  const wrapRef = useRef(null);
  const existing = existingIndicatorIds || new Set();
  const existingKeySet = existingKeys || new Set();

  useEffect(() => {
    const p = bdId ? api.getCompetenciesByBupDiscipline(bdId) : api.getCompetencies();
    p.then(r => setComps(r.data || [])).catch(() => setComps([]));
  }, [bdId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const flat = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const c of comps) {
      for (const ind of (c.indicators || [])) {
        const key = `${(c.code || "").trim().toLowerCase()}|${(ind.code || "").trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id_indicator: ind.id_indicator,
          competency_code: c.code,
          competency_name: c.name,
          indicator_code: ind.code,
          indicator_description: ind.description,
        });
      }
    }
    return out;
  }, [comps]);

  const filtered = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(it => (
      (it.competency_code || "").toLowerCase().includes(q)
      || (it.competency_name || "").toLowerCase().includes(q)
      || (it.indicator_code || "").toLowerCase().includes(q)
      || (it.indicator_description || "").toLowerCase().includes(q)
    ));
  }, [flat, query]);

  return <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
    <Btn small onClick={() => setOpen(o => !o)}>
      <PlusIcon /> Добавить компетенцию
    </Btn>
    {open && (
      <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 4, zIndex: 20, width: 320, background: T.surface, border: "1px solid " + T.border, borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,.14)" }}>
        <div style={{ padding: 6, borderBottom: "1px solid " + T.borderLight }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск…"
            style={{ width: "100%", padding: "5px 8px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, fontFamily: F, boxSizing: "border-box", outline: "none" }}
          />
        </div>
        <div style={{ maxHeight: 130, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 8, fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>В базе ничего не нашлось.</div>
          )}
          {filtered.map(it => {
            const already = existing.has(it.id_indicator)
              || existingKeySet.has(`${(it.competency_code || "").trim().toLowerCase()}|${(it.indicator_code || "").trim().toLowerCase()}`);
            return <button
              key={`${it.competency_code}|${it.id_indicator}`}
              type="button"
              disabled={already}
              onClick={already ? undefined : async () => { setOpen(false); setQuery(""); await onAdd(it); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "transparent", cursor: already ? "not-allowed" : "pointer", fontFamily: F, fontSize: 11, color: already ? T.textMuted : T.text, lineHeight: 1.35, opacity: already ? 0.55 : 1 }}
              onMouseEnter={e => { if (!already) e.currentTarget.style.background = T.bg; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              title={already ? "Уже добавлено в таблицу" : (it.indicator_description || "")}
            >
              <div>
                <b>{it.competency_code}</b> · {it.indicator_code}
                {already && <span style={{ marginLeft: 6, fontSize: 10, color: T.textMuted, fontStyle: "italic" }}>уже добавлено</span>}
              </div>
              <div style={{ color: T.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.indicator_description}</div>
            </button>;
          })}
        </div>
        <div style={{ padding: 6, borderTop: "1px solid " + T.borderLight, background: T.bg }}>
          <Btn small onClick={async () => { setOpen(false); setQuery(""); await onAdd({}); }}>
            + Вручную (пустая строка)
          </Btn>
        </div>
      </div>
    )}
  </div>;
}

function OutcomeTextarea({ value, disabled, onSave }) {
  const [local, setLocal] = useState(value);
  const lastSyncedRef = useRef(value);
  useEffect(() => {
    if (local === lastSyncedRef.current) setLocal(value);
    lastSyncedRef.current = value;
  }, [value]);
  if (disabled) {
    return <div style={{ padding: "6px 8px", whiteSpace: "pre-wrap", fontSize: 13, color: T.text }}>{value || ""}</div>;
  }
  return <ExpandableTextarea
    value={local}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => { const t = local.trim(); if (t !== local) setLocal(t); if (t !== value) onSave(t); }}
    placeholder="Знать… / Уметь… / Владеть…"
    collapsedMaxHeight={72}
    style={{ width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none" }}
  />;
}

function AssessmentToolPicker({ value, disabled, onSave }) {
  if (disabled) {
    return <div style={{ padding: "6px 8px", fontSize: 13, color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value || ""}</div>;
  }
  return <Combobox
    value={value || ""}
    onCommit={v => { if (v !== value) onSave(v); }}
    fetchSuggestions={fetchAssessmentToolSuggestions}
    placeholder="Средство оценки"
    title="Средство оценки"
    textarea
    collapsedMaxHeight={72}
    style={{ width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none", boxSizing: "border-box" }}
  />;
}

export const OutcomesEditor = memo(OutcomesEditorBase);
