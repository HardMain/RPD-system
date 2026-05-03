import { T } from "../../../theme.js";

/**
 * Шапка «по плану vs распределено» для раздела «Содержание дисциплины».
 *
 * Помогает преподавателю видеть, сколько часов он уже раскидал по разделам
 * относительно плана БУПа — и где не хватает или, наоборот, перебор.
 *
 * Структура:
 *   • Карточка на каждую BUP-привязку (multi-БУП — несколько карточек).
 *     В шапке карточки — код / БУП / семестр / форма контроля.
 *   • Внутри карточки — таблица: «Всего | Лек | Лаб | Пр | КСР | СРС».
 *     Если у дисциплины один семестр: две строки — «По плану» и
 *     «Распределено». Если несколько — те же две строки на каждый семестр,
 *     плюс финальная «Всего по дисциплине» (план целиком; красным то, что
 *     не сходится с распределённым).
 *   • Пустая ячейка в БУПе (None в semesters_data) показывается как «0»,
 *     чтобы преподаватель видел: «здесь часов не запланировано».
 *   • Красная подсветка — на любой ячейке распределения, которая не равна
 *     соответствующей ячейке плана.
 *
 * `sections` — массив RpdSection, по которым считаем распределённое.
 * `bupDisciplines` — массив RpdDetailOut.bup_disciplines.
 */
export function PlanSummary({ bupDisciplines, sections }) {
  if (!bupDisciplines || bupDisciplines.length === 0) {
    return <div style={{ padding: 10, marginBottom: 12, background: T.orangeLight, border: "1px solid " + T.orange, borderRadius: 6, fontSize: 12, color: T.orange }}>
      РПД не привязана к дисциплине БУПа — плановые часы недоступны. Создайте РПД заново через выбор БУПа, чтобы видеть план.
    </div>;
  }

  return <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
    {bupDisciplines.map(bd => (
      <BdCard key={bd.id_bup_discipline ?? bd.bup_name} bd={bd} sections={sections} />
    ))}
  </div>;
}


function BdCard({ bd, sections }) {
  // Реальные семестры дисциплины: либо из semesters_data (заполняет XLS-парсер
  // из блоков с часами на семестр), либо один блок-fallback по агрегатным
  // полям BD (старые данные / БУП без per-semester блоков).
  const semesters = (bd.semesters_data && bd.semesters_data.length > 0)
    ? bd.semesters_data.map(s => ({
        number: s.number,
        lec: s.lecture, lab: s.lab, pr: s.practice, ksr: s.ksr, srs: s.srs,
      }))
    : [{
        number: parseInt(String(bd.semester || "1").split(/[,\s\-]/)[0], 10) || 1,
        lec: bd.lecture_hours, lab: bd.lab_hours, pr: bd.practice_hours,
        ksr: bd.ksr_hours, srs: bd.self_study_hours,
      }];
  const isMulti = semesters.length > 1;
  const fallbackSem = semesters[0]?.number ?? 1;

  // Часы разделов, сгруппированные по семестру. Раздел без явного
  // section.semester (старые данные / single-семестр) попадает в fallback.
  function distributedFor(semNum) {
    const inGroup = (sections || []).filter(s => {
      const sec = s.semester ?? fallbackSem;
      return sec === semNum;
    });
    return {
      lec: inGroup.reduce((a, s) => a + (s.lecture_hours || 0), 0),
      lab: inGroup.reduce((a, s) => a + (s.lab_hours || 0), 0),
      pr:  inGroup.reduce((a, s) => a + (s.practice_hours || 0), 0),
      ksr: 0, // КСР не вводится в RpdSection — план показываем, факт — 0.
      srs: inGroup.reduce((a, s) => a + (s.self_study_hours || 0), 0),
    };
  }

  // Итог по всем семестрам (для multi). План — сумма по semesters_data,
  // фактическое распределение — сумма всех разделов.
  const planAll = sumPlanOver(semesters);
  const distAll = sumDistOver(semesters.map(s => distributedFor(s.number)));

  return <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    {/* Шапка карточки — мета BD: код, имя БУПа, семестр, контроль. */}
    <div style={{ padding: "8px 12px", background: T.bg, borderBottom: "1px solid " + T.borderLight, display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>{bd.code || "—"}</span>
      <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{bd.bup_name || ""}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: T.textMuted }}>Семестр: <b style={{ color: T.text }}>{bd.semester || "—"}</b></span>
      <span style={{ fontSize: 11, color: T.textMuted }}>Контроль: <b style={{ color: T.text }}>{bd.control_form || "—"}</b></span>
    </div>

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "32%" }} />
        <col style={{ width: "12%" }} />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th style={hCell}></th>
          <th style={hCellC}>Всего</th>
          <th style={hCellC}>Лек</th>
          <th style={hCellC}>Лаб</th>
          <th style={hCellC}>Пр</th>
          <th style={hCellC}>КСР</th>
          <th style={hCellC}>СРС</th>
        </tr>
      </thead>
      <tbody>
        {semesters.map(sem => {
          const dist = distributedFor(sem.number);
          return <SemBlock
            key={sem.number}
            sem={sem}
            dist={dist}
            showHeader={isMulti}
          />;
        })}
        {isMulti && <TotalRow plan={planAll} dist={distAll} />}
      </tbody>
    </table>
  </div>;
}


