import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../styles/index.js";
import { ReviewerChain } from "../../../components/ReviewerChain.jsx";
import { AlertModal } from "../EditorModals.jsx";

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function ApprovalRouteEditor({ rpdId, rpd, canEdit, user, reload, routeApiRef }) {
  const route = rpd.approval_route || [];
  const status = rpd.status;
  const hasChainPerm = api.userCan(user, "approval_chain.edit");
  const isOwner = !!user && rpd.id_author === user.id_user;
  const ownerEditable = isOwner && canEdit && (status === "Черновик" || status === "На доработке");
  const editable = status !== "Согласовано" && (ownerEditable || hasChainPerm);

  const persistedIds = useMemo(() => route.map(s => s.id_reviewer), [route]);
  const [draftIds, setDraftIds] = useState(persistedIds);
  const [reviewers, setReviewers] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const baseIdsRef = useRef(persistedIds);

  useEffect(() => {
    if (!editable) return;
    api.getReviewers().then(r => setReviewers(r.data || [])).catch(() => setReviewers([]));
  }, [editable]);

  useEffect(() => {
    if (!sameIds(draftIds, baseIdsRef.current)) return;
    baseIdsRef.current = persistedIds;
    setDraftIds(persistedIds);

  }, [persistedIds]);

  const dirty = editable && !sameIds(draftIds, baseIdsRef.current);

  async function commit() {
    try {
      await api.setApprovalRoute(rpdId, draftIds);
      baseIdsRef.current = draftIds;
      await reload();
      return true;
    } catch (e) {
      setErrorMsg("Не удалось сохранить маршрут: " + (e?.response?.data?.detail || e.message));
      return false;
    }
  }

  useEffect(() => {
    if (!routeApiRef) return;
    routeApiRef.current = { isDirty: () => dirty, commit };
    return () => { if (routeApiRef) routeApiRef.current = null; };
  });

  const routeReviewers = route.map(s => ({
    id_user: s.id_reviewer, full_name: s.reviewer_name,
    title: s.reviewer_title, role: "", department: "",
  }));

  if (!editable) {
    return <ReviewerChain
      reviewers={routeReviewers}
      selectedIds={route.map(s => s.id_reviewer)}
      onChange={() => {}}
      readOnly
      statuses={route.map(s => s.status)}
    />;
  }

  const merged = [...reviewers];
  for (const r of routeReviewers) {
    if (!merged.some(m => m.id_user === r.id_user)) merged.push(r);
  }

  return <>
    <ReviewerChain
      reviewers={merged}
      selectedIds={draftIds}
      onChange={setDraftIds}
      statuses={dirty ? null : route.map(s => s.status)}
    />
    {dirty && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
      Изменения маршрута сохранятся при закрытии окна. Согласующим уйдёт одно уведомление.
    </div>}
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}
