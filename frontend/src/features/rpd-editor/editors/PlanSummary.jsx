import { T } from "../../../theme.js";

/**
 * Шапка «по плану vs распределено» для раздела «Содержание дисциплины».
 * Если у РПД одна БУП-дисциплина — компактная плашка. Если несколько —
 * таблица со строкой на каждую (как «Просмотр РПД» в АРМ).
 *
 * `sections` — массив RpdSection, по которым считаем распределено.
 * `bupDisciplines` — массив RpdDetailOut.bup_disciplines.
 */
export function PlanSummary({ bupDisciplines, sections }) {
  if (!bupDisciplines || bupDisciplines.length === 0) {
    return <div style={{ padding: 10, marginBottom: 12, background: T.orangeLight, border: "1px solid " + T.orange, borderRadius: 6, fontSize: 12, color: T.orange }}>
      РПД не привязана к дисциплине БУПа — плановые часы недоступны. Создайте РПД заново через выбор БУПа, чтобы видеть план.
    </div>;
  }

  const distributed = {
    lec: sumOf(sections, "lecture_hours"),
    lab: sumOf(sections, "lab_hours"),
    pr:  sumOf(sections, "practice_hours"),
    srs: sumOf(sections, "self_study_hours"),
  };

  return <div style={{ marginBottom: 14, background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    <div style={{ padding: "8px 12px", background: T.bg, fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: ".4px", textTransform: "uppercase" }}>
      Часы по плану и фактическое распределение по разделам
    </div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th style={cellHead}>БУП-дисциплина</th>
          <th style={cellHead}>Сем.</th>
          <th style={cellHead}>Контроль</th>
          <th style={cellHead}></th>
          <th style={cellHeadCenter}>Всего</th>
          <th style={cellHeadCenter}>Лек</th>
          <th style={cellHeadCenter}>Лаб</th>
          <th style={cellHeadCenter}>Пр</th>
          <th style={cellHeadCenter}>КСР</th>
          <th style={cellHeadCenter}>СРС</th>
          <th style={cellHeadCenter}>ЗЕ</th>
        </tr>
      </thead>
      <tbody>
        {bupDisciplines.map((bd) => <PlanRows key={bd.id_bup_discipline} bd={bd} distributed={distributed} />)}
      </tbody>
    </table>
  </div>;
}


function PlanRows({ bd, distributed }) {
  const head = bd.bup_disciplines?.length > 1 || true; // всегда показываем заголовок строки
  return <>
    <tr>
      <td rowSpan={2} style={{ ...cellBody, fontWeight: 600 }}>
        <div>{bd.code || "—"}</div>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>{bd.bup_name}</div>
      </td>
      <td rowSpan={2} style={cellBody}>{bd.semester || "—"}</td>
      <td rowSpan={2} style={{ ...cellBody, fontSize: 11 }}>{bd.control_form || "—"}</td>
      <td style={{ ...cellBody, color: T.textMuted, whiteSpace: "nowrap" }}>по плану</td>
      <td style={cellNum}>{fmt(bd.total_hours)}</td>
      <td style={cellNum}>{fmt(bd.lecture_hours)}</td>
      <td style={cellNum}>{fmt(bd.lab_hours)}</td>
      <td style={cellNum}>{fmt(bd.practice_hours)}</td>
      <td style={cellNum}>{fmt(bd.ksr_hours)}</td>
      <td style={cellNum}>{fmt(bd.self_study_hours)}</td>
      <td style={cellNum}>{fmt(bd.zet)}</td>
    </tr>
    <tr>
      <td style={{ ...cellBody, color: T.textMuted, whiteSpace: "nowrap" }}>распределено</td>
      <td style={cellNum}>{distributed.lec + distributed.lab + distributed.pr + distributed.srs}</td>
      <td style={diff(distributed.lec, bd.lecture_hours)}>{distributed.lec}</td>
      <td style={diff(distributed.lab, bd.lab_hours)}>{distributed.lab}</td>
      <td style={diff(distributed.pr, bd.practice_hours)}>{distributed.pr}</td>
      <td style={cellNum}>—</td>
      <td style={diff(distributed.srs, bd.self_study_hours)}>{distributed.srs}</td>
      <td style={cellNum}>—</td>
    </tr>
  </>;
}


function fmt(v) { return (v == null ? "—" : v); }
function sumOf(rows, k) { return (rows || []).reduce((s, r) => s + (r[k] || 0), 0); }
function diff(actual, planned) {
  if (planned == null) return cellNum;
  const matches = (planned || 0) === (actual || 0);
  return { ...cellNum, color: matches ? T.green : T.red, fontWeight: 700, background: matches ? T.greenLight : "#fde6e3" };
}

const cellHead = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".3px", textAlign: "left", background: T.bg };
const cellHeadCenter = { ...cellHead, textAlign: "center" };
const cellBody = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 12, verticalAlign: "middle" };
const cellNum = { ...cellBody, textAlign: "center", fontVariantNumeric: "tabular-nums" };
