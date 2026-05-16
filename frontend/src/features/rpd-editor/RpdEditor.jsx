import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { Document, Page } from "react-pdf";
import * as api from "../../api/client.js";
import { T, F, pdfToolBtn } from "../../styles/index.js";
import { formatDateTimeRu } from "../../utils/format.js";
import { Btn } from "../../components/Btn.jsx";
import { Spinner } from "../../components/Spinner.jsx";
import { DownloadIcon } from "../../components/icons.jsx";

import { SEC_KEYS, SIDEBAR_KEYS, PARENT_SECTION } from "./constants.js";
import { PDF_PAGE_MAP_FALLBACK, scanPdfForSections } from "./pdfMap.js";
import { RpdEditorProvider } from "./RpdEditorContext.jsx";
import { Sidebar, SIDEBAR_COLLAPSED_W } from "./Sidebar.jsx";
import { BottomBar } from "./BottomBar.jsx";
import { SentModal, ErrorModal, ApprovedModal, RejectModal, ValidationModal, StalePdfDownloadModal } from "./EditorModals.jsx";
import { BupDropdown } from "./BupDropdown.jsx";

import { EditableBlock } from "./editors/EditableBlock.jsx";
import { SectionEditor } from "./editors/SectionEditor.jsx";
import { LiteratureEditor } from "./editors/LiteratureEditor.jsx";
import { SoftwareEditor } from "./editors/SoftwareEditor.jsx";
import { OutcomesEditor } from "./editors/OutcomesEditor.jsx";
import { TopicsEditor } from "./editors/TopicsEditor.jsx";
import { DatabasesEditor } from "./editors/DatabasesEditor.jsx";
import { MtechEditor } from "./editors/MtechEditor.jsx";
import { WorkloadTable } from "./editors/WorkloadTable.jsx";
import { FosEditor } from "./editors/FosEditor.jsx";
import { RpdMetaModal } from "./RpdMetaModal.jsx";

function pdfRelevantSnapshot(r) {
  if (!r) return "";
  const norm = (v) => (v == null ? "" : String(v).trim());
  const sections = (r.sections || [])
    .filter(s => norm(s.title))
    .map(s => ({
      n: s.section_number || 0,
      t: norm(s.title),
      b: norm(s.brief_content),
      lec: s.lecture_hours || 0,
      lab: s.lab_hours || 0,
      pr: s.practice_hours || 0,
      srs: s.self_study_hours || 0,
      sem: s.semester ?? null,
    }));
  const topics = (r.topics || [])
    .filter(t => norm(t.title))
    .map(t => ({ k: t.topic_type, t: norm(t.title) }));
  const literature = (r.literature || [])
    .filter(l => norm(l.title) || norm(l.url) || norm(l.source_type)
      || (Array.isArray(l.availability) && l.availability.length > 0)
      || l.copies_count != null)
    .map(l => ({
      st: norm(l.source_type),
      t: norm(l.title),
      c: l.copies_count ?? 0,
      u: norm(l.url),
      a: Array.isArray(l.availability) ? [...l.availability].sort() : [],
    }));
  const software = (r.software || [])
    .filter(s => norm(s.name) || norm(s.license_type))
    .map(s => ({ n: norm(s.name), lt: norm(s.license_type) }));
  const databases = (r.databases || [])
    .filter(d => norm(d.name) || norm(d.db_type))
    .map(d => ({ n: norm(d.name), tp: norm(d.db_type) }));
  const mtech = (r.material_tech || [])
    .filter(m => norm(m.room_type) || norm(m.equipment) || m.quantity != null)
    .map(m => ({ rt: norm(m.room_type), eq: norm(m.equipment), q: m.quantity ?? 0 }));
  const outcomes = (r.learning_outcomes || [])
    .filter(o => norm(o.competency_code) || norm(o.indicator_code)
      || norm(o.outcome_text) || norm(o.indicator_description)
      || norm(o.assessment_tool) || !!o.id_indicator)
    .map(o => ({
      cc: norm(o.competency_code),
      ic: norm(o.indicator_code),
      ind: norm(o.indicator_description),
      o: norm(o.outcome_text),
      at: norm(o.assessment_tool),
    }));
  const developers = (r.developers || []).map(d => ({
    n: norm(d.user_full_name || d.full_name),
    p: norm(d.position),
  }));
  const bds = (r.bup_disciplines || []).map(b => ({
    bn: norm(b.bup_name),
    by: b.bup_year ?? null,
    code: norm(b.code),
    sem: norm(b.semester),
    cf: norm(b.control_form),
    th: b.total_hours ?? 0,
    eh: b.exam_hours ?? 0,
    lh: b.lecture_hours ?? 0,
    labh: b.lab_hours ?? 0,
    ph: b.practice_hours ?? 0,
    kh: b.ksr_hours ?? 0,
    sh: b.self_study_hours ?? 0,
    sd: b.semesters_data || null,
    dc: norm(b.direction_code),
    dn: norm(b.direction_name),
  }));
  return JSON.stringify({
    g: norm(r.goals_text),
    ts: norm(r.tasks_text),
    o: norm(r.objects_text),
    rq: norm(r.requirements_text),
    et: norm(r.educational_tech),
    mr: norm(r.methodical_recommendations),
    sections, topics, literature, software, databases, mtech, outcomes, developers, bds,
    fosMain: r.fos_main ? r.fos_main.id_file : null,
    fosOther: (r.fos_other || []).map(f => f.id_file).sort(),
  });
}

