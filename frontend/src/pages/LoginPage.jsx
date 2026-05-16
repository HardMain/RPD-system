import { useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../styles/index.js";
import { Input } from "../components/Input.jsx";

export function LoginPage({ onLogin }) {
  const [u, setU] = useState("ivanov");
  const [p, setP] = useState("password");
  const [err, setErr] = useState("");
  const [ld, setLd] = useState(false);

  const go = async e => {
    e.preventDefault(); setLd(true); setErr("");
    try {
      const r = await api.login(u, p);
      localStorage.setItem("token", r.data.access_token);
      onLogin(r.data.user);
    } catch (e) {

      if (!e.response) {
        setErr("Сервер не отвечает. Подождите окончания запуска контейнеров и повторите.");
      } else if (e.response.status === 401) {
        setErr("Неверные учётные данные");
      } else {
        setErr(`Ошибка сервера (${e.response.status}). Повторите попытку.`);
      }
    }
    finally { setLd(false); }
  };

  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}>
    <form onSubmit={go} style={{ background: T.surface, padding: 40, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.1)", width: 380 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>ПНИПУ</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>ИС формирования РПД</div>
      </div>
      <Input label="Логин" value={u} onChange={e => setU(e.target.value)} />
      <Input label="Пароль" value={p} onChange={e => setP(e.target.value)} type="password" />
      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
      <button type="submit" disabled={ld} style={{ width: "100%", padding: 10, border: "none", borderRadius: 6, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{ld ? "Вход..." : "Войти"}</button>
      <div style={{ fontSize: 11, color: T.textLight, textAlign: "center", marginTop: 16 }}>ivanov / password (препод) · petrov / password (зав. каф.) · admin / password (админ)</div>
    </form>
  </div>;
}
