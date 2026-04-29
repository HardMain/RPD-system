import { useState, useEffect, useCallback, useRef } from "react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfJsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

import * as api from "./api/client.js";
import { T, F } from "./theme.js";
import { Spinner } from "./components/Spinner.jsx";
import { TabBtn } from "./components/TabBtn.jsx";
import { BellIcon } from "./components/icons.jsx";

import { LoginPage } from "./pages/LoginPage.jsx";
import { RpdListPage } from "./pages/RpdListPage.jsx";
import { ApprovalPage } from "./pages/ApprovalPage.jsx";
import { OnApprovalPage } from "./pages/OnApprovalPage.jsx";
import { ArchivePage } from "./pages/ArchivePage.jsx";
import { SystemInfoPage } from "./pages/SystemInfoPage.jsx";
import { AdminBupsPage } from "./pages/AdminBupsPage.jsx";
import { AdminDirectionsPage } from "./pages/AdminDirectionsPage.jsx";

import { NotifPanel } from "./features/notifications/NotifPanel.jsx";
import { CreateRpdModal } from "./features/rpd-create/CreateRpdModal.jsx";
import { OpenRpdsBar } from "./features/tabs/OpenRpdsBar.jsx";
import { PaneDropZones } from "./features/tabs/PaneDropZones.jsx";
import { RpdEditor } from "./features/rpd-editor/RpdEditor.jsx";

// Используем bundled-воркер (Vite сам собирает его как Web Worker с правильным MIME)
pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker();

