import { T } from "../../../styles/index.js";

export function PlanSummary({ bupDisciplines, sections }) {
  if (!bupDisciplines || bupDisciplines.length === 0) {
    return <div style={{ padding: 10, marginBottom: 12, background: T.orangeLight, border: "1px solid " + T.orange, borderRadius: 6, fontSize: 12, color: T.orange }}>
      РПД без привязки к дисциплине и без ручного ввода — плановые часы недоступны. Создайте РПД заново и укажите часы в модалке создания.
    </div>;
  }

  return <div style={{ marginBottom: 14 }}>
    <MergedBdCard bds={bupDisciplines} sections={sections} />
  </div>;
}

function _semestersOf(bd) {
  if (bd.semesters_data && bd.semesters_data.length > 0) {
    return bd.semesters_data.map(s => ({
      number: s.number,
      lec: s.lecture, lab: s.lab, pr: s.practice, ksr: s.ksr, srs: s.srs,
    }));
  }
  return [{
    number: parseInt(String(bd.semester || "1").split(/[,\s\-]/)[0], 10) || 1,
    lec: bd.lecture_hours, lab: bd.lab_hours, pr: bd.practice_hours,
    ksr: bd.ksr_hours, srs: bd.self_study_hours,
  }];
}

function MergedBdCard({ bds, sections }) {
  const semestersByNum = new Map();
  const conflicts = new Set();
  for (const bd of bds) {
    for (const sem of _semestersOf(bd)) {
      if (sem.number == null) continue;
      const existing = semestersByNum.get(sem.number);
      if (!existing) {
        semestersByNum.set(sem.number, sem);
      } else {
        for (const k of ["lec", "lab", "pr", "ksr", "srs"]) {
          if (z(existing[k]) !== z(sem[k])) conflicts.add(sem.number);
        }
      }
    }
  }
  const semesters = [...semestersByNum.values()].sort((a, b) => a.number - b.number);
  const isMulti = semesters.length > 1;
  const fallbackSem = semesters[0]?.number ?? 1;

  function distributedFor(semNum) {
    const inGroup = (sections || []).filter(s => {
      const sec = s.semester ?? fallbackSem;
      return sec === semNum;
    });
    return {
      lec: inGroup.reduce((a, s) => a + (s.lecture_hours || 0), 0),
      lab: inGroup.reduce((a, s) => a + (s.lab_hours || 0), 0),
      pr:  inGroup.reduce((a, s) => a + (s.practice_hours || 0), 0),
      srs: inGroup.reduce((a, s) => a + (s.self_study_hours || 0), 0),
    };
  }

  const planAll = sumPlanOver(semesters);
  const distAll = sumDistOver(semesters.map(s => distributedFor(s.number)));

  const mergedControlBySem = new Map();
  for (const bd of bds) {
    const perBd = parseControlBySemester(bd?.control_form || "");
    for (const [sem, labels] of perBd) {
      if (!mergedControlBySem.has(sem)) mergedControlBySem.set(sem, new Set());
      for (const l of labels) mergedControlBySem.get(sem).add(l);
    }
  }
  const controlLines = [...mergedControlBySem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sem, labels]) => ({ sem, label: [...labels].join(", ") }));

  return <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    <div style={{ padding: "8px 12px", background: T.bg, borderBottom: "1px solid " + T.borderLight, display: "flex", flexDirection: "column", gap: 6 }}>
      {bds.map(bd => (
        <div key={bd.id_bup_discipline ?? bd.bup_name} style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>{bd.code || (bd.is_manual ? "Ручной ввод" : "—")}</span>
          <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{bd.bup_name || ""}</span>
        </div>
      ))}
      {controlLines.length > 0 && (
        <div style={{ marginTop: 2, fontSize: 11, color: T.textMuted, lineHeight: 1.65 }}>
          {controlLines.map(line => (
            <div key={line.sem}>Семестр {line.sem} — <b style={{ color: T.text }}>{line.label}</b></div>
          ))}
        </div>
      )}
      {conflicts.size > 0 && (
        <div style={{ fontSize: 11, color: T.orange, fontWeight: 600 }}>
          В привязанных БУПах разные плановые часы по семестрам {[...conflicts].sort((a, b) => a - b).join(", ")} — ниже показан план первой привязки.
        </div>
      )}
    </div>

    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <colgroup>
        <col style={{ width: "32%" }} />
        <col style={{ width: "12%" }} />
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
    </div>
  </div>;
}

