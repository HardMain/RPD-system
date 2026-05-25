import { useState } from "react";
import * as api from "../api/client.js";
import { T, F } from "../styles/index.js";
import { Input } from "../components/Input.jsx";
import { PasswordField } from "../components/PasswordField.jsx";

export function LoginPage({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
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
    <form onSubmit={go} style={{ background: T.surface, padding: 40, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.12)", border: "1px solid " + T.borderLight, width: 400, maxWidth: "90vw" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src="/login-logo.png" alt="Пермский Политех" style={{ height: 48, marginBottom: 14 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Информационная система</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>формирования рабочих программ дисциплин</div>
      </div>

      <Input label="Логин" value={u} onChange={e => setU(e.target.value)} placeholder="Введите логин" />
      <PasswordField label="Пароль" value={p} onChange={e => setP(e.target.value)} placeholder="Введите пароль" />

      {err && <div style={{ color: T.red, fontSize: 13, margin: "4px 0 14px", textAlign: "center" }}>{err}</div>}

      <button type="submit" disabled={ld} style={{ width: "100%", padding: 11, marginTop: 6, border: "none", borderRadius: 6, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: ld ? "default" : "pointer", opacity: ld ? 0.7 : 1, fontFamily: F }}>{ld ? "Вход..." : "Войти"}</button>

      <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", marginTop: 22, lineHeight: 1.5, borderTop: "1px solid " + T.borderLight, paddingTop: 16 }}>
        Если не удаётся войти или у вас нет данных для входа, обратитесь в техническую поддержку.
      </div>
    </form>
  </div>;
}
