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
import { AdminUsersPage } from "./pages/AdminUsersPage.jsx";
import { SystemInfoPage } from "./pages/SystemInfoPage.jsx";
import { AdminBupsPage } from "./pages/AdminBupsPage.jsx";
import { AdminDirectionsPage } from "./pages/AdminDirectionsPage.jsx";
import { AdminDictionariesPage } from "./pages/AdminDictionariesPage.jsx";

import { NotifPanel } from "./features/notifications/NotifPanel.jsx";
import { CreateRpdModal } from "./features/rpd-create/CreateRpdModal.jsx";
import { OpenRpdsBar } from "./features/tabs/OpenRpdsBar.jsx";
import { PaneDropZones } from "./features/tabs/PaneDropZones.jsx";
import { RpdEditor } from "./features/rpd-editor/RpdEditor.jsx";
import { AlertModal } from "./features/rpd-editor/EditorModals.jsx";

pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker();

export default function App() {
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("my");
  const [rpds, setRpds] = useState([]);

  const [openRpds, setOpenRpds] = useState([]);

  const [panes, setPanes] = useState({ left: { tabs: [], activeId: null }, right: null });
  const [draggingTabId, setDraggingTabId] = useState(null);

  const [dragOverSide, setDragOverSide] = useState(null);

  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef(null);
  const resizingSplitRef = useRef(false);

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

  const loadRpds = useCallback(async () => {
    const maxAttempts = 6;
    for (let i = 0; i < maxAttempts; i++) {
      try { const r = await api.getRpds(); setRpds(r.data); return; }
      catch {
        if (i === maxAttempts - 1) return;
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, i)));
      }
    }
  }, []);
  const loadUnread = useCallback(async () => {
    for (let i = 0; i < 6; i++) {
      try { const r = await api.getUnreadCount(); setUnreadCount(r.data.count); return; }
      catch {
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, i)));
      }
    }
  }, []);
  useEffect(() => {
    if (user) { loadRpds(); loadUnread(); }
  }, [user, loadRpds, loadUnread]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === "my") {
      loadRpds();
    }
  }, [user, activeTab, loadRpds]);

  function findPaneOf(tabId) {
    if (panes.left.tabs.includes(tabId)) return "left";
    if (panes.right && panes.right.tabs.includes(tabId)) return "right";
    return null;
  }
  function oppositeSide(side) { return side === "left" ? "right" : "left"; }
  function newTabId(id_rpd, mode) { return `tab-${id_rpd}-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

  function openRpdFn(rpd, editMode, options = {}) {
    const mode = editMode ? "edit" : "view";

    const sameTab = openRpds.find(t => t.id_rpd === rpd.id_rpd && t.mode === mode);
    if (sameTab) {
      if (!options.skipFocus) focusTab(sameTab.tabId);
      return;
    }

    const other = openRpds.find(t => t.id_rpd === rpd.id_rpd);
    let targetSide = options.targetSide;
    if (!targetSide) targetSide = other ? oppositeSide(findPaneOf(other.tabId)) : "left";

    const tabId = newTabId(rpd.id_rpd, mode);

    setOpenRpds(prev => [...prev, { ...rpd, tabId, id_rpd: rpd.id_rpd, mode }]);
    setPanes(prev => {
      if (targetSide === "right") {
        if (!prev.right) return { ...prev, right: { tabs: [tabId], activeId: tabId } };
        return { ...prev, right: { tabs: [...prev.right.tabs, tabId], activeId: tabId } };
      }
      return { ...prev, left: { tabs: [...prev.left.tabs, tabId], activeId: tabId } };
    });
    if (!options.skipFocus) setActiveTab("edit");
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

    const sibling = openRpds.find(t => t.id_rpd === tab.id_rpd && t.mode === newMode);
    if (sibling) { focusTab(sibling.tabId); return; }
    setOpenRpds(prev => prev.map(t => t.tabId === tabId ? { ...t, mode: newMode } : t));
  }

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

    setSplitRatio(r => 1 - r);
  }

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

  const [exportError, setExportError] = useState(null);
  async function handleExportPdf(rpdId, bdId) {
    try {
      const r = await api.exportPdf(rpdId, bdId);
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a"); a.href = url; a.download = `RPD_${rpdId}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { setExportError("Не удалось сформировать PDF — попробуйте ещё раз."); }
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null); setOpenRpds([]);
    setPanes({ left: { tabs: [], activeId: null }, right: null });
    setTabReloadKeys({});

    setActiveTab("my");
  };

  useEffect(() => {
    if (!user) return;
    const allowed = new Set(["my", "system", "edit"]);
    if (api.userCan(user, "users.manage") || api.userCan(user, "users.create")) allowed.add("adminUsers");
    if (api.userCan(user, "bups.manage")) allowed.add("adminBups");
    if (api.userCan(user, "directions.manage")) allowed.add("adminDirections");
    if (api.userCan(user, "reference.manage")) allowed.add("adminDictionaries");
    if (!allowed.has(activeTab)) setActiveTab("my");
  }, [user, activeTab]);

  if (checking) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}><Spinner size={40} /></div>;
  if (!user) return <LoginPage onLogin={u => setUser(u)} />;

  const role = user.role;
  const canManageBups = api.userCan(user, "bups.manage");
  const canManageDirections = api.userCan(user, "directions.manage");
  const canManageUsers = api.userCan(user, "users.manage") || api.userCan(user, "users.create");
  const canManageDictionaries = api.userCan(user, "reference.manage");
  const navTabs = [
    { id: "my", label: `РПД (${rpds.length})` },
    canManageUsers ? { id: "adminUsers", label: "Пользователи" } : null,
    canManageBups ? { id: "adminBups", label: "БУПы" } : null,
    canManageDirections ? { id: "adminDirections", label: "ФГОС" } : null,
    canManageDictionaries ? { id: "adminDictionaries", label: "Справочники" } : null,
    { id: "system", label: "Система" },
  ].filter(Boolean);

  return <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: F, color: T.text, background: T.bg }}>
    <style>{"*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes secFlash{0%{box-shadow:0 0 0 2px " + T.accent + "00}50%{box-shadow:0 0 0 2px " + T.accent + "66}100%{box-shadow:0 0 0 2px " + T.accent + "00}}.sec-flash{animation:secFlash 1.6s ease-in-out;border-radius:6px}@keyframes savedFade{0%{opacity:0;transform:translateY(2px)}25%{opacity:1;transform:none}75%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-2px)}}.saved-fade{animation:savedFade 1.5s ease-in-out;display:inline-block}@keyframes errFlash{0%{box-shadow:0 0 0 2px " + T.red + "00}50%{box-shadow:0 0 0 2px " + T.red + "AA}100%{box-shadow:0 0 0 2px " + T.red + "00}}.err-flash{animation:errFlash 2.1s ease-in-out;border-radius:6px}html,body{overflow:hidden;height:100%}::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:" + T.bg + "}::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:5px;border:2px solid " + T.bg + "}::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}.table-scroll{width:100%;overflow-x:auto}.table-scroll::-webkit-scrollbar{height:6px;width:6px}.table-scroll::-webkit-scrollbar-track{background:transparent}.table-scroll::-webkit-scrollbar-thumb{background:" + T.borderLight + ";border:none;border-radius:3px}.table-scroll::-webkit-scrollbar-thumb:hover{background:" + T.border + "}.expandable-field::-webkit-scrollbar{width:8px}.expandable-field::-webkit-scrollbar-track{background:" + T.bg + ";margin:28px 0 4px 0;border-radius:4px}.expandable-field::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:4px;border:none}.expandable-field::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}.expandable-field-sm::-webkit-scrollbar{width:6px}.expandable-field-sm::-webkit-scrollbar-track{background:" + T.bg + ";margin:24px 0 2px 0;border-radius:3px}.expandable-field-sm::-webkit-scrollbar-thumb{background:" + T.border + ";border-radius:3px;border:none}.expandable-field-sm::-webkit-scrollbar-thumb:hover{background:" + T.textMuted + "}"}</style>

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
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.15 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</span>
            {user.title && <span style={{ fontSize: 11, opacity: .65 }}>{user.title}</span>}
          </span>
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

    {activeTab === "my" && <RpdListPage rpds={rpds} onOpen={(r, opts) => openRpdFn(r, false, opts)} onEdit={(r, opts) => openRpdFn(r, true, opts)} onCreate={() => setShowCreate(true)} onExportPdf={handleExportPdf} user={user} />}
    {activeTab === "adminUsers" && <AdminUsersPage user={user} />}
    {activeTab === "adminBups" && <AdminBupsPage />}
    {activeTab === "adminDirections" && <AdminDirectionsPage />}
    {activeTab === "adminDictionaries" && <AdminDictionariesPage />}
    {activeTab === "system" && <SystemInfoPage />}

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
            user={user}
            onCloseTab={() => closeRpdTab(t.tabId)}
            onExportPdf={handleExportPdf}
            onToggleMode={() => toggleTabMode(t.tabId)}
            isActive={visible}
          />
        </div>;
      })}

      {panes.right && panes.right.activeId == null && <div style={{ position: "absolute", left: (splitRatio * 100).toFixed(3) + "%", top: 0, width: ((1 - splitRatio) * 100).toFixed(3) + "%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Правая панель пуста</div>}
      {panes.left.activeId == null && panes.left.tabs.length === 0 && !panes.right && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>Нет открытых РПД</div>}

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
          <div style={{ position: "absolute", left: 2, top: 0, width: 2, height: "100%", background: T.headerBg }} />
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
    {exportError && <AlertModal title="Ошибка экспорта" message={exportError} onClose={() => setExportError(null)} />}
  </div>;
}