function SemBlock({ sem, dist, showHeader }) {

  const planTotal = (z(sem.lec)) + (z(sem.lab)) + (z(sem.pr)) + (z(sem.srs));
  const distTotal = dist.lec + dist.lab + dist.pr + dist.srs;
  return <>
    {showHeader && <tr>
      <td colSpan={6} style={{ ...bCell, fontWeight: 700, background: T.bg, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", fontSize: 11 }}>
        {sem.number}-й семестр
      </td>
    </tr>}
    <tr>
      <td style={{ ...bCell, color: T.textMuted }}>Распределено / план</td>
      <td style={mismatch(distTotal, planTotal)}>{distTotal} / {planTotal}</td>
      <td style={mismatch(dist.lec, z(sem.lec))}>{dist.lec} / {z(sem.lec)}</td>
      <td style={mismatch(dist.lab, z(sem.lab))}>{dist.lab} / {z(sem.lab)}</td>
      <td style={mismatch(dist.pr,  z(sem.pr))}>{dist.pr} / {z(sem.pr)}</td>
      <td style={mismatch(dist.srs, z(sem.srs))}>{dist.srs} / {z(sem.srs)}</td>
    </tr>
  </>;
}

function TotalRow({ plan, dist }) {

  const planTotal = plan.lec + plan.lab + plan.pr + plan.srs;
  const distTotal = dist.lec + dist.lab + dist.pr + dist.srs;
  return <tr>
    <td style={{ ...bCell, fontWeight: 700, color: T.text, background: T.bg }}>Всего по дисциплине (распределено / план)</td>
    <td style={mismatchTotal(distTotal, planTotal)}>{distTotal} / {planTotal}</td>
    <td style={mismatchTotal(dist.lec, plan.lec)}>{dist.lec} / {plan.lec}</td>
    <td style={mismatchTotal(dist.lab, plan.lab)}>{dist.lab} / {plan.lab}</td>
    <td style={mismatchTotal(dist.pr,  plan.pr)}>{dist.pr} / {plan.pr}</td>
    <td style={mismatchTotal(dist.srs, plan.srs)}>{dist.srs} / {plan.srs}</td>
  </tr>;
}

function parseControlBySemester(raw) {
  const out = new Map();
  if (!raw) return out;
  const re = /([А-Яа-яёЁ.\s]+?)\s*\(\s*([\d,\s]+)\s*\)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const label = normalizeControlLabel(m[1].trim());
    const sems = m[2]
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(t => parseInt(t, 10))
      .filter(n => !isNaN(n));
    for (const n of sems) {
      if (!out.has(n)) out.set(n, new Set());
      out.get(n).add(label);
    }
  }
  return out;
}

function normalizeControlLabel(s) {
  const lower = s.toLowerCase().replace(/\s+/g, " ").trim();

  if (lower === "экзамен") return "Экзамен";
  if (lower === "зачёт" || lower === "зачет") return "Зачёт";
  if (lower === "диф. зачет" || lower === "диф.зачет"
      || lower === "дифференцированный зачёт" || lower === "дифференцированный зачет") return "Диф. зачет";
  if (lower === "курсовой проект") return "Курсовой проект";
  if (lower === "курсовая работа") return "Курсовая работа";

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function z(v) { return typeof v === "number" ? v : 0; }

function sumPlanOver(semesters) {
  return {
    lec: semesters.reduce((a, s) => a + z(s.lec), 0),
    lab: semesters.reduce((a, s) => a + z(s.lab), 0),
    pr:  semesters.reduce((a, s) => a + z(s.pr),  0),
    srs: semesters.reduce((a, s) => a + z(s.srs), 0),
  };
}

function sumDistOver(distArr) {
  return {
    lec: distArr.reduce((a, d) => a + d.lec, 0),
    lab: distArr.reduce((a, d) => a + d.lab, 0),
    pr:  distArr.reduce((a, d) => a + d.pr,  0),
    srs: distArr.reduce((a, d) => a + d.srs, 0),
  };
}

function mismatch(actual, planned) {
  return (actual || 0) === (planned || 0)
    ? numCell
    : { ...numCell, color: T.red, fontWeight: 700, background: "#fde6e3" };
}

function mismatchTotal(actual, planned) {
  return (actual || 0) === (planned || 0)
    ? { ...numCell, fontWeight: 700, background: T.bg }
    : { ...numCell, fontWeight: 700, color: T.red, background: "#fde6e3" };
}

const hCell = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".3px", textAlign: "left", background: T.bg };
const hCellC = { ...hCell, textAlign: "center" };
const bCell = { padding: "6px 10px", borderBottom: "1px solid " + T.borderLight, fontSize: 12, verticalAlign: "middle" };
const numCell = { ...bCell, textAlign: "center", fontVariantNumeric: "tabular-nums" };
