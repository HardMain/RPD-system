import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { useRpdEditor } from "../RpdEditorContext.jsx";

/**
 * Раздел «Просмотр РПД» — таблица всех БУП-дисциплин этой РПД с привязанным
 * файлом ФГОС (через цепочку БУП → Направление → ФГОС).
 *
 * Аналог одноимённой вкладки в АРМ РПД ПНИПУ.
 */
export function ViewRpdEditor() {
  const { rpd } = useRpdEditor();
  const list = rpd.bup_disciplines || [];

  if (list.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      РПД не привязана ни к одной дисциплине БУПа.
    </div>;
  }

  return <div>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
      Печатная форма РПД формируется для каждой строки таблицы. Файл ФГОС подтягивается через цепочку «дисциплина БУП → БУП → направление подготовки» и доступен для просмотра — его прикрепляет администратор.
    </div>
    <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={head}>План</th>
            <th style={head}>Индекс</th>
            <th style={head}>Дисциплина БУПа</th>
            <th style={head}>Направление подготовки</th>
            <th style={head}>Направленность (профиль)</th>
            <th style={head}>Файл ФГОС</th>
          </tr>
        </thead>
        <tbody>
          {list.map(b => (
            <tr key={b.id_bup_discipline}>
              <td style={cell}>{b.bup_name}</td>
              <td style={cell}><b>{b.code || "—"}</b></td>
              <td style={cell}>{rpd.discipline_name}</td>
              <td style={cell}>{b.direction_code ? `${b.direction_code} ${b.direction_name || ""}` : (b.direction_name || "—")}</td>
              <td style={cell}>{b.direction_profile || "—"}</td>
              <td style={cell}>
                {b.fgos_file_id
                  ? <a href={api.fileUrl(b.fgos_file_id)} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 600 }}>
                      📄 {b.fgos_file_name || "Просмотр"}
                    </a>
                  : <span style={{ color: T.textMuted, fontStyle: "italic" }}>не прикреплён</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>;
}

const head = { padding: "8px 10px", borderBottom: "1px solid " + T.border, background: T.bg, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", textAlign: "left" };
const cell = { padding: "8px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 13, verticalAlign: "top" };
