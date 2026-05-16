import { useEffect, useState } from "react";
import * as api from "../api/client.js";
import { T } from "../styles/index.js";

export function SystemInfoPage() {
  const [h, setH] = useState(null);
  useEffect(() => { api.getHealth().then(r => setH(r.data)).catch(() => { }); }, []);
  const cards = [
    { title: "Статус", rows: [["Сервер", h ? "online" : "...", h ? T.green : T.orange], ["LLM", "demo-режим", T.orange], ["Версия", h?.version || "1.0.0"]] },
    { title: "О системе", rows: [["Организация", "ПНИПУ"], ["Модель LLM", "настраивается в .env"]] },
  ];
  return <div style={{ flex: 1, overflow: "auto", padding: 24, background: T.bg }}>
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Системная информация</div>
      {cards.map(c => <div key={c.title} style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{c.title}</div>
        {c.rows.map(r => <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: T.textMuted }}>{r[0]}</span>
          <span style={{ color: r[2] || T.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {r[2] && <span style={{ width: 8, height: 8, borderRadius: 4, background: r[2], display: "inline-block" }} />}{r[1]}
          </span>
        </div>)}
      </div>)}
    </div>
  </div>;
}