export function RpdEditor({ rpdId, tabId, editMode, hasPair = false, reloadKey = 0, onAfterSave, onOpenPair, user, onCloseTab, onExportPdf, onToggleMode, isActive = true }) {
  const [rpd, setRpd] = useState(null); const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [editTexts, setEditTexts] = useState({}); const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(null); const [rejectComment, setRejectComment] = useState(""); const [validationErrors, setValidationErrors] = useState([]);
  const [showMeta, setShowMeta] = useState(false);

  const [collapsedSet, setCollapsedSet] = useState(() => new Set());
  const isCollapsed = useCallback((key) => collapsedSet.has(key), [collapsedSet]);
  const toggleCollapse = useCallback((key) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const [activeSecPdf, setActiveSecPdf] = useState("title");
  const [activeSecEdit, setActiveSecEdit] = useState("title");
  const [saving, setSaving] = useState(false);

  const [savedTick, setSavedTick] = useState(0);
  const savedTimeoutRef = useRef(null);
  const [pdfData, setPdfData] = useState(null); const [pdfLoading, setPdfLoading] = useState(false); const [pdfError, setPdfError] = useState(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);

  const [pdfStale, setPdfStale] = useState(false);

  const [pdfBdId, setPdfBdId] = useState(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.1);
  const [pdfSectionMap, setPdfSectionMap] = useState(PDF_PAGE_MAP_FALLBACK);
  const [sidebarW, setSidebarW] = useState(220);
  const [pageInputValue, setPageInputValue] = useState(1);
  const flashTimeoutRef = useRef(null);
  const pdfScrollRef = useRef(null);
  const pdfPageRefs = useRef({});
  const pdfPageObserverRef = useRef(null);
  const pdfScrollPosRef = useRef(0);
  const editScrollPosRef = useRef(0);

  const pendingScrollRestoreRef = useRef(null);

  const pdfNavTargetRef = useRef(null);

  const restoringScrollRef = useRef(false);
  const preferredActiveSecRef = useRef(null);

  const pendingFlashRef = useRef(null);

  const sidebarLockRef = useRef(false);
  const pageInputFocusedRef = useRef(false);
  const resizingRef = useRef(false);
  const scrollRef = useRef(null);

  const pdfDirtyRef = useRef(true);
  const initialLoadRef = useRef(true);

  const pdfRenderedSnapRef = useRef(null);
  const refs = Object.fromEntries(SEC_KEYS.map(k => [k, useRef(null)]));
  const isEdit = editMode; const isHead = api.userCan(user, "rpd.approve");
  const currentReviewerStep = (rpd?.approval_route || []).find(s => s.status === "pending");
  const canReviewNow = !!(currentReviewerStep && user && currentReviewerStep.id_reviewer === user.id_user);
  const showPdf = !isEdit;
  const activeSec = showPdf ? activeSecPdf : activeSecEdit;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getRpd(rpdId); const r = res.data; setRpd(r);

      const mergedGoals = [r.goals_text, r.tasks_text].map(s => (s || "").trim()).filter(Boolean).join("\n\n");
      setEditTexts({ goals: mergedGoals, objects: r.objects_text || "", requirements: r.requirements_text || "", educational_tech: r.educational_tech || "", methodical_recommendations: r.methodical_recommendations || "" });

      const newSnap = pdfRelevantSnapshot(r);
      let differsFromRendered = false;
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      } else if (pdfRenderedSnapRef.current !== null) {
        differsFromRendered = newSnap !== pdfRenderedSnapRef.current;
        if (differsFromRendered) pdfDirtyRef.current = true;
      }
      if (!silent) setLoading(false);
      return differsFromRendered;
    } catch {
      if (!silent) setLoading(false);
      return false;
    }
  }, [rpdId]);
  useEffect(() => { load(); }, [load]);

  const bdsForPdf = rpd?.bup_disciplines || [];
  useEffect(() => {
    if (!rpd) return;
    if (bdsForPdf.length === 0) { if (pdfBdId !== null) setPdfBdId(null); return; }
    if (!bdsForPdf.some(b => b.id_bup_discipline === pdfBdId)) {
      setPdfBdId(bdsForPdf[0].id_bup_discipline);
    }
  }, [rpd, bdsForPdf, pdfBdId]);

  const initialPdfBdRef = useRef(true);
  useEffect(() => {
    if (initialPdfBdRef.current) { initialPdfBdRef.current = false; return; }
    if (!showPdf) { pdfDirtyRef.current = true; return; }
    const c = pdfScrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: "pdf", value: c.scrollTop };
    pdfDirtyRef.current = true;
    pdfNavTargetRef.current = null;
    preferredActiveSecRef.current = null;
    sidebarLockRef.current = true;
    setPdfReloadKey(k => k + 1);
  }, [pdfBdId]);

  const reloadPdf = useCallback(() => {

    const c = pdfScrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: "pdf", value: c.scrollTop };
    pdfDirtyRef.current = true;

    pdfNavTargetRef.current = null;
    preferredActiveSecRef.current = null;

    sidebarLockRef.current = true;
    setPdfReloadKey(k => k + 1);
  }, []);

  const initialReloadRef = useRef(true);
  const reloadDebounceRef = useRef(null);
  useEffect(() => {
    if (initialReloadRef.current) { initialReloadRef.current = false; return; }
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(async () => {
      reloadDebounceRef.current = null;
      const differsFromRendered = await load(true);
      if (showPdf) setPdfStale(differsFromRendered);
    }, 400);
    return () => { if (reloadDebounceRef.current) { clearTimeout(reloadDebounceRef.current); reloadDebounceRef.current = null; } };
  }, [reloadKey]);

  useEffect(() => {
    if (!showPdf) return;
    if (pdfData && !pdfDirtyRef.current) return;
    let cancelled = false; let createdUrl = null; let transferred = false;

    const controller = new AbortController();
    setPdfLoading(true); setPdfError(null); setPdfData(null); setPdfNumPages(0); setPdfCurrentPage(1);

    const snapAtFetch = rpd ? pdfRelevantSnapshot(rpd) : null;
    api.fetchPdfInline(rpdId, { signal: controller.signal }, pdfBdId).then(r => {
      if (cancelled) return;
      createdUrl = window.URL.createObjectURL(r.data);
      setPdfData(createdUrl);
      transferred = true;
      pdfDirtyRef.current = false;
      if (snapAtFetch !== null) pdfRenderedSnapRef.current = snapAtFetch;
      setPdfStale(false);
    }).catch(() => { if (!cancelled) setPdfError("Не удалось сформировать PDF"); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => {
      cancelled = true;
      try { controller.abort(); } catch { }

      if (createdUrl && !transferred) try { window.URL.revokeObjectURL(createdUrl); } catch { }
    };
  }, [rpdId, showPdf, pdfReloadKey]);

  useEffect(() => () => { if (pdfData) try { window.URL.revokeObjectURL(pdfData); } catch { } }, [pdfData]);

  const initialModeRef = useRef(true);
  useEffect(() => {
    if (initialModeRef.current) { initialModeRef.current = false; return; }
    pendingFlashRef.current = null;
    preferredActiveSecRef.current = editMode ? activeSecEdit : activeSecPdf;
  }, [editMode]);

  useEffect(() => {
    if (!showPdf) {
      if (pdfPageObserverRef.current) { pdfPageObserverRef.current.disconnect(); pdfPageObserverRef.current = null; }
      pdfPageRefs.current = {};
      return;
    }
    const root = pdfScrollRef.current; if (!root) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number(visible.target.getAttribute("data-page"));
        if (n) setPdfCurrentPage(n);
      }
    }, { root, threshold: [0.3, 0.6] });
    pdfPageObserverRef.current = obs;

    Object.values(pdfPageRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => { obs.disconnect(); if (pdfPageObserverRef.current === obs) pdfPageObserverRef.current = null; };
  }, [showPdf, pdfData]);

  const pdfPageRefCallbacks = useRef({});
  const setPdfPageRef = useCallback((n) => {
    if (!pdfPageRefCallbacks.current[n]) {
      pdfPageRefCallbacks.current[n] = (el) => {
        const prev = pdfPageRefs.current[n];
        if (prev && prev !== el && pdfPageObserverRef.current) {
          try { pdfPageObserverRef.current.unobserve(prev); } catch { }
        }
        if (el) {
          pdfPageRefs.current[n] = el;
          if (pdfPageObserverRef.current) {
            try { pdfPageObserverRef.current.observe(el); } catch { }
          }
        } else {
          delete pdfPageRefs.current[n];
        }
      };
    }
    return pdfPageRefCallbacks.current[n];
  }, []);

  useEffect(() => {
    if (!showPdf || !pdfNumPages) return;
    const c = pdfScrollRef.current; if (!c) return;
    let raf = 0;
    function compute() {

      if (sidebarLockRef.current) return;

      if (restoringScrollRef.current) {
        const preferred = preferredActiveSecRef.current;
        if (preferred) setActiveSecPdf(p => p === preferred ? p : preferred);
        return;
      }

      const nav = pdfNavTargetRef.current;
      if (nav) {
        setActiveSecPdf(p => p === nav.key ? p : nav.key);
        if (Math.abs(c.scrollTop - nav.top) < 6 || Date.now() > nav.deadline) {
          pdfNavTargetRef.current = null;
          preferredActiveSecRef.current = null;
        }
        return;
      }
      const scrollTop = c.scrollTop;
      const probe = scrollTop + 60;
      let bestKey = "title", bestPos = -Infinity;
      for (const k of SIDEBAR_KEYS) {
        const sec = pdfSectionMap[k]; if (!sec) continue;
        const pageEl = pdfPageRefs.current[sec.page]; if (!pageEl) continue;
        const pos = pageEl.offsetTop + (sec.y || 0) * pdfScale;
        if (pos <= probe && pos > bestPos) { bestKey = k; bestPos = pos; }
      }
      setActiveSecPdf(p => p === bestKey ? p : bestKey);
      preferredActiveSecRef.current = null;
    }
    function handler() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    }
    c.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => { c.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [showPdf, pdfNumPages, pdfSectionMap, pdfScale, pdfData]);

  useEffect(() => {
    if (pageInputFocusedRef.current) return;
    setPageInputValue(pdfCurrentPage);
  }, [pdfCurrentPage]);

  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const currentMode = showPdf ? "pdf" : "edit";
    const pending = pendingScrollRestoreRef.current;
    const usingPending = !!(pending && pending.mode === currentMode);
    const target = usingPending ? pending.value : (showPdf ? pdfScrollPosRef.current : editScrollPosRef.current);

    if (target == null) {
      restoringScrollRef.current = false;
      sidebarLockRef.current = false;
      if (usingPending) pendingScrollRestoreRef.current = null;
      return;
    }

    restoringScrollRef.current = true;
    let raf = 0; let attempts = 0;
    const MAX_ATTEMPTS = 600;

    const STABLE_THRESHOLD = 20;
    let lastMaxScroll = -1;
    let stableFrames = 0;
    let started = false;
    function finishRestore() {
      restoringScrollRef.current = false;
      sidebarLockRef.current = false;
      if (usingPending) pendingScrollRestoreRef.current = null;
    }
    function tryRestore() {
      const c = showPdf ? pdfScrollRef.current : scrollRef.current;
      if (c) {
        const maxScroll = c.scrollHeight - c.clientHeight;
        if (maxScroll >= target) {
          if (c.scrollTop !== target) c.scrollTop = target;
          finishRestore();
          return;
        }
        if (maxScroll > 0) started = true;
        if (started) {
          if (maxScroll === lastMaxScroll) {

            stableFrames++;
            if (stableFrames >= STABLE_THRESHOLD) { finishRestore(); return; }
          } else {
            stableFrames = 0;
            lastMaxScroll = maxScroll;

            if (c.scrollTop < maxScroll) c.scrollTop = maxScroll;
          }
        }

      }
      if (++attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tryRestore);
      else finishRestore();
    }
    raf = requestAnimationFrame(tryRestore);

    return () => { cancelAnimationFrame(raf); restoringScrollRef.current = false; };
  }, [isActive, showPdf, pdfData, pdfNumPages, loading]);

  useEffect(() => {
    if (showPdf) return;
    const c = scrollRef.current; if (!c) return; let raf = 0;
    function handler() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {

        if (sidebarLockRef.current) return;

        if (restoringScrollRef.current) return;

        if (pendingFlashRef.current) {
          const { key, top: targetTop, deadline } = pendingFlashRef.current;
          setActiveSecEdit(p => p === key ? p : key);
          if (Math.abs(c.scrollTop - targetTop) < 6 || Date.now() > deadline) {
            const el = refs[key]?.current;
            pendingFlashRef.current = null;
            preferredActiveSecRef.current = null;
            if (el) flashElement(el);
          }
          return;
        }
        const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 4;
        const top = c.getBoundingClientRect().top + 90;
        let found = SIDEBAR_KEYS[0];
        for (const k of SIDEBAR_KEYS) {
          const el = refs[k].current;
          if (el && el.getBoundingClientRect().top <= top) found = k;
        }
        if (atBottom) found = SIDEBAR_KEYS[SIDEBAR_KEYS.length - 1];
        setActiveSecEdit(p => p === found ? p : found);

        preferredActiveSecRef.current = null;
      });
    }
    c.addEventListener("scroll", handler, { passive: true }); return () => { c.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [loading, showPdf]);

  function scrollToPdfPage(n, immediate = true) {
    const el = pdfPageRefs.current[n]; const c = pdfScrollRef.current;
    if (!el || !c) return;
    c.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    if (immediate) setPdfCurrentPage(n);
  }

  function scrollToPdfSection(key) {
    const sec = pdfSectionMap[key]; if (!sec) return null;
    const page = Math.min(sec.page || 1, pdfNumPages || sec.page || 1);
    const el = pdfPageRefs.current[page]; const c = pdfScrollRef.current;
    if (!el || !c) return null;
    const yPx = (sec.y || 0) * pdfScale;

    const top = Math.max(0, el.offsetTop + yPx - 18);
    c.scrollTo({ top, behavior: "smooth" });
    return { page, top };
  }

  function flashElement(el) {
    if (!el) return;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    el.classList.remove("sec-flash");
    void el.offsetWidth;
    el.classList.add("sec-flash");
    flashTimeoutRef.current = setTimeout(() => { el.classList.remove("sec-flash"); }, 1600);
  }

  function goTo(key) {
    if (showPdf) {
      preferredActiveSecRef.current = key;
      setActiveSecPdf(key);
      const result = scrollToPdfSection(key);

      if (result) {
        const c = pdfScrollRef.current;
        if (c && Math.abs(c.scrollTop - result.top) < 6) {
          pdfNavTargetRef.current = null;
        } else {
          pdfNavTargetRef.current = { key, top: result.top, deadline: Date.now() + 8000 };
        }
      }

      return;
    }

    const performScroll = () => {
      const el = refs[key]?.current; const c = scrollRef.current;
      if (!el || !c) return;
      setActiveSecEdit(key);
      preferredActiveSecRef.current = key;
      const targetTop = Math.max(0, c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 12);
      if (Math.abs(c.scrollTop - targetTop) < 6) {
        pendingFlashRef.current = null;
        flashElement(el);
      } else {
        pendingFlashRef.current = { key, top: targetTop, deadline: Date.now() + 1500 };
        c.scrollTo({ top: targetTop, behavior: "smooth" });
      }
    };
    const parent = PARENT_SECTION[key];
    if (parent && collapsedSet.has(parent)) {
      setCollapsedSet(prev => {
        if (!prev.has(parent)) return prev;
        const next = new Set(prev);
        next.delete(parent);
        return next;
      });

      setActiveSecEdit(key);
      preferredActiveSecRef.current = key;
      requestAnimationFrame(() => requestAnimationFrame(performScroll));
      return;
    }
    performScroll();
  }

  const lastExpandedSidebarW = useRef(220);

  const SIDEBAR_MIN_EXPANDED_W = 120;
  const SIDEBAR_MAX_W = 420;
  function startResize(e) {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarW;

    const handleEl = e.currentTarget;
    function onMove(ev) {
      if (!resizingRef.current) return;
      const raw = startW + ev.clientX - startX;
      let newW;
      if (raw < (SIDEBAR_COLLAPSED_W + SIDEBAR_MIN_EXPANDED_W) / 2) {
        newW = SIDEBAR_COLLAPSED_W;
      } else if (raw < SIDEBAR_MIN_EXPANDED_W) {
        newW = SIDEBAR_MIN_EXPANDED_W;
      } else {
        newW = Math.min(SIDEBAR_MAX_W, raw);
      }
      if (newW > SIDEBAR_COLLAPSED_W) lastExpandedSidebarW.current = newW;
      setSidebarW(newW);
    }
    function onUp() {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (handleEl) handleEl.style.background = T.borderLight;
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  function _payloadForField(fieldKey, value) {
    if (fieldKey === "goals") return { goals_text: value || "", tasks_text: "" };
    if (fieldKey === "objects") return { objects_text: value || "" };
    if (fieldKey === "requirements") return { requirements_text: value || "" };
    if (fieldKey === "educational_tech") return { educational_tech: value || "" };
    if (fieldKey === "methodical_recommendations") return { methodical_recommendations: value || "" };
    return null;
  }

  function _expectedValue(fieldKey, r) {
    if (!r) return "";
    if (fieldKey === "goals") {
      return [r.goals_text, r.tasks_text].map(s => (s || "").trim()).filter(Boolean).join("\n\n");
    }
    if (fieldKey === "objects") return r.objects_text || "";
    if (fieldKey === "requirements") return r.requirements_text || "";
    if (fieldKey === "educational_tech") return r.educational_tech || "";
    if (fieldKey === "methodical_recommendations") return r.methodical_recommendations || "";
    return "";
  }

  async function saveField(fieldKey) {
    const value = editTexts[fieldKey] || "";

    if (value === _expectedValue(fieldKey, rpd)) return;
    const patch = _payloadForField(fieldKey, value);
    if (!patch) return;
    sidebarLockRef.current = true;
    let ok = false;
    try {
      await api.updateRpd(rpdId, patch);
      await load(true);
      ok = true;
    } catch { }
    if (ok) {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      setSavedTick(t => t + 1);
      savedTimeoutRef.current = setTimeout(() => setSavedTick(0), 1500);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sidebarLockRef.current = false;
    }));
    if (ok && onAfterSave) onAfterSave();
  }

  async function autoFill(key) {
    setGenerating(key);
    try {
      const res = await api.generateSection(rpdId, { section: key });
      const text = res.data.generated_text;
      const fieldMap = { goals: "goals", objects: "objects", requirements: "requirements", educational_tech: "educational_tech", methodical_recommendations: "methodical_recommendations" };
      if (fieldMap[key]) {
        setEditTexts(p => ({ ...p, [fieldMap[key]]: text }));
        setTimeout(() => saveFieldFromValue(fieldMap[key], text), 0);
      } else {
        await load(true);
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        setSavedTick(t => t + 1);
        savedTimeoutRef.current = setTimeout(() => setSavedTick(0), 1500);
        if (onAfterSave) onAfterSave();
      }
    } catch { } setGenerating(null);
  }

  async function autoFillAll() {
    const keys = ["goals", "objects", "requirements", "educational_tech", "methodical_recommendations"];
    for (const k of keys) {
      await autoFill(k);
    }
  }

  async function saveFieldFromValue(fieldKey, value) {
    if (value === _expectedValue(fieldKey, rpd)) return;
    const patch = _payloadForField(fieldKey, value);
    if (!patch) return;
    sidebarLockRef.current = true;
    let ok = false;
    try {
      await api.updateRpd(rpdId, patch);
      await load(true);
      ok = true;
    } catch { }
    if (ok) {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      setSavedTick(t => t + 1);
      savedTimeoutRef.current = setTimeout(() => setSavedTick(0), 1500);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sidebarLockRef.current = false;
    }));
    if (ok && onAfterSave) onAfterSave();
  }

  async function flushAllTexts() {
    setSaving(true);
    sidebarLockRef.current = true;
    let ok = false;
    try {
      await api.updateRpd(rpdId, {
        goals_text: editTexts.goals || "", tasks_text: "",
        objects_text: editTexts.objects || "",
        requirements_text: editTexts.requirements || "",
        educational_tech: editTexts.educational_tech || "",
        methodical_recommendations: editTexts.methodical_recommendations || "",
      });
      await load(true);
      ok = true;
    } catch { }
    setSaving(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sidebarLockRef.current = false;
    }));
    if (ok && onAfterSave) onAfterSave();
  }

  function getValidationErrors() {
    const e = [];
    if (!editTexts.goals?.trim()) e.push({ secKey: "1.1", label: "1.1 Цели и задачи дисциплины" });
    if (!editTexts.objects?.trim()) e.push({ secKey: "1.2", label: "1.2 Изучаемые объекты" });
    if (!editTexts.requirements?.trim()) e.push({ secKey: "1.3", label: "1.3 Входные требования" });
    if (!editTexts.educational_tech?.trim()) e.push({ secKey: "5.1", label: "5.1 Образовательные технологии" });
    if (!editTexts.methodical_recommendations?.trim()) e.push({ secKey: "5.2", label: "5.2 Методические указания" });

    if (!rpd.sections?.some(s => (s.title || "").trim())) e.push({ secKey: "4", label: "4. Содержание (нет ни одного заполненного раздела)" });
    if (!rpd.literature?.some(l => (l.title || "").trim())) e.push({ secKey: "6.1", label: "6.1 Литература (нет ни одного заполненного источника)" });
    return e;
  }
  async function handleSendApproval() {
    const errors = getValidationErrors();
    if (errors.length > 0) { setValidationErrors(errors); setModal("validation"); return; }
    setValidationErrors([]);
    await flushAllTexts();
    try { await api.sendForApproval(rpdId); setModal("sent"); await load(); } catch { setModal("error"); }
  }
  async function handleReview(action) { try { await api.reviewRpd(rpdId, { action, comment: rejectComment }); setModal(action === "approve" ? "approved" : null); setRejectComment(""); await load(); } catch { } }

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}><Spinner size={40} /></div>;
  if (!rpd) return <div style={{ flex: 1, padding: 40, textAlign: "center", background: T.bg }}>РПД не найдена</div>;

  const canEdit = rpd.status === "Черновик" || rpd.status === "На доработке";

  const labHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.lab_hours || 0), 0);
  const practiceHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.practice_hours || 0), 0);
  const hasLabTopics = labHoursTotal > 0 && (rpd.topics || []).some(t => t.topic_type === "lab" && (t.title || "").trim());
  const hasPracticeTopics = practiceHoursTotal > 0 && (rpd.topics || []).some(t => t.topic_type === "practice" && (t.title || "").trim());
  const electronicLiteratureCount = (rpd.literature || []).filter(l => !!l.url).length;

  const requiredCompletion = (() => {
    const checks = [
      ["1.1", !!(editTexts.goals?.trim() || rpd.goals_text?.trim())],
      ["1.2", !!(editTexts.objects?.trim() || rpd.objects_text?.trim())],
      ["1.3", !!(editTexts.requirements?.trim() || rpd.requirements_text?.trim())],
      ["2", (rpd.learning_outcomes || []).some(o => (o.outcome_text || "").trim())],
      ["4", (rpd.sections || []).some(s => (s.title || "").trim())],
      ["5.1", !!(editTexts.educational_tech?.trim() || rpd.educational_tech?.trim())],
      ["5.2", !!(editTexts.methodical_recommendations?.trim() || rpd.methodical_recommendations?.trim())],
      ["6.1", (rpd.literature || []).some(l => (l.title || "").trim())],
      ["7", (rpd.material_tech || []).some(m => (m.room_type || "").trim() || (m.equipment || "").trim())],
      ["8", !!rpd.fos_main || (rpd.fos_other || []).length > 0],
    ];
    const total = checks.length;
    const filled = checks.filter(([, v]) => v).length;
    const missing = checks.filter(([, v]) => !v).map(([k]) => k);
    return { total, filled, missing };
  })();

  const reloadAndNotify = async () => {
    await load(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSavedTick(t => t + 1);
    savedTimeoutRef.current = setTimeout(() => setSavedTick(0), 1500);
    if (onAfterSave) onAfterSave();
  };
  const ctxValue = { rpd, rpdId, isEdit, canEdit, generating, autoFill, reload: reloadAndNotify, editTexts, setEditTexts, editing, setEditing, isCollapsed, toggleCollapse, saveField };

  return <RpdEditorProvider value={ctxValue}>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Sidebar
          width={sidebarW}
          isEdit={isEdit}
          hasPair={hasPair}
          canEdit={canEdit}
          validationErrors={validationErrors}
          activeSec={activeSec}
          hasLabTopics={hasLabTopics}
          hasPracticeTopics={hasPracticeTopics}
          isCollapsed={isCollapsed}
          generating={generating}
          onToggleMode={onToggleMode}
          onOpenPair={onOpenPair}
          onGoTo={goTo}
          onOpenMeta={() => setShowMeta(true)}
          onAutoFillAll={autoFillAll}
          onExpand={() => setSidebarW(lastExpandedSidebarW.current || 220)}
        />

        <div onMouseDown={startResize}
          onDoubleClick={() => setSidebarW(prev => prev > SIDEBAR_COLLAPSED_W ? SIDEBAR_COLLAPSED_W : (lastExpandedSidebarW.current || 220))}
          title={sidebarW <= SIDEBAR_COLLAPSED_W ? "Потяните, чтобы изменить ширину · двойной клик — раскрыть" : "Потяните, чтобы изменить ширину · двойной клик — свернуть"}
          onMouseEnter={e => e.currentTarget.style.background = T.accent}
          onMouseLeave={e => { if (!resizingRef.current) e.currentTarget.style.background = T.borderLight; }}
          style={{ width: 5, cursor: "col-resize", background: T.borderLight, flexShrink: 0, transition: "background .15s" }} />

        {showPdf ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.pdfBg, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: T.surface, borderBottom: "1px solid " + T.border, flexShrink: 0 }}>

              <button onClick={() => scrollToPdfPage(Math.max(1, pdfCurrentPage - 1), false)} disabled={!pdfNumPages || pdfCurrentPage <= 1} style={pdfToolBtn(pdfCurrentPage <= 1 || !pdfNumPages)} title="Предыдущая страница">◀</button>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.text }}>
                <input type="number" min={1} max={pdfNumPages || 1} value={pageInputValue}
                  onFocus={e => { pageInputFocusedRef.current = true; e.target.select(); }}
                  onBlur={() => {
                    pageInputFocusedRef.current = false;
                    const v = Math.max(1, Math.min(pdfNumPages || 1, +pageInputValue || 1));
                    setPageInputValue(v);
                    if (v !== pdfCurrentPage) scrollToPdfPage(v, false);
                  }}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  onChange={e => {
                    setPageInputValue(e.target.value);
                    const raw = +e.target.value;
                    if (Number.isFinite(raw) && raw >= 1 && raw <= (pdfNumPages || 1) && raw !== pdfCurrentPage) {
                      scrollToPdfPage(raw, false);
                    }
                  }}
                  style={{ width: 44, padding: "3px 6px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 12, textAlign: "center", fontFamily: F }} />
                <span style={{ color: T.textMuted }}>/ {pdfNumPages || "—"}</span>
              </div>
              <button onClick={() => scrollToPdfPage(Math.min(pdfNumPages || 1, pdfCurrentPage + 1), false)} disabled={!pdfNumPages || pdfCurrentPage >= pdfNumPages} style={pdfToolBtn(!pdfNumPages || pdfCurrentPage >= pdfNumPages)} title="Следующая страница">▶</button>
              <div style={{ width: 1, height: 18, background: T.borderLight }} />

              <button onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Уменьшить">−</button>
              <span style={{ fontSize: 12, color: T.text, minWidth: 38, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{Math.round(pdfScale * 100)}%</span>
              <button onClick={() => setPdfScale(s => Math.min(3, +(s + 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Увеличить">+</button>
              <button onClick={() => setPdfScale(1.1)} style={{ ...pdfToolBtn(false), fontSize: 11, padding: "3px 8px" }} title="Сбросить масштаб">1:1</button>
              <div style={{ flex: 1 }} />

              {bdsForPdf.length > 1 && (

                <div style={{ width: 240, flexShrink: 0, display: "flex" }}>
                  <BupDropdown
                    bds={bdsForPdf}
                    value={pdfBdId}
                    onChange={setPdfBdId}
                    compact
                    title="Печатная форма для конкретной БУП-привязки"
                  />
                </div>
              )}
              <Btn small onClick={() => { setPdfStale(false); reloadPdf(); }} disabled={pdfLoading} primary={pdfStale}>↻ Обновить</Btn>
              <Btn small onClick={() => { if (pdfStale) setModal("staleDownload"); else onExportPdf(rpdId, pdfBdId); }}><DownloadIcon /> Скачать</Btn>
            </div>
            {pdfStale && (

              <div style={{ padding: "6px 12px", background: T.blueLight, borderBottom: "1px solid " + T.blue, color: T.blue, fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                Печатная форма устарела — нажмите «↻ Обновить», чтобы пересобрать PDF
              </div>
            )}
            <div ref={pdfScrollRef} onScroll={e => { pdfScrollPosRef.current = e.currentTarget.scrollTop; }} style={{ flex: 1, position: "relative", overflow: "auto", background: T.pdfBg, padding: "16px 0" }}>
              {pdfLoading && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 12, zIndex: 2, pointerEvents: "none" }}><Spinner size={36} /><div style={{ fontSize: 13 }}>Формируется PDF из шаблона...</div></div>}
              {pdfError && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 12 }}><div style={{ fontSize: 14, color: "#ffb4b4" }}>{pdfError}</div><Btn small onClick={reloadPdf}>Повторить</Btn></div>}
              {pdfData && (
                <Document file={pdfData} onLoadSuccess={(pdfDoc) => {
                  setPdfNumPages(pdfDoc.numPages);
                  scanPdfForSections(pdfDoc).then(m => {
                    if (Object.keys(m).length > 1) setPdfSectionMap(prev => ({ ...prev, ...m }));
                  }).catch(() => { });
                }} onLoadError={(e) => { console.error("PDF load error:", e); setPdfError("Не удалось открыть PDF: " + (e?.message || "неизвестная ошибка")); }} loading="">
                  {Array.from({ length: pdfNumPages }, (_, i) => i + 1).map(n => (
                    <div key={n} style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      <div data-page={n} ref={setPdfPageRef(n)} style={{ display: "inline-block" }}>
                        <Page pageNumber={n} scale={pdfScale} renderAnnotationLayer={false} renderTextLayer={true} loading="" />
                      </div>
                    </div>
                  ))}
                </Document>
              )}
            </div>
          </div>
        ) : (
          <div ref={scrollRef} onScroll={e => { editScrollPosRef.current = e.currentTarget.scrollTop; }} style={{ flex: 1, overflowY: "auto", padding: "24px 32px", background: T.bg }}>
            {isEdit && !canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.blueLight, border: "1px solid " + T.blue, color: T.blue, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>👁 РПД нельзя редактировать в текущем статусе</div>}
            <div style={{ maxWidth: 820, margin: "0 auto", background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "40px 40px 60px" }}>

              <div ref={refs.title} style={{ marginBottom: 32, textAlign: "center", paddingTop: 20, paddingBottom: 20 }}>
                <div style={{ fontSize: 11, marginBottom: 12, color: T.textMuted }}>Министерство науки и высшего образования Российской Федерации</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Пермский национальный исследовательский</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 30 }}>политехнический университет</div>
                <div style={{ marginTop: 40 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Рабочая программа дисциплины</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{rpd.discipline_name}</div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Учебный год: {rpd.academic_year}</div>
                </div>
                <BupAttachmentsBlock bds={rpd.bup_disciplines || []} />
              </div>
              <HR />

              <div>
                <SectionHeading title="1. Общие положения" collapsed={isCollapsed("1")} onToggle={() => toggleCollapse("1")} />
                {!isCollapsed("1") && <>
                  <div ref={refs["1.1"]} style={{ marginBottom: 32 }}>
                    <EditableBlock skey="goals" label="1.1. Цели и задачи дисциплины" fieldKey="goals" placeholder="Опишите цели и задачи дисциплины…" />
                  </div>
                  <HR />
                  <div ref={refs["1.2"]} style={{ marginBottom: 32 }}>
                    <EditableBlock skey="objects" label="1.2. Изучаемые объекты дисциплины" fieldKey="objects" placeholder="Перечислите изучаемые объекты и явления…" />
                  </div>
                  <HR />
                  <div ref={refs["1.3"]} style={{ marginBottom: 32 }}>
                    <EditableBlock skey="requirements" label="1.3. Входные требования" fieldKey="requirements" placeholder="Опишите входные требования к обучающимся…" />
                  </div>
                </>}
              </div>
              <HR />

              <div ref={refs["2"]} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isCollapsed("2") ? 0 : 16 }}>
                  <div style={{ flex: 1 }}>
                    <SectionHeading title="2. Планируемые результаты обучения по дисциплине" collapsed={isCollapsed("2")} onToggle={() => toggleCollapse("2")} marginBottom={0} />
                  </div>
                  {!isCollapsed("2") && isEdit && canEdit && <Btn small primary onClick={() => autoFill("learning_outcomes")} disabled={!!generating}>{generating === "learning_outcomes" ? "Генерация..." : "Сгенерировать"}</Btn>}
                </div>
                {!isCollapsed("2") && <OutcomesEditor />}
              </div>
              <HR />

              <div ref={refs["3"]} style={{ marginBottom: 32 }}>
                <SectionHeading title="3. Объём и виды учебной работы" collapsed={isCollapsed("3")} onToggle={() => toggleCollapse("3")} marginBottom={8} />
                {!isCollapsed("3") && <>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
                  {(rpd.bup_disciplines || []).some(b => b.is_manual)
                    ? "Параметры заданы при создании РПД и не редактируются."
                    : "Заполняется автоматически из БУПа"}
                </div>
                <WorkloadTable rpd={rpd} />
                </>}
              </div>
              <HR />

              <div ref={refs["4"]} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isCollapsed("4") ? 0 : 16 }}>
                  <div style={{ flex: 1 }}>
                    <SectionHeading title="4. Содержание дисциплины" collapsed={isCollapsed("4")} onToggle={() => toggleCollapse("4")} marginBottom={0} />
                  </div>
                  {!isCollapsed("4") && isEdit && canEdit && <Btn small primary onClick={() => autoFill("content")} disabled={!!generating}>{generating === "content" ? "Генерация..." : "Сгенерировать"}</Btn>}
                </div>
                {!isCollapsed("4") && <SectionEditor />}
                {!isCollapsed("4") && <div style={{ marginTop: 32 }}>
                  <HR />

                  <div ref={refs["4.1"]} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Тематика примерных практических занятий</div>
                      {isEdit && canEdit && practiceHoursTotal > 0 && <Btn small primary onClick={() => autoFill("topics_practice")} disabled={!!generating}>{generating === "topics_practice" ? "Генерация..." : "Сгенерировать"}</Btn>}
                    </div>
                    <TopicsEditor kind="practice" />
                  </div>
                  <HR />
                  <div ref={refs["4.2"]} style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Тематика примерных лабораторных работ</div>
                      {isEdit && canEdit && labHoursTotal > 0 && <Btn small primary onClick={() => autoFill("topics_lab")} disabled={!!generating}>{generating === "topics_lab" ? "Генерация..." : "Сгенерировать"}</Btn>}
                    </div>
                    <TopicsEditor kind="lab" />
                  </div>
                </div>}
              </div>
              <HR />

              <div>
                <SectionHeading title="5. Организационно-педагогические условия" collapsed={isCollapsed("5")} onToggle={() => toggleCollapse("5")} />
                {!isCollapsed("5") && <>
                  <div ref={refs["5.1"]} style={{ marginBottom: 32 }}>
                    <EditableBlock skey="educational_tech" label="5.1. Образовательные технологии" fieldKey="educational_tech" placeholder="Опишите образовательные технологии, применяемые при освоении дисциплины…" />
                  </div>
                  <HR />
                  <div ref={refs["5.2"]} style={{ marginBottom: 32 }}>
                    <EditableBlock skey="methodical_recommendations" label="5.2. Методические указания" fieldKey="methodical_recommendations" placeholder="Опишите методические указания для обучающихся по освоению дисциплины…" />
                  </div>
                </>}
              </div>
              <HR />

              <div>
                <SectionHeading title="6. Учебно-методическое и информационное обеспечение" collapsed={isCollapsed("6")} onToggle={() => toggleCollapse("6")} />
                {!isCollapsed("6") && <>
                  <div ref={refs["6.1"]} style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.1. Печатная учебно-методическая литература</div>
                    <LiteratureEditor kind="printed" />
                  </div>
                  <HR />
                  <div ref={refs["6.2"]} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>6.2. Электронная учебно-методическая литература</div>
                      {isEdit && canEdit && electronicLiteratureCount > 0 && <Btn small primary onClick={() => autoFill("literature_electronic")} disabled={!!generating}>{generating === "literature_electronic" ? "Генерация..." : "Сгенерировать"}</Btn>}
                    </div>
                    <LiteratureEditor kind="electronic" />
                  </div>
                  <HR />

                  <div ref={refs["6.3"]} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>6.3. Современные профессиональные базы данных и информационные справочные системы, используемые при осуществлении образовательного процесса по дисциплине</div>
                      {isEdit && canEdit && <Btn small primary onClick={() => autoFill("databases")} disabled={!!generating} style={{ flexShrink: 0 }}>{generating === "databases" ? "Генерация..." : "Сгенерировать"}</Btn>}
                    </div>
                    <DatabasesEditor />
                  </div>
                  <HR />
                  <div ref={refs["6.4"]} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>6.4. Лицензионное и свободно распространяемое программное обеспечение, используемое при осуществлении образовательного процесса по дисциплине</div>
                      {isEdit && canEdit && <Btn small primary onClick={() => autoFill("software")} disabled={!!generating} style={{ flexShrink: 0 }}>{generating === "software" ? "Генерация..." : "Сгенерировать"}</Btn>}
                    </div>
                    <SoftwareEditor />
                  </div>
                </>}
              </div>
              <HR />

              <div ref={refs["7"]} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: isCollapsed("7") ? 0 : 16 }}>
                  <div style={{ flex: 1 }}>
                    <SectionHeading title="7. Материально-техническое обеспечение образовательного процесса по дисциплине" collapsed={isCollapsed("7")} onToggle={() => toggleCollapse("7")} marginBottom={0} />
                  </div>
                  {!isCollapsed("7") && isEdit && canEdit && <Btn small primary onClick={() => autoFill("material_tech")} disabled={!!generating} style={{ flexShrink: 0 }}>{generating === "material_tech" ? "Генерация..." : "Сгенерировать"}</Btn>}
                </div>
                {!isCollapsed("7") && <MtechEditor />}
              </div>
              <HR />

              <div ref={refs["8"]} style={{ marginBottom: 32 }}>
                <SectionHeading title="8. Фонд оценочных средств" collapsed={isCollapsed("8")} onToggle={() => toggleCollapse("8")} marginBottom={8} />
                {!isCollapsed("8") && <>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Файл ФОС прикрепляется к печатной форме РПД, прочие файлы — справочные.</div>
                  <FosEditor />
                </>}
              </div>
              <HR />

              {rpd.approvals?.length > 0 && <div style={{ marginTop: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>История согласования</div>
                {rpd.approvals.map(a => <div key={a.id_approval} style={{ padding: "8px 0", borderBottom: "1px solid " + T.borderLight, fontSize: 12 }}>
                  <span style={{ color: T.textMuted }}>{a.created_at ? formatDateTimeRu(a.created_at) : ""}</span> — <b>{a.reviewer_name}</b> — <span>{a.status}</span>
                  {a.comment && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{a.comment}</div>}
                </div>)}
              </div>}
            </div>
            <div style={{ height: 300 }} />
          </div>
        )}
      </div>

      <BottomBar
        showPdf={showPdf}
        isEdit={isEdit}
        isHead={isHead}
        canEdit={canEdit}
        canReviewNow={canReviewNow}
        savedTick={savedTick}
        status={rpd.status}
        completion={requiredCompletion}
        onJumpToMissing={(secKey) => goTo(secKey)}
        updatedAt={rpd.updated_at}
        onSendApproval={handleSendApproval}
        onApprove={() => handleReview("approve")}
        onReject={() => setModal("reject")}
      />

      {modal === "sent" && <SentModal onClose={() => setModal(null)} />}
      {modal === "error" && <ErrorModal onClose={() => setModal(null)} />}
      {modal === "approved" && <ApprovedModal onClose={() => { setModal(null); onCloseTab && onCloseTab(); }} />}
      {modal === "reject" && <RejectModal comment={rejectComment} onChange={setRejectComment} onClose={() => setModal(null)} onSubmit={() => { handleReview("reject"); setModal(null); }} />}
      {modal === "validation" && <ValidationModal errors={validationErrors} onGoTo={(secKey) => { goTo(secKey); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === "staleDownload" && <StalePdfDownloadModal
        onClose={() => setModal(null)}
        onRefreshAndDownload={() => { setPdfStale(false); reloadPdf(); onExportPdf(rpdId, pdfBdId); setModal(null); }}
        onDownloadAnyway={() => { onExportPdf(rpdId, pdfBdId); setModal(null); }}
      />}
      {showMeta && <RpdMetaModal
        rpd={rpd}
        rpdId={rpdId}
        canEdit={canEdit}
        user={user}
        reload={() => load(true)}
        onClose={() => setShowMeta(false)}
      />}
    </div>
  </RpdEditorProvider>;
}

function HR() { return <div style={{ borderTop: "1px solid " + T.borderLight, margin: "32px 0" }} />; }

function SectionHeading({ title, collapsed, onToggle, marginBottom = 16 }) {
  const [hover, setHover] = useState(false);
  const visible = collapsed || hover;

  return <div style={{ marginBottom: collapsed ? 0 : marginBottom }}>
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "inline-block",
        border: "none",
        background: "transparent",
        padding: "0 0 0 22px",
        margin: "0 0 0 -22px",
        cursor: "pointer",
        fontFamily: F,
        fontSize: 15,
        fontWeight: 700,
        color: T.text,
        textAlign: "left",
      }}
    >
      <span aria-hidden style={{
        position: "absolute",
        left: 0, top: "50%",
        width: 18, height: 18,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: T.textMuted, lineHeight: 1,
        opacity: visible ? 1 : 0,
        transform: `translateY(-50%) ${collapsed ? "rotate(-90deg)" : "rotate(0)"}`,
        transition: "opacity .15s, transform .15s",
        pointerEvents: "none",
      }}>▾</span>
      {title}
    </button>
  </div>;
}

