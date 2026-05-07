import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { Modal } from "../../components/Modal.jsx";
import { Btn } from "../../components/Btn.jsx";
import { Input } from "../../components/Input.jsx";
import { MultiSelectDropdown } from "../../components/MultiSelectDropdown.jsx";
import { RowTrashOverlay } from "../../components/RowTrashOverlay.jsx";
import { PlusIcon } from "../../components/icons.jsx";

const CONTROL_OPTIONS = ["экзамен", "зачёт", "диф. зачет", "курсовой проект", "курсовая работа"];
const EXAM_DEFAULT = 36;
const DRAFT_KEY = "createRpdDraft.v1";

function emptySemester(number) {
  return { number, lecture: 0, lab: 0, practice: 0, ksr: 0, srs: 0, exam: 0, controls: [] };
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : null;
  } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

export function CreateRpdModal({ onClose, onCreated }) {
  const draft = useRef(loadDraft()).current;

  const [mode, setMode] = useState(draft?.mode ?? "bup");

  const [disciplines, setDisciplines] = useState([]);
  const [discFilter, setDiscFilter] = useState(draft?.discFilter ?? "");
  const [discId, setDiscId] = useState(draft?.discId ?? null);

  const [bupDisciplines, setBupDisciplines] = useState([]);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdIds, setBdIds] = useState(new Set(Array.isArray(draft?.bdIds) ? draft.bdIds : []));

  const [manualDisciplines, setManualDisciplines] = useState([]);
  const [discQuery, setDiscQuery] = useState(draft?.discQuery ?? "");
  const [discPickedId, setDiscPickedId] = useState(draft?.discPickedId ?? null);
  const [discListOpen, setDiscListOpen] = useState(false);
  const discWrapRef = useRef(null);

  const [manual, setManual] = useState(draft?.manual ?? {
    direction_code: "", direction_name: "", direction_profile: "",
    zet: 0, exam_hours: 0, form_of_study: "",
  });
  const [manualSemesters, setManualSemesters] = useState(
    Array.isArray(draft?.manualSemesters) && draft.manualSemesters.length > 0
      ? draft.manualSemesters
      : [emptySemester(1)]
  );

  const [archiveRpds, setArchiveRpds] = useState([]);
  const [year, setYear] = useState(draft?.year ?? "2025/2026");
  const [baseId, setBaseId] = useState(draft?.baseId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorPulse, setErrorPulse] = useState(0);
  const [pulseSnapshot, setPulseSnapshot] = useState(null);
  const pulseTimerRef = useRef(null);

  useEffect(() => () => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
  }, []);

  const semTbodyRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        mode,
        discFilter, discId,
        bdIds: Array.from(bdIds),
        discQuery, discPickedId,
        manual, manualSemesters,
        year, baseId,
      }));
    } catch {}
  }, [mode, discFilter, discId, bdIds, discQuery, discPickedId, manual, manualSemesters, year, baseId]);

  function discardAndClose() {
    clearDraft();
    onClose();
  }

  useEffect(() => {
    api.getDisciplines().then(r => setDisciplines(r.data || [])).catch(() => setDisciplines([]));
    api.getDisciplines({ include_unbound: true }).then(r => setManualDisciplines(r.data || [])).catch(() => setManualDisciplines([]));
    api.getRpds({ status: "Согласовано" }).then(r => setArchiveRpds(r.data || [])).catch(() => {});
  }, []);

  const initialDiscEffectRef = useRef(true);
  useEffect(() => {
    const initial = initialDiscEffectRef.current;
    initialDiscEffectRef.current = false;
    if (!discId) { setBupDisciplines([]); if (!initial) setBdIds(new Set()); return; }
    setBdLoading(true);
    if (!initial) setBdIds(new Set());
    api.getBupDisciplinesByDiscipline(discId)
      .then(r => setBupDisciplines(r.data || []))
      .catch(() => setBupDisciplines([]))
      .finally(() => setBdLoading(false));
  }, [discId]);

  useEffect(() => {
    if (!discListOpen) return;
    const onDocClick = (e) => {
      if (discWrapRef.current && discWrapRef.current.contains(e.target)) return;
      setDiscListOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [discListOpen]);

  const filteredDisciplines = useMemo(() => {
    if (!discFilter.trim()) return disciplines;
    const q = discFilter.toLowerCase();
    return disciplines.filter(d => (d.name || "").toLowerCase().includes(q));
  }, [disciplines, discFilter]);

  const filteredManualDisciplines = useMemo(() => {
    if (!discQuery.trim()) return manualDisciplines;
    const q = discQuery.toLowerCase();
    return manualDisciplines.filter(d => (d.name || "").toLowerCase().includes(q));
  }, [manualDisciplines, discQuery]);

  const exactMatch = useMemo(() => {
    const q = discQuery.trim().toLowerCase();
    if (!q) return null;
    return manualDisciplines.find(d => (d.name || "").toLowerCase() === q) || null;
  }, [discQuery, manualDisciplines]);

  function pickDisc(d) {
    setDiscPickedId(d.id_discipline);
    setDiscQuery(d.name);
    setDiscListOpen(false);
  }
  function onDiscQueryChange(v) {
    setDiscQuery(v);
    if (discPickedId) setDiscPickedId(null);
    setDiscListOpen(true);
  }

  function toggleBd(id) {
    setBdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllBd() {
    setBdIds(prev => prev.size === bupDisciplines.length ? new Set() : new Set(bupDisciplines.map(b => b.id_bup_discipline)));
  }

  const PARAM_LABELS = {
    total_hours: "общие часы",
    lecture_hours: "часы лекций",
    practice_hours: "часы практик",
    lab_hours: "часы лабораторных",
    ksr_hours: "часы КСР",
    self_study_hours: "часы СРС",
    zet: "ЗЕ",
    semester: "семестр",
    control_form: "форма контроля",
  };
  const selectedBds = useMemo(
    () => bupDisciplines.filter(b => bdIds.has(b.id_bup_discipline)),
    [bupDisciplines, bdIds]
  );
  const mismatch = useMemo(() => {
    if (selectedBds.length < 2) return null;
    const ref = selectedBds[0];
    for (const bd of selectedBds.slice(1)) {
      for (const [key, label] of Object.entries(PARAM_LABELS)) {
        if (bd[key] !== ref[key]) {
          return { label, a: ref[key], b: bd[key] };
        }
      }
    }
    return null;
  }, [selectedBds]);

  const manualHasDiscipline = !!discPickedId || !!discQuery.trim();

  function setSemester(idx, patch) {
    setManualSemesters(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, ...patch };
      if (patch.controls !== undefined) {
        const hasExam = (next.controls || []).includes("экзамен");
        const hadExam = (s.controls || []).includes("экзамен");
        if (hasExam && !hadExam && (!next.exam || next.exam === 0)) next.exam = EXAM_DEFAULT;
        if (!hasExam) next.exam = 0;
      }
      return next;
    }));
  }
  function addSemester() {
    setManualSemesters(prev => {
      const used = new Set(prev.map(s => s.number));
      let next = 1;
      for (let i = 1; i <= 12; i++) { if (!used.has(i)) { next = i; break; } if (i === 12) next = (prev[prev.length - 1]?.number || 0) + 1; }
      return [...prev, emptySemester(next)];
    });
  }
  function removeSemester(idx) {
    setManualSemesters(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  const sums = useMemo(() => {
    const r = { lec: 0, lab: 0, pr: 0, ksr: 0, srs: 0, exam: 0 };
    for (const s of manualSemesters) {
      r.lec += +s.lecture || 0;
      r.lab += +s.lab || 0;
      r.pr += +s.practice || 0;
      r.ksr += +s.ksr || 0;
      r.srs += +s.srs || 0;
      if ((s.controls || []).includes("экзамен")) r.exam += +s.exam || 0;
    }
    r.aud = r.lec + r.lab + r.pr + r.ksr + r.srs;
    return r;
  }, [manualSemesters]);

  const totalTarget = (+manual.zet || 0) * 36;
  const examTarget = +manual.exam_hours || 0;
  const totalMismatch = totalTarget > 0 && totalTarget !== sums.aud;
  const examMismatch = examTarget !== sums.exam;

  const manualFieldIssues = useMemo(() => {
    if (mode !== "manual") return null;
    const semIssues = manualSemesters.map(s => ({
      number: s.number,
      noControl: !(s.controls || []).length,
      examMissingHours: (s.controls || []).includes("экзамен") && !(+s.exam > 0),
    }));
    return {
      discipline: !manualHasDiscipline,
      direction_code: !manual.direction_code.trim(),
      direction_name: !manual.direction_name.trim(),
      direction_profile: !manual.direction_profile.trim(),
      form_of_study: !manual.form_of_study,
      zet: !(+manual.zet > 0),
      no_semesters: manualSemesters.length === 0,
      semesters: semIssues,
      hours_mismatch: totalMismatch || examMismatch,
    };
  }, [mode, manualHasDiscipline, manual, manualSemesters, totalMismatch, examMismatch]);

  const manualHasErrors = useMemo(() => {
    if (!manualFieldIssues) return false;
    const f = manualFieldIssues;
    if (f.discipline || f.direction_code || f.direction_name || f.direction_profile
        || f.form_of_study || f.zet || f.no_semesters || f.hours_mismatch) return true;
    return f.semesters.some(s => s.noControl || s.examMissingHours);
  }, [manualFieldIssues]);

  const bupFieldIssues = useMemo(() => {
    if (mode !== "bup") return null;
    return {
      bupDiscipline: !discId,
      bdSelection: !!discId && (bdIds.size === 0 || !!mismatch),
    };
  }, [mode, discId, bdIds, mismatch]);

  const bupHasErrors = !!bupFieldIssues && (bupFieldIssues.bupDiscipline || bupFieldIssues.bdSelection);

  const flashField = (key) => !!pulseSnapshot?.[key];
  const flashSemControl = (idx) => !!pulseSnapshot?.semesters?.[idx]?.noControl;
  const flashSemExam = (idx) => !!pulseSnapshot?.semesters?.[idx]?.examMissingHours;

  function buildControlForm(sems) {
    const groups = new Map();
    for (const s of sems) {
      for (const c of (s.controls || [])) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(s.number);
      }
    }
    const parts = [];
    for (const [label, nums] of groups) {
      const sorted = [...new Set(nums)].sort((a, b) => a - b);
      parts.push(`${label} (${sorted.join(", ")})`);
    }
    return parts.join(", ");
  }
  function num(v) {
    if (v === "" || v == null) return null;
    const n = +v;
    return Number.isFinite(n) ? n : null;
  }
  function manualField(key, value) {
    setManual(p => ({ ...p, [key]: value }));
  }

  async function go() {
    if (mode === "manual" && manualHasErrors) {
      setErrorPulse(p => p + 1);
      setPulseSnapshot(manualFieldIssues);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setPulseSnapshot(null), 2200);
      return;
    }
    if (mode === "bup" && bupHasErrors) {
      setErrorPulse(p => p + 1);
      setPulseSnapshot(bupFieldIssues);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setPulseSnapshot(null), 2200);
      return;
    }
    setSubmitting(true);
    try {
      let payload;
      if (mode === "bup") {
        payload = {
          bup_discipline_ids: Array.from(bdIds),
          academic_year: year,
          based_on_rpd_id: baseId ? +baseId : null,
        };
      } else {
        const sortedSems = [...manualSemesters].sort((a, b) => a.number - b.number);
        const semesterStr = sortedSems.map(s => s.number).join(", ");
        const semesters_data = sortedSems.map(s => ({
          number: s.number,
          lecture: +s.lecture || 0,
          lab: +s.lab || 0,
          practice: +s.practice || 0,
          ksr: +s.ksr || 0,
          srs: +s.srs || 0,
        }));
        payload = {
          academic_year: year,
          based_on_rpd_id: baseId ? +baseId : null,
          manual: {
            id_discipline: discPickedId || null,
            discipline_name: discPickedId ? null : discQuery.trim(),
            direction_code: manual.direction_code.trim() || null,
            direction_name: manual.direction_name.trim() || null,
            direction_profile: manual.direction_profile.trim() || null,
            semester: semesterStr,
            control_form: buildControlForm(sortedSems) || null,
            total_hours: totalTarget || sums.aud,
            exam_hours: num(manual.exam_hours) ?? sums.exam,
            lecture_hours: sums.lec,
            lab_hours: sums.lab,
            practice_hours: sums.pr,
            ksr_hours: sums.ksr,
            self_study_hours: sums.srs,
            zet: num(manual.zet),
            semesters_data,
            form_of_study: (manual.form_of_study || "").trim() || null,
          },
        };
      }
      const r = await api.createRpd(payload);
      clearDraft();
      onCreated(r.data);
    } catch (e) {
      alert("Не удалось создать РПД: " + (e?.response?.data?.detail || e.message));
    }
    setSubmitting(false);
  }

  const labelStyle = { fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 };
  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid " + T.border, borderRadius: 6, fontSize: 13, fontFamily: F, boxSizing: "border-box" };

  return <Modal onClose={onClose} width={880}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.borderLight }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Создание РПД</div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <ModeButton active={mode === "bup"} onClick={() => setMode("bup")}>
          Из БУПа
        </ModeButton>
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
          Вручную (без БУПа)
        </ModeButton>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10, lineHeight: 1.45 }}>
        {mode === "bup"
          ? "Сначала выбирается дисциплина, затем — БУПы, в которых она читается. Один макет покрывает все выбранные БУП-инстансы."
          : "Без привязки к БУПу. Все мета-параметры (направление, профиль, форма обучения, часы, семестры, контроль) задаются здесь и после создания не редактируются. Преподаватель далее заполняет содержательные разделы и компетенции."}
      </div>
    </div>

    <div style={{ padding: 20 }}>
      <Input label="Учебный год" value={year} onChange={e => setYear(e.target.value)} />

      {mode === "bup" && <>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>
            Дисциплина <span style={{ color: T.red }}>*</span>
          </label>
          <input
            value={discFilter}
            onChange={e => setDiscFilter(e.target.value)}
            placeholder="Поиск по названию или направлению…"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <div key={errorPulse} className={flashField("bupDiscipline") ? "err-flash" : ""} style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 200, overflow: "auto", background: T.surface }} title="Обязательное поле">
            {filteredDisciplines.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
                {disciplines.length === 0 ? "Дисциплин пока нет — попросите администратора загрузить XLS-файл БУПа." : "Ничего не нашлось."}
              </div>
            )}
            {filteredDisciplines.map(d => {
              const picked = d.id_discipline === discId;
              return <button
                key={d.id_discipline}
                type="button"
                onClick={() => setDiscId(d.id_discipline)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", border: "none", borderBottom: "1px solid " + T.borderLight,
                  background: picked ? T.accentLight : "transparent",
                  cursor: "pointer", fontFamily: F, fontSize: 13,
                  color: picked ? T.accent : T.text, fontWeight: picked ? 600 : 400,
                }}
              >
                {d.name}
              </button>;
            })}
          </div>
        </div>

        {discId && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                БУП-дисциплины (выберите одну или несколько) <span style={{ color: T.red }}>*</span>
              </label>
              <div style={{ flex: 1 }} />
              {bupDisciplines.length > 0 && (
                <button type="button" onClick={toggleAllBd}
                  style={{ border: "none", background: "none", color: T.accent, cursor: "pointer", fontSize: 12, fontFamily: F, padding: 0 }}>
                  {bdIds.size === bupDisciplines.length ? "Снять все" : "Выбрать все"}
                </button>
              )}
            </div>
            <div key={errorPulse} className={flashField("bdSelection") ? "err-flash" : ""} style={{ border: "1px solid " + T.border, borderRadius: 6, maxHeight: 240, overflow: "auto", background: T.surface }} title="Обязательное поле">
              {bdLoading && <div style={{ padding: 14, fontSize: 13, color: T.textMuted }}>Загружаю…</div>}
              {!bdLoading && bupDisciplines.length === 0 && (
                <div style={{ padding: 14, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
                  Эта дисциплина не встречается ни в одном БУПе. Попросите администратора загрузить соответствующий БУП.
                </div>
              )}
              {!bdLoading && bupDisciplines.map(bd => {
                const checked = bdIds.has(bd.id_bup_discipline);
                const bupTitle = `${bd.bup_year ? bd.bup_year + " " : ""}${bd.bup_name || "БУП"}`;
                return <label key={bd.id_bup_discipline}
                  style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + T.borderLight, cursor: "pointer", background: checked ? T.accentLight : "transparent" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleBd(bd.id_bup_discipline)} style={{ marginTop: 3 }} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div><b>{bupTitle}</b>{bd.code ? ` · ${bd.code}` : ""}</div>
                    <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
                      {bd.direction_code ? `${bd.direction_code} ${bd.direction_name || ""}` : ""}
                      {bd.bup_profile ? ` · ${bd.bup_profile}` : ""}
                      {bd.bup_form_of_study ? ` · ${bd.bup_form_of_study}` : ""}
                      {bd.semester ? ` · сем. ${bd.semester}` : ""}
                      {bd.control_form ? ` · ${bd.control_form}` : ""}
                      {bd.total_hours != null ? ` · ${bd.total_hours} ч` : ""}
                      {bd.zet != null ? ` · ${bd.zet} ЗЕ` : ""}
                    </div>
                  </div>
                </label>;
              })}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Выбрано: {bdIds.size}</div>
            {mismatch && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#fde8e8", border: "1px solid " + T.red, borderRadius: 4, fontSize: 12, color: T.red, lineHeight: 1.4 }}>
                У выбранных БУПов различается «{mismatch.label}» ({mismatch.a ?? "—"} ≠ {mismatch.b ?? "—"}). Один макет РПД покрывает только БУПы с одинаковой нагрузкой — для разной нагрузки создайте отдельные РПД (можно скопировать содержимое через «На основе архивной» ниже).
              </div>
            )}
          </div>
        )}
      </>}

      {mode === "manual" && <>
        <div ref={discWrapRef} style={{ marginBottom: 14, position: "relative" }}>
          <label style={labelStyle}>
            Дисциплина <span style={{ color: T.red }}>*</span>
          </label>
          <div key={errorPulse} className={flashField("discipline") ? "err-flash" : ""} style={{ borderRadius: 4 }}>
            <input
              value={discQuery}
              onChange={e => onDiscQueryChange(e.target.value)}
              onFocus={() => setDiscListOpen(true)}
              placeholder="Введите название или выберите из списка"
              title="Обязательное поле"
              style={inputStyle}
            />
          </div>
          {discListOpen && (
            <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, zIndex: 10, border: "1px solid " + T.border, borderRadius: 6, background: T.surface, boxShadow: "0 4px 14px rgba(0,0,0,.10)", maxHeight: 200, overflow: "auto" }}>
              {filteredManualDisciplines.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
                  В базе ничего не нашлось — после сохранения будет создана новая дисциплина с этим названием.
                </div>
              )}
              {filteredManualDisciplines.map(d => {
                const picked = d.id_discipline === discPickedId;
                return <button
                  key={d.id_discipline}
                  type="button"
                  onClick={() => pickDisc(d)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", border: "none", borderBottom: "1px solid " + T.borderLight,
                    background: picked ? T.accentLight : "transparent",
                    cursor: "pointer", fontFamily: F, fontSize: 13,
                    color: picked ? T.accent : T.text, fontWeight: picked ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!picked) e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={e => { if (!picked) e.currentTarget.style.background = "transparent"; }}
                >
                  {d.name}
                </button>;
              })}
            </div>
          )}
          {discQuery.trim() && (
            <div style={{ fontSize: 11, color: discPickedId ? T.accent : (exactMatch ? T.accent : T.textMuted), marginTop: 4 }}>
              {discPickedId
                ? "Выбрана существующая дисциплина из базы"
                : exactMatch
                  ? "Будет использована существующая дисциплина с тем же названием"
                  : "Будет создана новая дисциплина с этим названием"}
            </div>
          )}
        </div>

        <ManualBlock title="Направление подготовки">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <ManualField label="Код" required flash={flashField("direction_code")} pulseKey={errorPulse} value={manual.direction_code} onChange={v => manualField("direction_code", v)} placeholder="09.03.04" width={120} />
            <ManualField label="Название" required flash={flashField("direction_name")} pulseKey={errorPulse} value={manual.direction_name} onChange={v => manualField("direction_name", v)} placeholder="Программная инженерия" />
          </div>
          <ManualField label="Профиль" required flash={flashField("direction_profile")} pulseKey={errorPulse} value={manual.direction_profile} onChange={v => manualField("direction_profile", v)} placeholder="—" />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 220px", minWidth: 200 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>
                Форма обучения <span style={{ color: T.red }}>*</span>
              </div>
              <div key={errorPulse} className={flashField("form_of_study") ? "err-flash" : ""} style={{ borderRadius: 4 }}>
                <select
                  value={manual.form_of_study || ""}
                  onChange={e => manualField("form_of_study", e.target.value)}
                  title="Обязательное поле"
                  style={{ width: "100%", padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, background: T.surface, boxSizing: "border-box", outline: "none" }}
                >
                  <option value="">— не указана —</option>
                  <option value="очная">очная</option>
                  <option value="заочная">заочная</option>
                  <option value="очно-заочная">очно-заочная</option>
                </select>
              </div>
            </div>
          </div>
        </ManualBlock>

        <ManualBlock title="Общая трудоёмкость дисциплины">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ManualField label="ЗЕ" required flash={flashField("zet")} pulseKey={errorPulse} type="number" min={0} value={manual.zet} onChange={v => manualField("zet", v)} width={120} />
            <div style={{ flex: "0 0 200px", minWidth: 180 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Общая трудоёмкость (часы)</div>
              <div style={{ padding: "6px 10px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, background: T.bg, color: totalTarget > 0 ? T.text : T.textMuted, fontStyle: totalTarget > 0 ? "normal" : "italic", boxSizing: "border-box", lineHeight: "16px" }}>
                {totalTarget > 0 ? `${totalTarget} ч` : "укажите ЗЕ"}
              </div>
            </div>
            <ManualField label="Часы экзамена (всего)" type="number" min={0} step={EXAM_DEFAULT} value={manual.exam_hours} onChange={v => manualField("exam_hours", v)} width={190} />
          </div>
        </ManualBlock>

        <ManualBlock title="Семестры дисциплины">
          <div style={{ position: "relative" }}>
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 580 }}>
              <colgroup>
                <col style={{ width: 56 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 32 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={semHeadCell}>Сем.</th>
                  <th style={semHeadCell}>Лек</th>
                  <th style={semHeadCell}>Лаб</th>
                  <th style={semHeadCell}>ПЗ</th>
                  <th style={semHeadCell}>КСР</th>
                  <th style={semHeadCell}>СРС</th>
                  <th style={semHeadCell}>Итого</th>
                  <th style={semHeadCell}>Экзамен (ч)</th>
                  <th style={{ ...semHeadCell, textAlign: "left" }}>Контроль</th>
                  <th style={semHeadCell}></th>
                </tr>
              </thead>
              <tbody ref={semTbodyRef}>
                {manualSemesters.map((s, idx) => {
                  const itog = (+s.lecture || 0) + (+s.lab || 0) + (+s.practice || 0) + (+s.ksr || 0) + (+s.srs || 0);
                  const hasExam = (s.controls || []).includes("экзамен");
                  const trashable = manualSemesters.length > 1;
                  const trProps = trashable ? { "data-trash-row": "", "data-trash-id": String(idx) } : {};
                  const controlFlash = flashSemControl(idx);
                  const examFlash = flashSemExam(idx);
                  return <tr key={idx} {...trProps}>
                    <td style={semCell}><HourInput value={s.number} min={1} max={12} onChange={v => setSemester(idx, { number: Math.max(1, Math.min(12, +v || 1)) })} /></td>
                    <td style={semCell}><HourInput value={s.lecture} onChange={v => setSemester(idx, { lecture: v })} /></td>
                    <td style={semCell}><HourInput value={s.lab} onChange={v => setSemester(idx, { lab: v })} /></td>
                    <td style={semCell}><HourInput value={s.practice} onChange={v => setSemester(idx, { practice: v })} /></td>
                    <td style={semCell}><HourInput value={s.ksr} onChange={v => setSemester(idx, { ksr: v })} /></td>
                    <td style={semCell}><HourInput value={s.srs} onChange={v => setSemester(idx, { srs: v })} /></td>
                    <td style={{ ...semCell, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{itog}</td>
                    <td style={semCell}>
                      {hasExam
                        ? <HourInput value={s.exam} step={EXAM_DEFAULT} flash={examFlash} pulseKey={errorPulse} title="Укажите часы экзамена (обязательно)" onChange={v => setSemester(idx, { exam: v })} />
                        : <div style={{ textAlign: "center", color: T.textMuted, fontSize: 12 }}>—</div>}
                    </td>
                    <td style={semCell}>
                      <div key={errorPulse} className={controlFlash ? "err-flash" : ""} style={{ borderRadius: 4 }} title="Выберите хотя бы одну форму контроля (обязательно)">
                        <MultiSelectDropdown
                          value={s.controls}
                          options={CONTROL_OPTIONS}
                          onChange={(v) => setSemester(idx, { controls: v })}
                          placeholder="—"
                        />
                      </div>
                    </td>
                    <td style={semCell}></td>
                  </tr>;
                })}
                <tr>
                  <td style={{ ...semCell, fontWeight: 700, textAlign: "right", color: T.textMuted, background: T.surface }}>Сумма</td>
                  <td style={totalCell(false)}>{sums.lec}</td>
                  <td style={totalCell(false)}>{sums.lab}</td>
                  <td style={totalCell(false)}>{sums.pr}</td>
                  <td style={totalCell(false)}>{sums.ksr}</td>
                  <td style={totalCell(false)}>{sums.srs}</td>
                  <td style={totalCell(totalMismatch)} title={totalMismatch ? `Не совпадает с «Общая трудоёмкость» (${totalTarget} ч)` : ""}>{sums.aud}</td>
                  <td style={totalCell(examMismatch)} title={examMismatch ? `Не совпадает с «Часы экзамена (всего)» (${examTarget} ч)` : ""}>{sums.exam}</td>
                  <td style={{ ...semCell, background: T.surface }}></td>
                  <td style={{ ...semCell, background: T.surface }}></td>
                </tr>
              </tbody>
            </table>
          </div>
          {manualSemesters.length > 1 && (
            <RowTrashOverlay
              tbodyRef={semTbodyRef}
              onDelete={(id) => removeSemester(parseInt(id, 10))}
              title="Удалить семестр"
              right={4}
            />
          )}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn small onClick={addSemester} disabled={manualSemesters.length >= 12}>
              <PlusIcon /> Добавить семестр
            </Btn>
          </div>
        </ManualBlock>
      </>}

      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>На основе архивной РПД (необязательно)</label>
        <select value={baseId} onChange={e => setBaseId(e.target.value)} style={inputStyle}>
          <option value="">— Не копировать —</option>
          {archiveRpds.map(r => <option key={r.id_rpd} value={r.id_rpd}>{r.discipline_name} ({r.academic_year})</option>)}
        </select>
      </div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid " + T.borderLight }}>
      <div style={{ flex: 1 }} />
      <Btn primary onClick={go} disabled={submitting}>{submitting ? "Создание…" : "Создать"}</Btn>
      <Btn onClick={discardAndClose}>Закрыть</Btn>
    </div>
  </Modal>;
}

function ModeButton({ active, onClick, children }) {
  return <button
    type="button"
    onClick={onClick}
    style={{
      padding: "7px 14px",
      border: "1px solid " + (active ? T.accent : T.border),
      borderRadius: 6,
      background: active ? T.accentLight : T.surface,
      color: active ? T.accent : T.text,
      fontWeight: active ? 600 : 500,
      fontSize: 13,
      fontFamily: F,
      cursor: "pointer",
    }}
  >
    {children}
  </button>;
}

function ManualBlock({ title, children }) {
  return <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid " + T.borderLight, borderRadius: 6, background: T.bg }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{title}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
  </div>;
}

function ManualField({ label, value, onChange, placeholder, type, width, min, step, required, flash, pulseKey }) {
  const style = {
    width: "100%",
    padding: "6px 10px",
    border: "1px solid " + T.border,
    borderRadius: 4,
    fontSize: 13, fontFamily: F,
    background: T.surface,
    boxSizing: "border-box",
    outline: "none",
  };
  function onChangeNum(e) {
    if (type === "number") {
      const raw = e.target.value;
      if (raw === "") { onChange(0); return; }
      const n = +raw;
      if (!Number.isFinite(n)) return;
      onChange(n < 0 ? 0 : n);
    } else {
      onChange(e.target.value);
    }
  }
  return <div style={{ flex: width ? `0 0 ${width}px` : 1, minWidth: width || 120 }}>
    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>
      {label}{required && <span style={{ color: T.red }}> *</span>}
    </div>
    <div key={pulseKey} className={flash ? "err-flash" : ""} style={{ borderRadius: 4 }}>
      <input
        type={type || "text"}
        min={type === "number" ? (min ?? 0) : undefined}
        step={type === "number" ? (step ?? 1) : undefined}
        value={value ?? ""}
        onChange={onChangeNum}
        placeholder={placeholder}
        title={required ? "Обязательное поле" : undefined}
        style={style}
      />
    </div>
  </div>;
}

function HourInput({ value, onChange, min = 0, max, step, flash, pulseKey, title }) {
  const input = <input
    type="number"
    min={min}
    max={max}
    step={step ?? 1}
    value={value ?? 0}
    onChange={e => {
      const raw = e.target.value;
      if (raw === "") { onChange(min); return; }
      const n = +raw;
      if (!Number.isFinite(n)) return;
      let v = n;
      if (typeof min === "number" && v < min) v = min;
      if (typeof max === "number" && v > max) v = max;
      onChange(v);
    }}
    title={title}
    style={hourInputStyle}
  />;
  if (pulseKey === undefined) return input;
  return <div key={pulseKey} className={flash ? "err-flash" : ""} style={{ borderRadius: 4 }}>{input}</div>;
}

function totalCell(mismatch) {
  return {
    ...semCell,
    textAlign: "center",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    background: mismatch ? "#fde6e3" : T.surface,
    color: mismatch ? T.red : T.text,
  };
}

const hourInputStyle = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};

const semHeadCell = {
  padding: "4px 6px",
  borderBottom: "1px solid " + T.borderLight,
  background: T.surface,
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: ".3px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const semCell = {
  padding: "4px 4px",
  borderBottom: "1px solid " + T.borderLight,
  fontSize: 13,
  verticalAlign: "middle",
  overflow: "hidden",
};
