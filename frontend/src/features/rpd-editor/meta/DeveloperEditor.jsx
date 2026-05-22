import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { TrashIcon } from "../../../components/icons.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

export function DeveloperEditor({ rpdId, developers, canEdit, reload }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const max = 2;

  async function performDelete(dev) {
    if (!dev) return;
    try { await api.removeDeveloper(dev.id_rpd_developer); await reload(); } catch {}
  }
  function handleDelete(dev) { setPendingDelete(dev); }

  return <div style={{ border: "1px solid " + T.borderLight, borderRadius: 4, overflow: "hidden" }}>
    {developers.length === 0 && <div style={{ padding: "8px 12px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>Не указаны</div>}
    {developers.map((d, i) => (
      <div key={d.id_rpd_developer} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: i < developers.length - 1 ? "1px solid " + T.borderLight : "none", fontSize: 13 }}>
        <span style={{ width: 110, color: T.textMuted, fontSize: 12 }}>Разработчик {i + 1}</span>
        <span style={{ flex: 1 }}>
          {d.full_name}
          {d.title && <span style={{ color: T.textMuted, marginLeft: 8, fontSize: 12 }}>· {d.title}</span>}
        </span>
        {canEdit && <button onClick={() => handleDelete(d)} title="Убрать" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><TrashIcon /></button>}
      </div>
    ))}
    {canEdit && developers.length < max && (
      showPicker
        ? <DeveloperPicker
            excludeIds={developers.map(d => d.id_user)}
            onPick={async (uid) => {
              try { await api.addDeveloper(rpdId, uid); setShowPicker(false); await reload(); } catch {}
            }}
            onCancel={() => setShowPicker(false)}
          />
        : <div style={{ padding: 8, borderTop: developers.length > 0 ? "1px solid " + T.borderLight : "none" }}>
            <Btn small onClick={() => setShowPicker(true)}>+ Добавить разработчика</Btn>
          </div>
    )}
    {pendingDelete && <ConfirmDeleteModal
      title="Убрать разработчика?"
      message={`«${pendingDelete.full_name}» будет удалён из списка разработчиков этой РПД. Сам пользователь в системе остаётся.`}
      confirmLabel="Убрать"
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performDelete(d); }}
    />}
  </div>;
}

function DeveloperPicker({ excludeIds, onPick, onCancel }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const debRef = useRef(null);

  async function fetchUsers(v) {
    try {
      const r = await api.searchUsers(v);
      setItems((r.data || []).filter(u => !excludeIds.includes(u.id_user)));
    } catch { setItems([]); }
    setLoading(false);
  }

  function search(v) {
    setQ(v); setLoading(true);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchUsers(v), 200);
  }

  useEffect(() => {
    fetchUsers("");
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, []);

  return <div style={{ padding: 10, borderTop: "1px solid " + T.borderLight, background: T.bg }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      <input
        autoFocus
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="Поиск по ФИО…"
        style={{ flex: 1, padding: "6px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F }}
      />
      <Btn small onClick={onCancel}>Отмена</Btn>
    </div>
    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid " + T.borderLight, borderRadius: 4, background: T.surface }}>
      {loading && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Поиск…</div>}
      {!loading && items.length === 0 && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Никого не нашлось</div>}
      {!loading && items.map(u => (
        <button key={u.id_user} onClick={() => onPick(u.id_user)}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: "1px solid " + T.borderLight, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{[u.title, u.role, u.department].filter(Boolean).join(" · ")}</div>
        </button>
      ))}
    </div>
  </div>;
}
