import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page } from "react-pdf";
import * as api from "../../api/client.js";
import { T, F } from "../../theme.js";
import { pdfToolBtn, td, th } from "../../styles.js";
import { Btn } from "../../components/Btn.jsx";
import { Spinner } from "../../components/Spinner.jsx";
import { Badge } from "../../components/Badge.jsx";
import { DownloadIcon } from "../../components/icons.jsx";

import { SEC_KEYS, SIDEBAR_KEYS } from "./constants.js";
import { PDF_PAGE_MAP_FALLBACK, scanPdfForSections } from "./pdfMap.js";
import { RpdEditorProvider } from "./RpdEditorContext.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { BottomBar } from "./BottomBar.jsx";
import { SentModal, ErrorModal, ApprovedModal, RejectModal, ValidationModal } from "./EditorModals.jsx";

import { EditableBlock } from "./editors/EditableBlock.jsx";
import { SectionEditor } from "./editors/SectionEditor.jsx";
import { LiteratureEditor } from "./editors/LiteratureEditor.jsx";
import { SoftwareEditor } from "./editors/SoftwareEditor.jsx";
import { OutcomesEditor } from "./editors/OutcomesEditor.jsx";
import { TopicsEditor } from "./editors/TopicsEditor.jsx";
import { DatabasesEditor } from "./editors/DatabasesEditor.jsx";
import { MtechEditor } from "./editors/MtechEditor.jsx";
import { DocsUpload } from "./editors/DocsUpload.jsx";
import { MetaEditor } from "./editors/MetaEditor.jsx";
import { ViewRpdEditor } from "./editors/ViewRpdEditor.jsx";
import { FosEditor } from "./editors/FosEditor.jsx";