function BupAttachmentsBlock({ bds }) {
  if (bds.length === 0) {
    return <div style={{ marginTop: 12, fontSize: 12, color: T.red, fontStyle: "italic" }}>
      Не привязана ни к одной дисциплине БУПа
    </div>;
  }
  if (bds.length === 1) {
    const b = bds[0];
    const sourceLine = b.is_manual
      ? `Без БУПа${b.semester ? ` · сем. ${b.semester}` : ""}${b.control_form ? ` · контроль: ${b.control_form}` : ""}`
      : `${b.bup_name || "БУП"}${b.code ? ` · ${b.code}` : ""}${b.semester ? ` · сем. ${b.semester}` : ""}${b.control_form ? ` · контроль: ${b.control_form}` : ""}`;
    const volumeParts = [];
    if (b.total_hours) volumeParts.push(`${b.total_hours} часов`);
    if (b.zet) volumeParts.push(`${b.zet} ЗЕ`);
    if (b.exam_hours) volumeParts.push(`экзамен: ${b.exam_hours} ч`);
    return <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: T.textMuted }}>
        Направление: {b.direction_code || "—"} {b.direction_name || ""}
      </div>
      <div style={{ fontSize: 13, color: T.textMuted }}>Профиль: {b.direction_profile || "—"}</div>
      <div style={{ fontSize: 13, color: T.textMuted }}>Форма обучения: {b.form_of_study || "—"}</div>
      {volumeParts.length > 0 && (
        <div style={{ fontSize: 13, color: T.textMuted }}>Объём: {volumeParts.join(" · ")}</div>
      )}
      <div style={{ fontSize: 13, color: T.textMuted }}>{sourceLine}</div>
    </div>;
  }
  return <div style={{ marginTop: 16 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
      Привязки к БУПам · {bds.length} печатных форм
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      {bds.map(b => (
        <div key={b.id_bup_discipline} style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: T.text }}>
            {b.direction_code || "—"} {b.direction_name || ""}
          </span>
          {b.direction_profile ? ` · ${b.direction_profile}` : ""}
          {` · форма обучения: ${b.form_of_study || "—"}`}
          {" · "}
          {b.bup_name || "БУП"}{b.code ? ` · ${b.code}` : ""}
        </div>
      ))}
    </div>
  </div>;
}
