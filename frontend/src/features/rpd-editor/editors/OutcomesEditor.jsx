import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { BupDropdown } from "../BupDropdown.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { ConfirmDeleteModal, AlertModal } from "../EditorModals.jsx";

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

export function OutcomesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [rows, setRows] = useState([]);
  const [tools, setTools] = useState([]);
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

  const reloadRows = useCallback(async () => {
    try {
      const r = await api.getOutcomesTable(rpdId, currentBdId);
      setRows([...(r.data || [])].sort(compareOutcomeRows));
      setLoaded(true);
    } catch { setLoaded(true); }
  }, [rpdId, currentBdId]);

  useEffect(() => {
    reloadRows();
    api.getAssessmentTools().then(r => setTools(r.data)).catch(() => setTools([]));
  }, [reloadRows]);

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
      if (sortAffected) setRows(prev => [...prev].sort(compareOutcomeRows));
      reload?.();
    } catch (e) {
      setRows(prev => prev.map((r, i) => i === idx ? row : r));
      setErrorMsg("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
  }

  async function addManualRow(seed = {}) {
    try {
      const r = await api.addManualOutcome(rpdId, {
        id_indicator: seed.id_indicator || null,
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

  if (!loaded) return null;

  if (bds.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      РПД не привязана ни к одной БУП-дисциплине — раздел 2 заполнить нечем. Привязка задаётся при создании РПД.
    </div>;
  }

  const currentBd = bds.find(b => b.id_bup_discipline === currentBdId) || bds[0];
  const editable = isEdit && canEdit;

  const wrap = { wordBreak: "normal", overflowWrap: "break-word" };
  return <div>
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
        У выбранной БУП-дисциплины ({currentBd.code || "—"}, БУП «{currentBd.bup_name || "—"}») в базе нет привязанных компетенций или у её компетенций не заполнены индикаторы.{editable ? " Добавьте строки вручную или из базы кнопкой ниже." : ""}
      </div>
    )}

    {(rows.length > 0 || isManual) && (
    <div style={{ position: "relative" }}>
    <div className="table-scroll">

    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
      <colgroup>
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "20%" }} />
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
          const codeEditable = editable && !fromBase;
          const trProps = (editable && r.id_outcome)
            ? { "data-trash-row": "", "data-trash-id": String(r.id_outcome) }
            : {};
          return <tr key={r.id_outcome || `ind-${r.id_indicator}` || `idx-${idx}`} {...trProps}>
            <td style={{ ...td, padding: codeEditable ? 4 : undefined, ...wrap }}>
              {codeEditable
                ? <SnapshotInput value={r.competency_code || ""} onSave={v => saveRow(idx, { competency_code: v })} placeholder="напр. ОПК-1" bold />
                : <b>{r.competency_code}</b>}
            </td>
            <td style={{ ...td, padding: codeEditable ? 4 : undefined, ...wrap }}>
              {codeEditable
                ? <SnapshotInput value={r.indicator_code || ""} onSave={v => saveRow(idx, { indicator_code: v })} placeholder="ОПК-1.1" />
                : (r.indicator_code || "")}
            </td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <OutcomeTextarea
                value={r.outcome_text || ""}
                disabled={!editable}
                onSave={v => saveRow(idx, { outcome_text: v })}
              />
            </td>
            <td style={{ ...td, padding: codeEditable ? 4 : undefined, ...wrap }}>
              {codeEditable
                ? <SnapshotTextarea value={r.indicator_description || ""} onSave={v => saveRow(idx, { indicator_description: v })} placeholder="Описание индикатора достижения компетенции" />
                : (r.indicator_description || "")}
            </td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <AssessmentToolPicker
                value={r.assessment_tool || ""}
                tools={tools}
                disabled={!editable}
                onSave={v => saveRow(idx, { assessment_tool: v })}
              />
            </td>
          </tr>;
        })}
      </tbody>
    </table>
    </div>
    {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={deleteById} title="Удалить строку" />}
    </div>
    )}

    {editable && (
      <div style={{ marginTop: 8 }}>
        <CompetencyAdder onAdd={addManualRow} />
      </div>
    )}

    {pendingDelete && <ConfirmDeleteModal
      title="Удалить строку?"
      message="Строка содержит данные. После удаления восстановить её будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const r = pendingDelete; setPendingDelete(null); await performDelete(r); }}
    />}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

function SnapshotInput({ value, onSave, placeholder, bold }) {
  const [local, setLocal] = useState(value);
  const lastSyncedRef = useRef(value);
  useEffect(() => {
    if (local === lastSyncedRef.current) setLocal(value);
    lastSyncedRef.current = value;
  }, [value]);
  return <input
    value={local}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => { if (local !== value) onSave(local); }}
    placeholder={placeholder}
    style={{ width: "100%", padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontWeight: bold ? 700 : 400, fontFamily: F, background: T.surface, outline: "none", boxSizing: "border-box" }}
  />;
}

function SnapshotTextarea({ value, onSave, placeholder }) {
  const [local, setLocal] = useState(value);
  const lastSyncedRef = useRef(value);
  useEffect(() => {
    if (local === lastSyncedRef.current) setLocal(value);
    lastSyncedRef.current = value;
  }, [value]);
  return <ExpandableTextarea
    value={local}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => { if (local !== value) onSave(local); }}
    placeholder={placeholder}
    collapsedMaxHeight={64}
    style={{ width: "100%", minHeight: 48, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none", boxSizing: "border-box" }}
  />;
}

function CompetencyAdder({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [comps, setComps] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => {
    api.getCompetencies().then(r => setComps(r.data || [])).catch(() => setComps([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const flat = useMemo(() => {
    const out = [];
    for (const c of comps) {
      for (const ind of (c.indicators || [])) {
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
          {filtered.map(it => (
            <button
              key={`${it.competency_code}|${it.id_indicator}`}
              type="button"
              onClick={async () => { setOpen(false); setQuery(""); await onAdd(it); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "transparent", cursor: "pointer", fontFamily: F, fontSize: 11, color: T.text, lineHeight: 1.35 }}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              title={it.indicator_description || ""}
            >
              <div><b>{it.competency_code}</b> · {it.indicator_code}</div>
              <div style={{ color: T.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.indicator_description}</div>
            </button>
          ))}
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
    onBlur={() => { if (local !== value) onSave(local); }}
    placeholder="Знать… / Уметь… / Владеть…"
    collapsedMaxHeight={72}
    style={{ width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, outline: "none" }}
  />;
}

function AssessmentToolPicker({ value, tools, disabled, onSave }) {
  if (disabled) {
    return <div style={{ padding: "6px 8px", fontSize: 13, color: T.text }}>{value || ""}</div>;
  }

  const options = tools.map(t => ({ value: t.name, label: t.name }));
  return <Dropdown
    value={value || ""}
    options={options}
    onChange={v => { if (v !== value) onSave(v); }}
    placeholder="Выбрать средство оценки"
    clearLabel="Не выбрано"
    title="Средство оценки"
  />;
}
