import { useEffect, useState } from "react";
import * as api from "../../api/client.js";
import { T } from "../../styles/index.js";
import { formatDateTimeRu } from "../../utils/format.js";

export function NotifPanel({ show, onClose }) {
  const [ns, setNs] = useState([]);
  useEffect(() => { if (show) api.getNotifications().then(r => setNs(r.data)).catch(() => { }); }, [show]);
  const unread = ns.filter(n => !n.is_read).length;
  if (!show) return null;
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.3)" }}>
    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 50, right: 16, width: 360, maxHeight: 500, background: T.surface, borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + T.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Уведомления{unread > 0 ? ` (${unread})` : ""}</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: T.textMuted }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>{ns.length === 0
        ? <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Нет уведомлений</div>
        : ns.map(n => <div key={n.id_notification} style={{ padding: "12px 16px", borderBottom: "1px solid " + T.borderLight, background: n.is_read ? T.surface : T.accentLight + "44" }}>
          <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>
          {n.created_at && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{formatDateTimeRu(n.created_at)}</div>}
        </div>)}</div>
      {unread > 0 && <div style={{ padding: "10px 16px", borderTop: "1px solid " + T.borderLight, textAlign: "center" }}>
        <span onClick={() => { api.readAllNotifications(); setNs(ns.map(n => ({ ...n, is_read: true }))); }} style={{ fontSize: 12, color: T.accent, cursor: "pointer", fontWeight: 600 }}>Прочитать все</span>
      </div>}
    </div>
  </div>;
}
