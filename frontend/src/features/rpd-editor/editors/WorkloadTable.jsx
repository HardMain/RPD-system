import { T, td, th } from "../../../styles/index.js";

export function WorkloadTable({ rpd }) {
  const bds = rpd?.bup_disciplines || [];

  const semesterMap = new Map();
  for (const bd of bds) {
    const sd = bd.semesters_data;
    if (sd && sd.length > 0) {
      for (const s of sd) {
        if (s.number == null) continue;
        if (!semesterMap.has(s.number)) {
          semesterMap.set(s.number, {
            lecture: s.lecture, lab: s.lab, practice: s.practice,
            ksr: s.ksr, srs: s.srs,
          });
        }
      }
    } else {
      const num = parseInt(String(bd.semester || "1").split(/[,\s\-]/)[0], 10) || 1;
      if (!semesterMap.has(num)) {
        semesterMap.set(num, {
          lecture: bd.lecture_hours, lab: bd.lab_hours, practice: bd.practice_hours,
          ksr: bd.ksr_hours, srs: bd.self_study_hours,
        });
      }
    }
  }
  if (semesterMap.size === 0) {
    semesterMap.set(parseInt(rpd.semester || "1", 10) || 1, {
      lecture: rpd.lecture_hours, lab: rpd.lab_hours, practice: rpd.practice_hours,
      ksr: 0, srs: rpd.self_study_hours,
    });
  }

  const semesters = [...semesterMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, v]) => ({ number: n, ...v }));

  const controlMap = parseControlForm(bds[0]?.control_form || rpd?.control_form || "");

  const examTotalHours = bds.reduce((acc, bd) => acc || bd.exam_hours || 0, 0);
  const examSemesterCount = countSemestersWith(controlMap, "экзамен");
  const examHoursPerSemester = examSemesterCount > 0
    ? Math.round(examTotalHours / examSemesterCount) || 36
    : 36;

  const SEM_GROUP_PCT = 42;
  const semColPct = (SEM_GROUP_PCT / semesters.length).toFixed(3) + "%";

  return <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col style={{ width: "49%" }} />
        <col style={{ width: "9%" }} />
        {semesters.map(s => <col key={s.number} style={{ width: semColPct }} />)}
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Вид учебной работы</th>
          <th rowSpan={2} style={{ ...th, textAlign: "center", verticalAlign: "middle" }}>Всего часов</th>
          <th colSpan={semesters.length} style={{ ...th, textAlign: "center" }}>
            Распределение по семестрам в часах
          </th>
        </tr>
        <tr>
          {semesters.map(s => (
            <th key={s.number} style={{ ...th, textAlign: "center", fontSize: 11 }}>
              <div style={{ color: T.textMuted, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".3px" }}>Семестр</div>
              <div>{s.number}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r, i) => {
          if (r.heading) {
            return <tr key={i}>
              <td colSpan={2 + semesters.length} style={{ ...td, fontWeight: 700, background: T.bg }}>
                {r.label}
              </td>
            </tr>;
          }

          const cellValues = semesters.map(s => r.value(s, controlMap, examHoursPerSemester));
          const total = cellValues.reduce((acc, v) => typeof v === "number" ? acc + v : acc, 0);
          const totalDisplay = cellValues.some(v => typeof v === "number") ? total : "";
          return <tr key={i}>
            <td style={{ ...td, paddingLeft: 12 + (r.indent || 0) * 16, fontWeight: r.total ? 700 : 400 }}>
              {r.label}
            </td>
            <td style={{ ...td, textAlign: "center", fontWeight: r.total ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
              {r.total ? (rpdTotalHours(rpd, bds) || totalDisplay || "") : (totalDisplay === "" ? "" : totalDisplay)}
            </td>
            {cellValues.map((v, j) => (
              <td key={semesters[j].number} style={{ ...td, textAlign: "center", fontWeight: r.total ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                {fmtCell(v)}
              </td>
            ))}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

function fmtCell(v) {

  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function sumNullable(...vals) {

  const nums = vals.filter(v => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function parseControlForm(raw) {

  const out = {};
  if (!raw) return out;
  const re = /([А-Яа-яёЁ.\s]+?)\s*\(\s*([\d,\s]+)\s*\)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const labelRaw = m[1].trim().toLowerCase();
    const label = NORMALIZE_CONTROL[labelRaw] || labelRaw;
    for (const tok of m[2].replace(",", " ").split(/\s+/)) {
      if (/^\d+$/.test(tok)) {
        const n = parseInt(tok, 10);
        if (!out[n]) out[n] = new Set();
        out[n].add(label);
      }
    }
  }
  return out;
}

const NORMALIZE_CONTROL = {
  "экзамен": "экзамен",
  "диф. зачет": "диф. зачет",
  "диф.зачет": "диф. зачет",
  "дифференцированный зачёт": "диф. зачет",
  "дифференцированный зачет": "диф. зачет",
  "зачёт": "зачёт",
  "зачет": "зачёт",
  "курсовой проект": "курсовой проект",
  "курсовая работа": "курсовая работа",
};

function hasControl(controlMap, semNum, label) {
  return controlMap[semNum]?.has(label);
}

function countSemestersWith(controlMap, label) {
  let n = 0;
  for (const semNum of Object.keys(controlMap)) {
    if (controlMap[semNum]?.has(label)) n += 1;
  }
  return n;
}

function rpdTotalHours(rpd, bds) {
  for (const bd of bds) if (bd.total_hours) return bd.total_hours;
  return rpd.total_hours || 0;
}

const ROWS = [
  { heading: true, label: "1. Проведение учебных занятий (включая текущий контроль успеваемости) в форме:" },

  { label: "1.1. Контактная аудиторная работа, из них:", indent: 0,
    value: (s) => sumNullable(s.lecture, s.lab, s.practice, s.ksr) },
  { label: "— лекции (Л)", indent: 1, value: (s) => s.lecture },
  { label: "— лабораторные работы (ЛР)", indent: 1, value: (s) => s.lab },
  { label: "— практические занятия, семинары и (или) другие виды занятий семинарского типа (ПЗ)", indent: 1, value: (s) => s.practice },
  { label: "— контроль самостоятельной работы (КСР)", indent: 1, value: (s) => s.ksr },
  { label: "— контрольная работа", indent: 1, value: () => null },
  { label: "1.2. Самостоятельная работа студентов (СРС)", indent: 0, value: (s) => s.srs },
  { heading: true, label: "2. Промежуточная аттестация" },

  { label: "Экзамен", indent: 0,
    value: (s, ctrl, examPerSem) => hasControl(ctrl, s.number, "экзамен") ? examPerSem : null },
  { label: "Дифференцированный зачёт", indent: 0,
    value: (s, ctrl) => hasControl(ctrl, s.number, "диф. зачет") ? "+" : null },
  { label: "Зачёт", indent: 0,
    value: (s, ctrl) => hasControl(ctrl, s.number, "зачёт") ? "+" : null },
  { label: "Курсовой проект (КП)", indent: 0,
    value: (s, ctrl) => hasControl(ctrl, s.number, "курсовой проект") ? "+" : null },
  { label: "Курсовая работа (КР)", indent: 0,
    value: (s, ctrl) => hasControl(ctrl, s.number, "курсовая работа") ? "+" : null },
  { label: "Общая трудоёмкость дисциплины", indent: 0, total: true,
    value: (s) => sumNullable(s.lecture, s.lab, s.practice, s.ksr, s.srs) },
];