function SemBlock({ sem, dist, showHeader }) {
  // Пустые ячейки плана показываем как 0 — чтобы преподаватель сразу видел,
  // что в этом виде занятий часов не запланировано.
  const planTotal = (z(sem.lec)) + (z(sem.lab)) + (z(sem.pr)) + (z(sem.ksr)) + (z(sem.srs));
  const distTotal = dist.lec + dist.lab + dist.pr + dist.ksr + dist.srs;
  return <>
    {showHeader && <tr>
      <td colSpan={7} style={{ ...bCell, fontWeight: 700, background: T.bg, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", fontSize: 11 }}>
        {sem.number}-й семестр
      </td>
    </tr>}
    <tr>
      <td style={{ ...bCell, color: T.textMuted }}>По плану</td>
      <td style={numCell}>{planTotal}</td>
      <td style={numCell}>{z(sem.lec)}</td>
      <td style={numCell}>{z(sem.lab)}</td>
      <td style={numCell}>{z(sem.pr)}</td>
      <td style={numCell}>{z(sem.ksr)}</td>
      <td style={numCell}>{z(sem.srs)}</td>
    </tr>
    <tr>
      <td style={{ ...bCell, color: T.textMuted }}>Распределено</td>
      <td style={mismatch(distTotal, planTotal)}>{distTotal}</td>
      <td style={mismatch(dist.lec, z(sem.lec))}>{dist.lec}</td>
      <td style={mismatch(dist.lab, z(sem.lab))}>{dist.lab}</td>
      <td style={mismatch(dist.pr,  z(sem.pr))}>{dist.pr}</td>
      <td style={mismatch(dist.ksr, z(sem.ksr))}>{dist.ksr}</td>
      <td style={mismatch(dist.srs, z(sem.srs))}>{dist.srs}</td>
    </tr>
  </>;
}


function TotalRow({ plan, dist }) {
  // Строка «Всего по дисциплине»: показываем плановую сумму. Если
  // распределённая сумма не совпадает — ячейка подсвечена красным.
  const planTotal = plan.lec + plan.lab + plan.pr + plan.ksr + plan.srs;
  const distTotal = dist.lec + dist.lab + dist.pr + dist.ksr + dist.srs;
  return <tr>
    <td style={{ ...bCell, fontWeight: 700, color: T.text, background: T.bg }}>Всего по дисциплине</td>
    <td style={mismatchTotal(distTotal, planTotal)}>{planTotal}</td>
    <td style={mismatchTotal(dist.lec, plan.lec)}>{plan.lec}</td>
    <td style={mismatchTotal(dist.lab, plan.lab)}>{plan.lab}</td>
    <td style={mismatchTotal(dist.pr,  plan.pr)}>{plan.pr}</td>
    <td style={mismatchTotal(dist.ksr, plan.ksr)}>{plan.ksr}</td>
    <td style={mismatchTotal(dist.srs, plan.srs)}>{plan.srs}</td>
  </tr>;
}


// ─── helpers ────────────────────────────────────────────────────────────────

// Конвертация null/undefined → 0 (для отображения плановых ячеек).
function z(v) { return typeof v === "number" ? v : 0; }

function sumPlanOver(semesters) {
  return {
    lec: semesters.reduce((a, s) => a + z(s.lec), 0),
    lab: semesters.reduce((a, s) => a + z(s.lab), 0),
    pr:  semesters.reduce((a, s) => a + z(s.pr),  0),
    ksr: semesters.reduce((a, s) => a + z(s.ksr), 0),
    srs: semesters.reduce((a, s) => a + z(s.srs), 0),
  };
}

function sumDistOver(distArr) {
  return {
    lec: distArr.reduce((a, d) => a + d.lec, 0),
    lab: distArr.reduce((a, d) => a + d.lab, 0),
    pr:  distArr.reduce((a, d) => a + d.pr,  0),
    ksr: distArr.reduce((a, d) => a + d.ksr, 0),
    srs: distArr.reduce((a, d) => a + d.srs, 0),
  };
}

// Стиль ячейки «распределено»: красный, если не совпало с планом; нейтральный,
// если совпало.
function mismatch(actual, planned) {
  return (actual || 0) === (planned || 0)
    ? numCell
    : { ...numCell, color: T.red, fontWeight: 700, background: "#fde6e3" };
}

// Тот же подход в финальной строке «Всего по дисциплине», но мы рендерим
// плановое число — а подсветка красным включается, когда РАСПРЕДЕЛЕНО ≠ ПЛАН.
function mismatchTotal(actual, planned) {
  return (actual || 0) === (planned || 0)
    ? { ...numCell, fontWeight: 700, background: T.bg }
    : { ...numCell, fontWeight: 700, color: T.red, background: "#fde6e3" };
}

const hCell = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".3px", textAlign: "left", background: T.bg };
const hCellC = { ...hCell, textAlign: "center" };
const bCell = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 12, verticalAlign: "middle" };
const numCell = { ...bCell, textAlign: "center", fontVariantNumeric: "tabular-nums" };