export default function App() {
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("my");
  const [rpds, setRpds] = useState([]);
  // Каждая открытая вкладка: { tabId: string, id_rpd: number, mode: "edit"|"view", ...rpd_metadata }.
  // tabId уникален (одна РПД может одновременно занимать ДВЕ вкладки — одну в edit, одну в view),
  // mode хранится отдельно и не зашит в tabId, поэтому переключение режима «на месте» не меняет ID
  // (и не дёргает React переидентификацию вкладки в panes.tabs).
  const [openRpds, setOpenRpds] = useState([]);
  // Состояние сплита: левая панель есть всегда, правая опциональна (null — обычный одиночный режим).
  // tabs/activeId — это tabId-строки.
  const [panes, setPanes] = useState({ left: { tabs: [], activeId: null }, right: null });
  const [draggingTabId, setDraggingTabId] = useState(null);
  // На какую половину сейчас наведена перетаскиваемая вкладка ("left" | "right" | null) —
  // нужно для подсветки целевой зоны во время drag.
  const [dragOverSide, setDragOverSide] = useState(null);
  // Соотношение ширины левой панели к общей (0.2…0.8). Используется только когда сплит активен.
  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef(null);
  const resizingSplitRef = useRef(false);
  // Счётчики «перезагрузить» по tabId. Когда edit-вкладка сохраняется, App дёргает счётчики
  // ОСТАЛЬНЫХ вкладок этой же РПД — те видят изменение пропа и перечитывают данные/PDF.
  const [tabReloadKeys, setTabReloadKeys] = useState({});
  const [showNotif, setShowNotif] = useState(false); const [showCreate, setShowCreate] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      api.getMe().then(r => setUser(r.data))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setChecking(false));
    } else setChecking(false);
  }, []);

  const loadRpds = useCallback(async () => { try { const r = await api.getRpds(); setRpds(r.data); } catch { } }, []);
  useEffect(() => {
    if (user) {
      loadRpds();
      api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { });
    }
  }, [user, loadRpds]);

  function findPaneOf(tabId) {
    if (panes.left.tabs.includes(tabId)) return "left";
    if (panes.right && panes.right.tabs.includes(tabId)) return "right";
    return null;
  }
  function oppositeSide(side) { return side === "left" ? "right" : "left"; }
  function newTabId(id_rpd, mode) { return `tab-${id_rpd}-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

  function openRpdFn(rpd, editMode, options = {}) {
    const mode = editMode ? "edit" : "view";
    // Если эта же (id_rpd, mode) уже открыта — просто фокусируемся.
    const sameTab = openRpds.find(t => t.id_rpd === rpd.id_rpd && t.mode === mode);
    if (sameTab) { focusTab(sameTab.tabId); return; }
    // Если уже открыта другая «версия» этой РПД (другой mode), новую кладём в ПРОТИВОПОЛОЖНУЮ
    // панель — чтобы edit и view сразу оказались side-by-side.
    const other = openRpds.find(t => t.id_rpd === rpd.id_rpd);
    let targetSide = options.targetSide;
    if (!targetSide) targetSide = other ? oppositeSide(findPaneOf(other.tabId)) : "left";

    const tabId = newTabId(rpd.id_rpd, mode);
    // ВНИМАНИЕ к порядку: rpd может прилетать как существующая запись openRpds (из openPairFor),
    // у неё есть свои tabId/mode/id_rpd — поэтому spread ИДЁТ ПЕРВЫМ, а наши значения после.
    setOpenRpds(prev => [...prev, { ...rpd, tabId, id_rpd: rpd.id_rpd, mode }]);
    setPanes(prev => {
      if (targetSide === "right") {
        if (!prev.right) return { ...prev, right: { tabs: [tabId], activeId: tabId } };
        return { ...prev, right: { tabs: [...prev.right.tabs, tabId], activeId: tabId } };
      }
      return { ...prev, left: { tabs: [...prev.left.tabs, tabId], activeId: tabId } };
    });
    setActiveTab("edit");
  }
  function focusTab(tabId) {
    setPanes(prev => {
      if (prev.left.tabs.includes(tabId)) return { ...prev, left: { ...prev.left, activeId: tabId } };
      if (prev.right && prev.right.tabs.includes(tabId)) return { ...prev, right: { ...prev.right, activeId: tabId } };
      return prev;
    });
    setActiveTab("edit");
  }
  function toggleTabMode(tabId) {
    const tab = openRpds.find(t => t.tabId === tabId); if (!tab) return;
    const newMode = tab.mode === "edit" ? "view" : "edit";
    // Если рядом уже есть пара в нужном режиме — блокируем toggle (в редакторе кнопка вообще
    // спрятана), здесь страховка на случай вызова другим путём.
    const sibling = openRpds.find(t => t.id_rpd === tab.id_rpd && t.mode === newMode);
    if (sibling) { focusTab(sibling.tabId); return; }
    setOpenRpds(prev => prev.map(t => t.tabId === tabId ? { ...t, mode: newMode } : t));
  }
  // Открыть копию текущей РПД в противоположном режиме во второй панели (или просто рядом,
  // если панели одна). Это и есть discoverable-механизм для пары edit+view.
  function openPairFor(tabId) {
    const tab = openRpds.find(t => t.tabId === tabId); if (!tab) return;
    const otherMode = tab.mode === "edit" ? "view" : "edit";
    const sibling = openRpds.find(t => t.id_rpd === tab.id_rpd && t.mode === otherMode);
    if (sibling) { focusTab(sibling.tabId); return; }
    const here = findPaneOf(tabId);
    const target = here ? oppositeSide(here) : "right";
    openRpdFn(tab, otherMode === "edit", { targetSide: target });
  }
  function closeRpdTab(tabId) {
    const next = openRpds.filter(t => t.tabId !== tabId);
    setOpenRpds(next); loadRpds();
    setTabReloadKeys(prev => { if (!(tabId in prev)) return prev; const { [tabId]: _, ...rest } = prev; return rest; });
    setPanes(prev => {
      let newLeft = prev.left;
      let newRight = prev.right;
      if (prev.left.tabs.includes(tabId)) {
        const tabs = prev.left.tabs.filter(id => id !== tabId);
        const activeId = prev.left.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.left.activeId;
        newLeft = { tabs, activeId };
      }
      if (prev.right && prev.right.tabs.includes(tabId)) {
        const tabs = prev.right.tabs.filter(id => id !== tabId);
        const activeId = prev.right.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.right.activeId;
        newRight = tabs.length === 0 ? null : { tabs, activeId };
      }
      if (newLeft.tabs.length === 0 && newRight) return { left: newRight, right: null };
      return { left: newLeft, right: newRight };
    });
    if (next.length === 0) setActiveTab("my");
  }
  function moveTabToPane(tabId, targetSide) {
    setPanes(prev => {
      const inLeft = prev.left.tabs.includes(tabId);
      const inRight = !!(prev.right && prev.right.tabs.includes(tabId));
      if (!inLeft && !inRight) return prev;
      const sourceSide = inLeft ? "left" : "right";
      if (sourceSide === targetSide) {
        if (targetSide === "left") return { ...prev, left: { ...prev.left, activeId: tabId } };
        return { ...prev, right: { ...prev.right, activeId: tabId } };
      }
      let newLeft = prev.left;
      let newRight = prev.right;
      if (sourceSide === "left") {
        const tabs = prev.left.tabs.filter(id => id !== tabId);
        const activeId = prev.left.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.left.activeId;
        newLeft = { tabs, activeId };
      } else {
        const tabs = prev.right.tabs.filter(id => id !== tabId);
        const activeId = prev.right.activeId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : prev.right.activeId;
        newRight = tabs.length === 0 ? null : { tabs, activeId };
      }
      if (targetSide === "left") {
        newLeft = { tabs: [...newLeft.tabs, tabId], activeId: tabId };
      } else {
        newRight = newRight ? { tabs: [...newRight.tabs, tabId], activeId: tabId } : { tabs: [tabId], activeId: tabId };
      }
      if (newLeft.tabs.length === 0 && newRight) return { left: newRight, right: null };
      return { left: newLeft, right: newRight };
    });
  }
  function mergePanes() {
    setPanes(prev => {
      if (!prev.right) return prev;
      const tabs = [...prev.left.tabs, ...prev.right.tabs];
      const activeId = prev.left.activeId != null ? prev.left.activeId : prev.right.activeId;
      return { left: { tabs, activeId }, right: null };
    });
  }
  function swapPanes() {
    setPanes(prev => prev.right ? { left: prev.right, right: prev.left } : prev);
    // Зеркалим соотношение ширин: было 70/30 → станет 30/70, чтобы визуальный
    // «вес» панелей поехал вместе с их содержимым, а не наоборот.
    setSplitRatio(r => 1 - r);
  }
  // Дёргаем «соседей по id_rpd», но не саму initiator-вкладку: она только что сама всё перечитала.
  function notifyRpdChanged(initiatorTabId) {
    const init = openRpds.find(t => t.tabId === initiatorTabId); if (!init) return;
    const others = openRpds.filter(t => t.id_rpd === init.id_rpd && t.tabId !== initiatorTabId);
    if (others.length === 0) return;
    setTabReloadKeys(prev => {
      const next = { ...prev };
      others.forEach(t => { next[t.tabId] = (next[t.tabId] || 0) + 1; });
      return next;
    });
  }
  function startSplitResize(e) {
    e.preventDefault();
    resizingSplitRef.current = true;
    function onMove(ev) {
      if (!resizingSplitRef.current) return;
      const c = splitContainerRef.current; if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const ratio = Math.max(0.2, Math.min(0.8, x / rect.width));
      setSplitRatio(ratio);
    }
    function onUp() {
      resizingSplitRef.current = false;
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

  async function handleExportPdf(rpdId, bdId) {
    try {
      const r = await api.exportPdf(rpdId, bdId);
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a"); a.href = url; a.download = `RPD_${rpdId}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert("Ошибка экспорта PDF"); }
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null); setOpenRpds([]);
    setPanes({ left: { tabs: [], activeId: null }, right: null });
    setTabReloadKeys({});
  };

  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}><Spinner size={40} /></div>;
  if (!user) return <LoginPage onLogin={u => setUser(u)} />;

  const role = user.role;
  const isHead = role === "Зав. кафедрой";
  const isAdmin = role === "Администратор";
  const navTabs = [
    { id: "my", label: `Мои РПД (${rpds.length})` },
    isHead ? { id: "approval", label: "Согласование" } : { id: "onApproval", label: `На согласов. (${rpds.filter(r => r.status === "На согласовании").length})` },
    { id: "archive", label: `Архив (${rpds.filter(r => r.status === "Согласовано").length})` },
    isAdmin ? { id: "adminBups", label: "БУПы" } : null,
    isAdmin ? { id: "adminDirections", label: "ФГОС" } : null,
    { id: "system", label: "Система" },
  ].filter(Boolean);

  return <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: F, color: T.text, background: T.bg }}>
    <style>{"*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes secFlash{0%{box-shadow:0 0 0 2px " + T.accent + "00}50%{box-shadow:0 0 0 2px " + T.accent + "66}100%{box-shadow:0 0 0 2px " + T.accent + "00}}.sec-flash{animation:secFlash 1.6s ease-in-out;border-radius:6px}html,body{overflow:hidden;height:100%}::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:" + T.bg + "}::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:5px;border:2px solid " + T.bg + "}::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}"}</style>

    {/* TopBar */}
    <div style={{ flexShrink: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 44, background: T.headerBg, color: T.headerText }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>ПНИПУ</span>
          <span style={{ opacity: .5 }}>|</span>
          <span style={{ fontSize: 13 }}>Рабочие программы дисциплин</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setShowNotif(!showNotif)} style={{ position: "relative", border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: T.headerText }}>
            <BellIcon />
            {unreadCount > 0 && <span style={{ position: "absolute", top: -2, right: -4, background: T.red, color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{unreadCount}</span>}
          </button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,.2)" }} />
          <span style={{ fontSize: 12, opacity: .7, padding: "2px 8px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4 }}>{role}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</span>
          <button onClick={handleLogout} style={{ border: "none", background: "none", color: T.headerText, cursor: "pointer", fontSize: 12, opacity: .7 }}>Выйти</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "0 12px", paddingTop: 6, background: T.bg, borderBottom: "1px solid " + T.border }}>
        {navTabs.map(t => <TabBtn key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>
      <OpenRpdsBar
        openRpds={openRpds}
        panes={panes}
        splitRatio={splitRatio}
        draggingTabId={draggingTabId}
        activeTab={activeTab}
        onSetActiveTab={setActiveTab}
        onSetDragging={(id) => { setDraggingTabId(id); if (id === null) setDragOverSide(null); }}
        onFocusTab={focusTab}
        onCloseTab={closeRpdTab}
        onMergePanes={mergePanes}
      />
    </div>

    {/* Pages */}
    {activeTab === "my" && <RpdListPage rpds={rpds} onOpen={r => openRpdFn(r, false)} onEdit={r => openRpdFn(r, true)} onCreate={() => setShowCreate(true)} onExportPdf={handleExportPdf} userRole={role} />}
    {activeTab === "approval" && <ApprovalPage rpds={rpds} onOpen={r => openRpdFn(r, true)} />}
    {activeTab === "onApproval" && <OnApprovalPage rpds={rpds} onOpen={r => openRpdFn(r, false)} />}
    {activeTab === "archive" && <ArchivePage rpds={rpds} onOpen={r => openRpdFn(r, false)} />}
    {activeTab === "adminBups" && <AdminBupsPage />}
    {activeTab === "adminDirections" && <AdminDirectionsPage />}
    {activeTab === "system" && <SystemInfoPage />}

    {/* Зона редакторов. Все открытые РПД остаются смонтированными — переключение вкладок и
        переезд между панелями (drag-n-drop) не должны сбрасывать PDF, скролл и автоген-состояние.
        Поэтому каждая <RpdEditor /> обёрнута в position:absolute контейнер; меняется лишь геометрия,
        DOM-узел тот же → React не размонтирует. Контейнер-обёртка показывается только на «edit». */}
    <div ref={splitContainerRef} style={{ display: activeTab === "edit" ? "block" : "none", flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
      {openRpds.map(t => {
        const paneSide = findPaneOf(t.tabId);
        if (!paneSide) return null;
        const splitOn = !!panes.right;
        const isActiveInPane = paneSide === "left" ? panes.left.activeId === t.tabId : panes.right.activeId === t.tabId;
        const visible = activeTab === "edit" && isActiveInPane;
        const leftPct = (splitRatio * 100).toFixed(3) + "%";
        const rightPct = ((1 - splitRatio) * 100).toFixed(3) + "%";
        const positionStyle = splitOn
          ? (paneSide === "left"
            ? { left: 0, top: 0, width: leftPct, height: "100%" }
            : { left: leftPct, top: 0, width: rightPct, height: "100%" })
          : { left: 0, top: 0, width: "100%", height: "100%" };
        const hasPair = openRpds.some(o => o.id_rpd === t.id_rpd && o.tabId !== t.tabId);
        return <div key={t.tabId} style={{
          position: "absolute", ...positionStyle,
          display: visible ? "flex" : "none", flexDirection: "column",
          overflow: "hidden", minHeight: 0, boxSizing: "border-box",
        }}>
          <RpdEditor
            rpdId={t.id_rpd}
            tabId={t.tabId}
            editMode={t.mode === "edit"}
            hasPair={hasPair}
            reloadKey={tabReloadKeys[t.tabId] || 0}
            onAfterSave={() => notifyRpdChanged(t.tabId)}
            onOpenPair={() => openPairFor(t.tabId)}
            userRole={role}
            onBack={() => closeRpdTab(t.tabId)}
            onExportPdf={handleExportPdf}
            onToggleMode={() => toggleTabMode(t.tabId)}
            isActive={visible}
          />
        </div>;
      })}
      {/* Плейсхолдеры для пустых панелей. */}
      {panes.right && panes.right.activeId == null && <div style={{ position: "absolute", left: (splitRatio * 100).toFixed(3) + "%", top: 0, width: ((1 - splitRatio) * 100).toFixed(3) + "%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Правая панель пуста</div>}
      {panes.left.activeId == null && panes.left.tabs.length === 0 && !panes.right && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Нет открытых РПД</div>}
      {/* Разделитель + кнопка swap. Сидят поверх стыка панелей, мышью можно тянуть.
          Двойной клик по разделителю — сброс к 50/50. */}
      {panes.right && <>
        <div
          onMouseDown={startSplitResize}
          onDoubleClick={() => setSplitRatio(0.5)}
          title="Перетащите для изменения ширины · двойной клик — сбросить к 50/50"
          style={{
            position: "absolute", top: 0, height: "100%",
            left: `calc(${(splitRatio * 100).toFixed(3)}% - 3px)`, width: 6,
            cursor: "col-resize", zIndex: 30, background: "transparent",
          }}
        >
          <div style={{ position: "absolute", left: 2, top: 0, width: 2, height: "100%", background: T.border }} />
        </div>
        <button
          onClick={swapPanes}
          title="Поменять панели местами"
          style={{
            position: "absolute", top: 8,
            left: `calc(${(splitRatio * 100).toFixed(3)}% - 14px)`, width: 28, height: 28,
            borderRadius: 14, border: "1px solid " + T.border, background: T.surface,
            color: T.accent, cursor: "pointer", zIndex: 31,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontFamily: F, boxShadow: "0 1px 4px rgba(0,0,0,.12)",
          }}
        >⇄</button>
      </>}
      <PaneDropZones
        draggingTabId={draggingTabId}
        dragOverSide={dragOverSide}
        onSetDragOverSide={setDragOverSide}
        onDropToSide={(side) => { moveTabToPane(draggingTabId, side); setDraggingTabId(null); setDragOverSide(null); }}
      />
    </div>

    <NotifPanel show={showNotif} onClose={() => { setShowNotif(false); api.getUnreadCount().then(r => setUnreadCount(r.data.count)).catch(() => { }); }} />
    {showCreate && <CreateRpdModal onClose={() => setShowCreate(false)} onCreated={(r) => { setShowCreate(false); loadRpds(); openRpdFn(r, true); }} />}
  </div>;
}
