import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../styles/index.js";
import { AlertModal } from "../EditorModals.jsx";

const head = { padding: "8px 10px", borderBottom: "1px solid " + T.border, background: T.bg, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", textAlign: "left", wordBreak: "normal", overflowWrap: "break-word" };
const cell = { padding: "8px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 12, verticalAlign: "top", wordBreak: "normal", overflowWrap: "break-word" };

export function BupDisciplinesTable({ bupDisciplines, disciplineName }) {
  const [errorMsg, setErrorMsg] = useState(null);
  if (bupDisciplines.length === 0) {
    return <div style={{ padding: "10px 14px", background: T.bg, borderRadius: 4, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
      Дисциплины БУПа не привязаны.
    </div>;
  }
  return <div className="table-scroll" style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={head}>План</th>
          <th style={head}>Индекс</th>
          <th style={head}>Дисциплина БУПа</th>
          <th style={head}>Направление</th>
          <th style={head}>Профиль</th>
          <th style={head}>Сем. / часы / ЗЕ</th>
          <th style={head}>ФГОС</th>
        </tr>
      </thead>
      <tbody>
        {bupDisciplines.map(b => (
          <tr key={b.id_bup_discipline}>
            <td style={cell}>
              {b.bup_name}
              {b.bup_deleted && (
                <div style={{ fontSize: 10, color: T.textLight, fontStyle: "italic", marginTop: 2 }}>
                  БУП удалён из БД
                </div>
              )}
            </td>
            <td style={cell}><b>{b.code || "—"}</b></td>
            <td style={cell}>{disciplineName}</td>
            <td style={cell}>{b.direction_code ? `${b.direction_code} ${b.direction_name || ""}` : (b.direction_name || "—")}</td>
            <td style={cell}>{b.direction_profile || "—"}</td>
            <td style={cell}>
              {b.semester || "—"} · {b.total_hours ?? "—"} ч · {b.zet ?? "—"} ЗЕ
            </td>
            <td style={cell}>
              {b.fgos_file_id
                ? <button onClick={() => api.openFile(b.fgos_file_id).catch(() => setErrorMsg("Не удалось открыть файл."))} style={{ color: T.accent, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" }}>
                    📄 {b.fgos_file_name || "Просмотр"}
                  </button>
                : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не прикреплён</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </div>;
}

export function ManualDisciplineTable({ bupDisciplines, disciplineName }) {
  const link = (bupDisciplines || []).find(b => b.is_manual);
  if (!link) {
    return <div style={{ padding: "10px 14px", background: T.bg, borderRadius: 4, fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
      Параметры не заданы.
    </div>;
  }
  const volumeParts = [];
  if (link.semester) volumeParts.push(`сем. ${link.semester}`);
  if (link.total_hours) volumeParts.push(`${link.total_hours} ч`);
  if (link.zet) volumeParts.push(`${link.zet} ЗЕ`);
  return <div className="table-scroll" style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={head}>Направление</th>
          <th style={head}>Профиль</th>
          <th style={head}>Форма обучения</th>
          <th style={head}>Сем. / часы / ЗЕ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={cell}>{link.direction_code ? `${link.direction_code} ${link.direction_name || ""}` : (link.direction_name || "—")}</td>
          <td style={cell}>{link.direction_profile || "—"}</td>
          <td style={cell}>{link.form_of_study || "—"}</td>
          <td style={cell}>{volumeParts.join(" · ") || "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>;
}