export function RpdEditor({ rpdId, tabId, editMode, hasPair = false, reloadKey = 0, onAfterSave, onOpenPair, userRole, onBack, onExportPdf, onToggleMode, isActive = true }) {
  const [rpd, setRpd] = useState(null); const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [editTexts, setEditTexts] = useState({}); const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(null); const [rejectComment, setRejectComment] = useState(""); const [validationErrors, setValidationErrors] = useState([]);
  // У каждого режима — своя «активная вкладка»: при переключении просмотр ↔ редактирование
  // в сайдбаре сразу подсвечивается последняя секция этого режима, а не «протекает» из другого.
  const [activeSecPdf, setActiveSecPdf] = useState("title");
  const [activeSecEdit, setActiveSecEdit] = useState("title");
  const [saving, setSaving] = useState(false);
  const [pdfData, setPdfData] = useState(null); const [pdfLoading, setPdfLoading] = useState(false); const [pdfError, setPdfError] = useState(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
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
  // Сохранённая ДО ручного/внешнего reload позиция скролла. Нужно потому, что pdfData=null
  // или setLoading(true) обнуляют DOM/контент, и автоклэмп scrollTop=0 затирает обычные
  // pdfScrollPosRef/editScrollPosRef через onScroll. Тег режима защищает от случая, когда
  // pending был сохранён в одном режиме, а юзер успел переключиться в другой.
  const pendingScrollRestoreRef = useRef(null); // { mode: "pdf"|"edit", value: number } | null
  // Цель текущего программного скролла в PDF-режиме (клик по разделу в сайдбаре):
  // { key, top, deadline }. Пока ref не nil — scroll-spy не пересчитывает activeSec, а удерживает
  // подсветку на key. Снимается, когда scrollTop ≈ top (приехали) или истёк deadline.
  const pdfNavTargetRef = useRef(null);
  // true, пока tryRestore тащит scrollTop к целевой позиции после смены режима/
  // возврата на вкладку. Сбрасывается ровно когда восстановление завершилось
  // (scrollHeight дорос и scrollTop встал на target) или исчерпан лимит попыток.
  const restoringScrollRef = useRef(false);
  const preferredActiveSecRef = useRef(null);
  // Цель текущего программного скролла в edit-режиме: { key, top, deadline }.
  // flash-рамка у раздела запускается, когда scrollTop приехал к top (или истёк deadline).
  const pendingFlashRef = useRef(null);
  const pageInputFocusedRef = useRef(false);
  const resizingRef = useRef(false);
  const scrollRef = useRef(null);
  // PDF считается «грязным» (требует перерендера на сервере), если данные РПД
  // могли поменяться: после load() с сервера, сохранения, изменения статуса
  // или явного нажатия «↻ Обновить». Между переключениями режима без правок
  // PDF переиспользуется — серверный рендер не дёргается заново.
  const pdfDirtyRef = useRef(true);
  const initialLoadRef = useRef(true);
  const refs = Object.fromEntries(SEC_KEYS.map(k => [k, useRef(null)]));
  const isEdit = editMode; const isHead = userRole === "Зав. кафедрой";
  const showPdf = !isEdit;
  const activeSec = showPdf ? activeSecPdf : activeSecEdit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRpd(rpdId); const r = res.data; setRpd(r);
      setEditTexts({ goals: r.goals_text || "", tasks: r.tasks_text || "", objects: r.objects_text || "", requirements: r.requirements_text || "", educational_tech: r.educational_tech || "", methodical_recommendations: r.methodical_recommendations || "", comment: r.comment || "" });
      // Первый load при монтировании компонента не помечает PDF грязным
      // (PDF и так ещё не загружен). Все последующие load() — это перечитывание
      // после изменений, поэтому PDF на сервере мог обновиться.
      if (initialLoadRef.current) initialLoadRef.current = false;
      else pdfDirtyRef.current = true;
    } catch { } setLoading(false);
  }, [rpdId]);
  useEffect(() => { load(); }, [load]);

  const reloadPdf = useCallback(() => {
    // Захватываем актуальный scrollTop ДО setPdfData(null) → иначе автоклэмп схлопнувшегося
    // контейнера сбросит pdfScrollPosRef в 0 через onScroll-хендлер, и восстанавливать будет нечего.
    const c = pdfScrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: "pdf", value: c.scrollTop };
    pdfDirtyRef.current = true;
    setPdfReloadKey(k => k + 1);
  }, []);

  // Внешний триггер «перечитать всё» (например, парная edit-вкладка сохранилась → notifyRpdChanged
  // у App'а инкрементит reloadKey этой view-вкладки). На первом монтировании ничего не делаем —
  // load() уже отрабатывает в основном эффекте. Скролл сохраняется автоматически:
  // pdfScrollPosRef / editScrollPosRef хранят последнюю позицию, а restoration-эффект
  // ниже сам её восстановит, как только pdfData/loading изменятся после перезагрузки.
  const initialReloadRef = useRef(true);
  useEffect(() => {
    if (initialReloadRef.current) { initialReloadRef.current = false; return; }
    // Так же, как и при ручном reloadPdf: захватываем текущий scroll для текущего режима
    // ДО того, как load() сорвёт DOM в Spinner и автоклэмп сбросит scroll-ref в 0.
    const c = showPdf ? pdfScrollRef.current : scrollRef.current;
    if (c) pendingScrollRestoreRef.current = { mode: showPdf ? "pdf" : "edit", value: c.scrollTop };
    load();
    if (showPdf) reloadPdf();
    else pdfDirtyRef.current = true;
  }, [reloadKey]);

  // PDF preview for view mode.
  // При showPdf=false (режим редактирования) PDF НЕ сбрасывается — blob URL
  // остаётся в памяти, и при возврате в режим просмотра компонент мгновенно
  // покажет уже загруженный документ без обращения к серверу.
  useEffect(() => {
    if (!showPdf) return;
    if (pdfData && !pdfDirtyRef.current) return; // PDF актуален — не дёргаем сервер
    let cancelled = false; let createdUrl = null; let transferred = false;
    setPdfLoading(true); setPdfError(null); setPdfData(null); setPdfNumPages(0); setPdfCurrentPage(1);
    setPdfSectionMap(PDF_PAGE_MAP_FALLBACK);
    pdfPageRefs.current = {};
    api.fetchPdfInline(rpdId).then(r => {
      if (cancelled) return;
      createdUrl = window.URL.createObjectURL(r.data);
      setPdfData(createdUrl);
      transferred = true;
      pdfDirtyRef.current = false;
    }).catch(() => { if (!cancelled) setPdfError("Не удалось сформировать PDF"); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => {
      cancelled = true;
      // Если blob успел уйти в state — освобождением займётся cleanup-эффект ниже,
      // здесь revoke только если запрос отменён ДО setPdfData.
      if (createdUrl && !transferred) try { window.URL.revokeObjectURL(createdUrl); } catch { }
    };
  }, [rpdId, showPdf, pdfReloadKey]);

  // Освобождение прошлого blob URL при смене pdfData и при размонтировании.
  useEffect(() => () => { if (pdfData) try { window.URL.revokeObjectURL(pdfData); } catch { } }, [pdfData]);

  // При переключении режима «Просмотр ↔ Редактирование» DOM скролл-контейнера
  // пересоздаётся (scrollTop=0). pendingFlashRef сбрасываем — он принадлежал
  // прошлой DOM-сессии. preferredActiveSecRef фиксируем на «активную вкладку
  // нового режима»: пока restoringScrollRef=true, scroll-spy будет держать её
  // и не «мигать» на «Титульник» по промежуточному scrollTop=0. Снятие флага
  // делает сам tryRestore — когда scrollTop реально встанет на цель.
  const initialModeRef = useRef(true);
  useEffect(() => {
    if (initialModeRef.current) { initialModeRef.current = false; return; }
    pendingFlashRef.current = null;
    preferredActiveSecRef.current = editMode ? activeSecEdit : activeSecPdf;
  }, [editMode]);

  // Track current page by observing which PDF page is centered in the scroll container.
  // IO держим в ref, чтобы page-узлы могли регистрироваться через ref-callback —
  // после edit→view DOM пересоздаётся, и обычный effect-подход с массовой подпиской
  // в один проход не успевал переподписаться на новые узлы (нумерация зависала).
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
    // Подписываемся на уже зарегистрированные узлы (если они есть).
    Object.values(pdfPageRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => { obs.disconnect(); if (pdfPageObserverRef.current === obs) pdfPageObserverRef.current = null; };
  }, [showPdf, pdfData]);

  // Ref-callback для каждой страницы: при mount регистрируется в текущем IO,
  // при unmount — отписывается. Так нумерация выживает любые ремонтажи DOM.
  // Кэшируем колбэки по n, чтобы их идентичность не менялась между рендерами
  // (иначе React-pdf отвязывал бы ref на каждом рендере).
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

  // Подсветка раздела сайдбара по реальной позиции скролла PDF (в режиме просмотра).
  // Активным считается раздел, чей заголовок ближе всего сверху относительно текущего скролла.
  useEffect(() => {
    if (!showPdf || !pdfNumPages) return;
    const c = pdfScrollRef.current; if (!c) return;
    let raf = 0;
    function compute() {
      // Пока идёт восстановление позиции после смены режима — держим preferred (если есть)
      // и НЕ трогаем activeSec по реальному scrollTop, иначе мелькнёт «Титульник» на scroll=0.
      if (restoringScrollRef.current) {
        const preferred = preferredActiveSecRef.current;
        if (preferred) setActiveSecPdf(p => p === preferred ? p : preferred);
        return;
      }
      // Пока активен программный smooth-скролл к разделу (клик по сайдбару),
      // держим подсвеченным целевой раздел. Снимаем фиксацию ровно когда scrollTop ≈ top
      // (а не по таймеру) — поэтому при долгом плавном скролле подсветка НЕ мигает на
      // промежуточных секциях, через которые пробегает viewport.
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

  // Синхронизация значения поля ввода страницы с реальной текущей (если пользователь не печатает)
  useEffect(() => {
    if (pageInputFocusedRef.current) return;
    setPageInputValue(pdfCurrentPage);
  }, [pdfCurrentPage]);

  // Очистка таймера подсветки при размонтировании
  useEffect(() => () => { if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current); }, []);

  // Восстановление позиции скролла:
  //   • при возврате на вкладку с этой РПД,
  //   • при переключении режима «Просмотр ↔ Редактирование» (DOM скролл-контейнера
  //     пересоздаётся, scrollTop обнуляется — нужно вернуть сохранённое значение).
  // Высота контента может быть ещё не готова (react-pdf постранично рендерит документ),
  // поэтому пробуем восстановить scrollTop в течение нескольких кадров, пока scrollHeight
  // не «дорастёт» до нужной позиции.
  useEffect(() => {
    if (!isActive) return;
    // Сначала пробуем «pending»-цель (она заранее захвачена reloadPdf'ом или внешним reload-эффектом
    // ДО автоклэмпа). Если pending'а нет ИЛИ он от другого режима — fallback на обычный scroll-ref.
    const currentMode = showPdf ? "pdf" : "edit";
    const pending = pendingScrollRestoreRef.current;
    const usingPending = !!(pending && pending.mode === currentMode);
    const target = usingPending ? pending.value : (showPdf ? pdfScrollPosRef.current : editScrollPosRef.current);
    if (!target) {
      restoringScrollRef.current = false;
      if (usingPending) pendingScrollRestoreRef.current = null;
      return;
    }
    // Взводим флаг ДО планирования rAF: scroll-spy эффект (зарегистрирован выше)
    // в этом же цикле уже успеет дёрнуть свой rAF, и его compute() обязан увидеть
    // флаг до того, как пересчитает activeSec по scrollTop=0.
    restoringScrollRef.current = true;
    let raf = 0; let attempts = 0;
    // Лимит попыток — страховка на случай, если контейнер так и не дорастёт
    // до target (PDF не отрендерился). Цикл сам остановится, флаг снимется,
    // scroll-spy вернётся к работе по реальному scrollTop.
    const MAX_ATTEMPTS = 600;
    function tryRestore() {
      const c = showPdf ? pdfScrollRef.current : scrollRef.current;
      if (c) {
        const maxScroll = c.scrollHeight - c.clientHeight;
        if (maxScroll >= target) {
          if (c.scrollTop !== target) c.scrollTop = target;
          // onScroll затем обновит ref до target — ничего восстанавливать не нужно
          restoringScrollRef.current = false;
          if (usingPending) pendingScrollRestoreRef.current = null;
          return;
        }
        // Высота ещё не выросла — частично прокручиваем туда, куда сейчас можно
        // (так PDF не «прыгает» резко в самом конце), и продолжаем попытки.
        if (maxScroll > 0 && c.scrollTop < maxScroll) c.scrollTop = maxScroll;
      }
      if (++attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tryRestore);
      else { restoringScrollRef.current = false; if (usingPending) pendingScrollRestoreRef.current = null; }
    }
    raf = requestAnimationFrame(tryRestore);
    // ВАЖНО: cleanup НЕ чистит pendingScrollRestoreRef — pdfData во время reload меняется
    // дважды (blob → null → newBlob), эффект перезапускается, и следующий запуск должен
    // снова найти ту же pending-цель и продолжить восстанавливать.
    return () => { cancelAnimationFrame(raf); restoringScrollRef.current = false; };
  }, [isActive, showPdf, pdfData, pdfNumPages, loading]);

  // Scroll spy (only in edit mode). Если докрутили почти до конца — активируем последний sidebar-раздел,
  // даже если его нельзя «поднять» к самому верху (документ короче, чем нужно).
  // Во время программного smooth-скролла (после клика по вкладке) подсветка зафиксирована
  // через preferredActiveSecRef, и flash-рамка у целевого раздела запускается, когда скролл реально приехал.
  useEffect(() => {
    if (showPdf) return;
    const c = scrollRef.current; if (!c) return; let raf = 0;
    function handler() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Восстановление scrollTop после смены режима — держим прежний activeSec
        // и не подсвечиваем «Титульник» по промежуточным значениям scrollTop=0.
        if (restoringScrollRef.current) return;
        // Программный скролл активен — держим подсвеченным целевой раздел и ждём прибытия,
        // чтобы запустить flash-рамку у него только в момент остановки скролла.
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
        // Реальный пользовательский скролл — сбрасываем «преференс» от прошлого
        // клика, чтобы он не оверрайдил подсветку при дальнейших движениях.
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
    // Небольшой отступ сверху над заголовком — чтобы он не «прилипал» к верхней кромке viewport,
    // но и не открывался текст из предыдущего раздела.
    const top = Math.max(0, el.offsetTop + yPx - 18);
    c.scrollTo({ top, behavior: "smooth" });
    return { page, top };
  }

  function flashElement(el) {
    if (!el) return;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    el.classList.remove("sec-flash");
    void el.offsetWidth; // принудительный reflow — перезапуск анимации
    el.classList.add("sec-flash");
    flashTimeoutRef.current = setTimeout(() => { el.classList.remove("sec-flash"); }, 1600);
  }

  function goTo(key) {
    if (showPdf) {
      preferredActiveSecRef.current = key;
      setActiveSecPdf(key);
      const result = scrollToPdfSection(key);
      // Если smooth-скролл реально стартовал — фиксируем целевой scrollTop.
      // compute() в scroll-spy будет удерживать подсветку на key, пока scrollTop не приедет
      // к result.top (точное попадание ±6px) или не истечёт страховочный deadline.
      // Это убирает «мигание» подсветки промежуточных разделов в конце долгого скролла.
      if (result) {
        const c = pdfScrollRef.current;
        if (c && Math.abs(c.scrollTop - result.top) < 6) {
          pdfNavTargetRef.current = null; // уже на месте
        } else {
          pdfNavTargetRef.current = { key, top: result.top, deadline: Date.now() + 8000 };
        }
      }
      // Подсветку самой PDF-страницы (flash-рамку) намеренно не запускаем — нужна только в edit-режиме.
      return;
    }
    const el = refs[key]?.current; const c = scrollRef.current; if (!el || !c) return;
    // Подсветка вкладки слева — мгновенно. Flash-рамка вокруг раздела — только после прибытия скролла.
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
  }

  function startResize(e) {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarW;
    function onMove(ev) {
      if (!resizingRef.current) return;
      const newW = Math.max(120, Math.min(420, startW + ev.clientX - startX));
      setSidebarW(newW);
    }
    function onUp() {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  async function autoFill(key) {
    setGenerating(key);
    try {
      const res = await api.generateSection(rpdId, { section: key });
      const text = res.data.generated_text;
      const fieldMap = { goals: "goals", tasks: "tasks", objects: "objects", requirements: "requirements", educational_tech: "educational_tech", methodical_recommendations: "methodical_recommendations" };
      if (fieldMap[key]) setEditTexts(p => ({ ...p, [fieldMap[key]]: text }));
    } catch { } setGenerating(null);
  }

  async function handleSave() {
    setSaving(true);
    let ok = false;
    try {
      await api.updateRpd(rpdId, { goals_text: editTexts.goals, tasks_text: editTexts.tasks, objects_text: editTexts.objects, requirements_text: editTexts.requirements, educational_tech: editTexts.educational_tech, methodical_recommendations: editTexts.methodical_recommendations, comment: editTexts.comment });
      await load();
      ok = true;
    } catch { }
    setSaving(false);
    // Сообщаем родителю — он триггернёт перезагрузку парной view-вкладки
    // (если она открыта) через её reloadKey.
    if (ok && onAfterSave) onAfterSave();
  }

  function getValidationErrors() {
    const e = [];
    if (!editTexts.goals?.trim()) e.push({ secKey: "1.1", label: "1.1 Цели дисциплины" });
    if (!editTexts.tasks?.trim()) e.push({ secKey: "1.1", label: "1.1 Задачи дисциплины" });
    if (!editTexts.objects?.trim()) e.push({ secKey: "1.2", label: "1.2 Изучаемые объекты" });
    if (!editTexts.requirements?.trim()) e.push({ secKey: "1.3", label: "1.3 Входные требования" });
    if (!editTexts.educational_tech?.trim()) e.push({ secKey: "5.1", label: "5.1 Образовательные технологии" });
    if (!editTexts.methodical_recommendations?.trim()) e.push({ secKey: "5.2", label: "5.2 Методические указания" });
    if (!rpd.sections?.length) e.push({ secKey: "4", label: "4. Содержание (нет ни одного раздела)" });
    if (!rpd.literature?.length) e.push({ secKey: "6.1", label: "6.1 Литература (нет ни одного источника)" });
    return e;
  }
  async function handleSendApproval() {
    const errors = getValidationErrors();
    if (errors.length > 0) { setValidationErrors(errors); setModal("validation"); return; }
    setValidationErrors([]);
    await handleSave();
    try { await api.sendForApproval(rpdId); setModal("sent"); await load(); } catch { setModal("error"); }
  }
  async function handleReview(action) { try { await api.reviewRpd(rpdId, { action, comment: rejectComment }); setModal(action === "approve" ? "approved" : null); setRejectComment(""); await load(); } catch { } }

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}><Spinner size={40} /></div>;
  if (!rpd) return <div style={{ flex: 1, padding: 40, textAlign: "center", background: T.bg }}>РПД не найдена</div>;

  const canEdit = rpd.status === "Черновик" || rpd.status === "На доработке";
  const hasLabTopics = (rpd.sections || []).some(s => (s.topics || []).some(t => t.topic_type === "lab"));
  const hasPracticeTopics = (rpd.sections || []).some(s => (s.topics || []).some(t => t.topic_type === "practice"));

  const ctxValue = { rpd, rpdId, isEdit, canEdit, generating, autoFill, reload: load, editTexts, setEditTexts, editing, setEditing };

  return <RpdEditorProvider value={ctxValue}>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Sidebar
          width={sidebarW}
          isEdit={isEdit}
          hasPair={hasPair}
          canEdit={canEdit}
          isHead={isHead}
          status={rpd.status}
          validationErrors={validationErrors}
          activeSec={activeSec}
          hasLabTopics={hasLabTopics}
          hasPracticeTopics={hasPracticeTopics}
          onToggleMode={onToggleMode}
          onOpenPair={onOpenPair}
          onGoTo={goTo}
        />
        {/* RESIZER */}
        <div onMouseDown={startResize} title="Потяните, чтобы изменить ширину панели"
          onMouseEnter={e => e.currentTarget.style.background = T.accent}
          onMouseLeave={e => { if (!resizingRef.current) e.currentTarget.style.background = T.borderLight; }}
          style={{ width: 5, cursor: "col-resize", background: T.borderLight, flexShrink: 0, transition: "background .15s" }} />
        {/* DOCUMENT */}
        {showPdf ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.pdfBg, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: T.surface, borderBottom: "1px solid " + T.border, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: T.blue, fontWeight: 700 }}>👁 Просмотр PDF</span>
              <div style={{ width: 1, height: 18, background: T.borderLight }} />
              {/* Page navigation */}
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
              {/* Zoom */}
              <button onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Уменьшить">−</button>
              <span style={{ fontSize: 12, color: T.text, minWidth: 38, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{Math.round(pdfScale * 100)}%</span>
              <button onClick={() => setPdfScale(s => Math.min(3, +(s + 0.1).toFixed(2)))} style={pdfToolBtn(false)} title="Увеличить">+</button>
              <button onClick={() => setPdfScale(1.1)} style={{ ...pdfToolBtn(false), fontSize: 11, padding: "3px 8px" }} title="Сбросить масштаб">1:1</button>
              <div style={{ flex: 1 }} />
              <Btn small onClick={reloadPdf} disabled={pdfLoading}>↻ Обновить</Btn>
              <Btn small onClick={() => onExportPdf(rpdId)}><DownloadIcon /> Скачать</Btn>
            </div>
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
            {isEdit && canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.orangeLight, border: "1px solid " + T.orange, color: T.orange, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>✏ Режим редактирования — изменения сохраняются кнопкой «Сохранить»</div>}
            {isEdit && !canEdit && <div style={{ maxWidth: 820, margin: "0 auto 12px", padding: "9px 16px", borderRadius: 6, background: T.blueLight, border: "1px solid " + T.blue, color: T.blue, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>👁 РПД нельзя редактировать в текущем статусе</div>}
            <div style={{ maxWidth: 820, margin: "0 auto", background: T.surface, border: "1px solid " + (isEdit && canEdit ? T.orange : T.borderLight), borderRadius: 4, boxShadow: isEdit && canEdit ? "0 2px 16px rgba(217,115,32,.12)" : "0 2px 8px rgba(0,0,0,.06)", padding: "40px 40px 60px" }}>
              {/* МЕТАИНФОРМАЦИЯ — данные РПД, не входящие в печатную форму */}
              <div ref={refs.meta} style={{ marginBottom: 32, padding: "20px 24px", background: T.bg, borderRadius: 6, border: "1px dashed " + T.border }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>
                  Метаинформация · в печатную форму РПД не попадает
                </div>
                <MetaEditor />
              </div>

              {/* ТИТУЛЬНИК */}
              <div ref={refs.title} style={{ marginBottom: 32, textAlign: "center", paddingTop: 20, paddingBottom: 20 }}>
                <div style={{ fontSize: 11, marginBottom: 12, color: T.textMuted }}>Министерство науки и высшего образования Российской Федерации</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Пермский национальный исследовательский</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 30 }}>политехнический университет</div>
                <div style={{ marginTop: 40 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Рабочая программа дисциплины</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{rpd.discipline_name}</div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Направление: {rpd.direction_code} {rpd.direction_name}</div>
                  {rpd.direction_profile && <div style={{ fontSize: 13, color: T.textMuted }}>Профиль: {rpd.direction_profile}</div>}
                  <div style={{ fontSize: 13, color: T.textMuted }}>Учебный год: {rpd.academic_year} · Семестр: {rpd.semester || "-"} · Контроль: {rpd.control_form || "-"}</div>
                </div>
              </div>
              <HR />
              {/* 1. Общие положения */}
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>1. Общие положения</div>
              <div ref={refs["1.1"]} style={{ marginBottom: 32 }}>
                <EditableBlock skey="goals" label="1.1. Цели дисциплины" fieldKey="goals" />
                <div style={{ marginTop: 20 }}><EditableBlock skey="tasks" label="Задачи дисциплины" fieldKey="tasks" /></div>
              </div>
              <HR />
              <div ref={refs["1.2"]} style={{ marginBottom: 32 }}>
                <EditableBlock skey="objects" label="1.2. Изучаемые объекты дисциплины" fieldKey="objects" />
              </div>
              <HR />
              <div ref={refs["1.3"]} style={{ marginBottom: 32 }}>
                <EditableBlock skey="requirements" label="1.3. Входные требования" fieldKey="requirements" />
              </div>
              <HR />
              {/* 2. Результаты обучения */}
              <div ref={refs["2"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>2. Планируемые результаты обучения по дисциплине</div>
                <OutcomesEditor />
              </div>
              <HR />
              {/* 3. Объём и виды учебной работы — read-only из БУП */}
              <div ref={refs["3"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Объём и виды учебной работы</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Заполняется автоматически из БУП</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Вид учебной работы</th><th style={th}>Всего часов</th></tr></thead>
                  <tbody>
                    <tr><td style={td}>Контактная аудиторная работа</td><td style={{ ...td, textAlign: "center" }}>{(rpd.lecture_hours || 0) + (rpd.practice_hours || 0) + (rpd.lab_hours || 0)}</td></tr>
                    <tr><td style={td}>— лекции (Л)</td><td style={{ ...td, textAlign: "center" }}>{rpd.lecture_hours || 0}</td></tr>
                    <tr><td style={td}>— лабораторные работы (ЛР)</td><td style={{ ...td, textAlign: "center" }}>{rpd.lab_hours || 0}</td></tr>
                    <tr><td style={td}>— практические занятия (ПЗ)</td><td style={{ ...td, textAlign: "center" }}>{rpd.practice_hours || 0}</td></tr>
                    <tr><td style={td}>Самостоятельная работа (СРС)</td><td style={{ ...td, textAlign: "center" }}>{rpd.self_study_hours || 0}</td></tr>
                    <tr><td style={{ ...td, fontWeight: 700 }}>Общая трудоёмкость</td><td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{rpd.total_hours || 0}</td></tr>
                    <tr><td style={td}>Форма итогового контроля</td><td style={{ ...td, textAlign: "center" }}>{rpd.control_form || "—"}</td></tr>
                    <tr><td style={td}>Семестр(ы)</td><td style={{ ...td, textAlign: "center" }}>{rpd.semester || "—"}</td></tr>
                  </tbody>
                </table>
              </div>
              <HR />
              {/* 4. Содержание */}
              <div ref={refs["4"]} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>4. Содержание дисциплины</div>
                  {isEdit && canEdit && <Btn small primary onClick={() => autoFill("content")} disabled={!!generating}>{generating === "content" ? "Генерация..." : "Сгенерировать"}</Btn>}
                </div>
                <SectionEditor />
              </div>
              <HR />
              <div ref={refs["4.1"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Тематика примерных лабораторных работ</div>
                <TopicsEditor kind="lab" />
              </div>
              <HR />
              <div ref={refs["4.2"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Тематика практических занятий</div>
                <TopicsEditor kind="practice" />
              </div>
              <HR />
              {/* 5. Орг.-пед. условия */}
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>5. Организационно-педагогические условия</div>
              <div ref={refs["5.1"]} style={{ marginBottom: 32 }}>
                <EditableBlock skey="educational_tech" label="5.1. Образовательные технологии" fieldKey="educational_tech" />
              </div>
              <HR />
              <div ref={refs["5.2"]} style={{ marginBottom: 32 }}>
                <EditableBlock skey="methodical_recommendations" label="5.2. Методические указания" fieldKey="methodical_recommendations" />
              </div>
              <HR />
              {/* 6. Учебно-методическое обеспечение */}
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>6. Учебно-методическое и информационное обеспечение</div>
              <div ref={refs["6.1"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.1. Печатная учебно-методическая литература</div>
                <LiteratureEditor kind="printed" />
              </div>
              <HR />
              <div ref={refs["6.2"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.2. Электронная учебно-методическая литература</div>
                <LiteratureEditor kind="electronic" />
              </div>
              <HR />
              <div ref={refs["6.3"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>6.3. Лицензионное и свободно распространяемое программное обеспечение</div>
                <SoftwareEditor />
              </div>
              <HR />
              <div ref={refs["6.4"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>6.4. Современные профессиональные базы данных и информационные справочные системы</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Если оставить пустым — в шаблон вставится стандартный перечень ПНИПУ</div>
                <DatabasesEditor />
              </div>
              <HR />
              {/* 7. МТО */}
              <div ref={refs["7"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>7. Материально-техническое обеспечение образовательного процесса</div>
                <MtechEditor />
              </div>
              <HR />
              {/* 8. ФОС */}
              <div ref={refs["8"]} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>8. Фонд оценочных средств</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Файл ФОС прикрепляется к печатной форме РПД, прочие файлы — справочные.</div>
                <FosEditor />
              </div>
              <HR />
              {/* ПРОСМОТР РПД — таблица БУП-дисциплин с ФГОС */}
              <div ref={refs.view} style={{ marginBottom: 32, padding: "20px 24px", background: T.bg, borderRadius: 6, border: "1px dashed " + T.border }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>
                  Просмотр РПД · справочная информация, в печатную форму не попадает
                </div>
                <ViewRpdEditor />
              </div>
              <HR />
              {/* ДОКУМЕНТЫ для LLM */}
              <div ref={refs.docs} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Загруженные документы (контекст для LLM)</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Не попадает в финальный РПД — используется только для автогенерации</div>
                <DocsUpload />
              </div>
              {/* ИСТОРИЯ */}
              {rpd.approvals?.length > 0 && <div style={{ marginTop: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>История согласования</div>
                {rpd.approvals.map(a => <div key={a.id_approval} style={{ padding: "8px 0", borderBottom: "1px solid " + T.borderLight, fontSize: 12 }}>
                  <span style={{ color: T.textMuted }}>{a.created_at ? new Date(a.created_at).toLocaleString("ru-RU") : ""}</span> — <b>{a.reviewer_name}</b> — <Badge status={a.status} />
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
        saving={saving}
        status={rpd.status}
        rpdId={rpdId}
        onBack={onBack}
        onExportPdf={onExportPdf}
        onSave={handleSave}
        onSendApproval={handleSendApproval}
        onApprove={() => handleReview("approve")}
        onReject={() => setModal("reject")}
      />

      {modal === "sent" && <SentModal onClose={() => setModal(null)} />}
      {modal === "error" && <ErrorModal onClose={() => setModal(null)} />}
      {modal === "approved" && <ApprovedModal onClose={() => { setModal(null); onBack(); }} />}
      {modal === "reject" && <RejectModal comment={rejectComment} onChange={setRejectComment} onClose={() => setModal(null)} onSubmit={() => { handleReview("reject"); setModal(null); }} />}
      {modal === "validation" && <ValidationModal errors={validationErrors} onGoTo={(secKey) => { goTo(secKey); setModal(null); }} onClose={() => setModal(null)} />}
    </div>
  </RpdEditorProvider>;
}

function HR() { return <div style={{ borderTop: "1px solid " + T.borderLight, margin: "32px 0" }} />; }
