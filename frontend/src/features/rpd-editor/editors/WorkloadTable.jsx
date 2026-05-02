import { T } from "../../../theme.js";
import { td, th } from "../../../styles.js";

/**
 * Раздел 3 «Объём и виды учебной работы» — read-only визуализация,
 * 1:1 со структурой rpd_template.docx (TABLE 5).
 *
 * 3 колонки верхнего уровня: Вид учебной работы | Всего часов | Распределение
 * по семестрам в часах. Третья дробится на N подколонок — по одной на каждую
 * привязанную БУП-дисциплину (как в шаблоне через {%tc for s in workload.semesters %}).
 *
 * Считаем те же значения, что rpd_template_context.build_context — чтобы цифры
 * в редакторе и в скачанном PDF не расходились.
 */
export function WorkloadTable({ rpd }) {
  const bds = rpd?.bup_disciplines || [];
  // Если нет ни одной БУП-привязки — fallback на агрегатные поля самой РПД
  // (legacy-сценарий). В этом случае одна семестровая колонка.
  const cols = bds.length > 0
    ? bds.map(bd => ({
        key: bd.id_bup_discipline ?? bd.bup_name,
        title: bd.semester || "—",
        bd,
      }))
    : [{ key: "rpd", title: rpd.semester || "—", bd: rpdAsBd(rpd) }];

  const rows = ROWS;

  return <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col />
        <col style={{ width: 90 }} />
        {cols.map(c => <col key={c.key} style={{ width: 80 }} />)}
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Вид учебной работы</th>
          <th rowSpan={2} style={{ ...th, textAlign: "center", verticalAlign: "middle" }}>Всего часов</th>
          <th colSpan={cols.length} style={{ ...th, textAlign: "center" }}>
            Распределение по семестрам в часах
          </th>
        </tr>
        <tr>
          {cols.map(c => (
            <th key={c.key} style={{ ...th, textAlign: "center", fontSize: 11 }}>
              <div style={{ color: T.textMuted, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".3px" }}>Семестр</div>
              <div>{c.title}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          if (r.heading) {
            return <tr key={i}>
              <td colSpan={2 + cols.length} style={{ ...td, fontWeight: 700, background: T.bg }}>
                {r.label}
              </td>
            </tr>;
          }
          const totalVal = cols.reduce((s, c) => s + numOr0(r.get(c.bd)), 0);
          return <tr key={i}>
            <td style={{ ...td, paddingLeft: 12 + (r.indent || 0) * 16, fontWeight: r.total ? 700 : 400 }}>
              {r.label}
            </td>
            <td style={{ ...td, textAlign: "center", fontWeight: r.total ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
              {fmt(totalVal)}
            </td>
            {cols.map(c => (
              <td key={c.key} style={{ ...td, textAlign: "center", fontWeight: r.total ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.get(c.bd))}
              </td>
            ))}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}


// ─── helpers ────────────────────────────────────────────────────────────────

function numOr0(v) { return typeof v === "number" ? v : 0; }
function fmt(v) {
  if (v == null) return "—";
  if (typeof v === "number") return v === 0 ? "0" : String(v);
  return v;
}

// Логика exam/credit повторяет rpd_template_context.build_context — единственное
// поле часов, реально зависящее от формы контроля, это exam (9 ч). Зачёт/диф.зачёт
// в шаблоне всегда 0 (это просто отметка в столбце); тут так же.
function examHours(bd) {
  const c = (bd?.control_form || "").toLowerCase();
  return c.includes("экз") ? 9 : 0;
}
function contactHours(bd) {
  return numOr0(bd?.lecture_hours) + numOr0(bd?.lab_hours)
       + numOr0(bd?.practice_hours) + numOr0(bd?.ksr_hours);
}

// Если у РПД нет ни одной БУП-привязки — собираем «псевдо-bd» из агрегатных полей
// самой РПД. Контрольная форма в этом случае одна на всю РПД.
function rpdAsBd(rpd) {
  return {
    lecture_hours: rpd.lecture_hours || 0,
    lab_hours: rpd.lab_hours || 0,
    practice_hours: rpd.practice_hours || 0,
    ksr_hours: 0,
    self_study_hours: rpd.self_study_hours || 0,
    total_hours: rpd.total_hours || 0,
    control_form: rpd.control_form || "",
  };
}


const ROWS = [
  { heading: true, label: "1. Проведение учебных занятий (включая текущий контроль успеваемости) в форме:" },
  { label: "1.1. Контактная аудиторная работа, из них:", indent: 0, get: contactHours },
  { label: "— лекции (Л)", indent: 1, get: bd => bd.lecture_hours },
  { label: "— лабораторные работы (ЛР)", indent: 1, get: bd => bd.lab_hours },
  { label: "— практические занятия, семинары и (или) другие виды занятий семинарского типа (ПЗ)", indent: 1, get: bd => bd.practice_hours },
  { label: "— контроль самостоятельной работы (КСР)", indent: 1, get: bd => bd.ksr_hours },
  { label: "— контрольная работа", indent: 1, get: () => 0 },
  { label: "1.2. Самостоятельная работа студентов (СРС)", indent: 0, get: bd => bd.self_study_hours },
  { heading: true, label: "2. Промежуточная аттестация" },
  { label: "Экзамен", indent: 0, get: examHours },
  { label: "Дифференцированный зачёт", indent: 0, get: () => 0 },
  { label: "Зачёт", indent: 0, get: () => 0 },
  { label: "Курсовой проект (КП)", indent: 0, get: () => 0 },
  { label: "Курсовая работа (КР)", indent: 0, get: () => 0 },
  { label: "Общая трудоёмкость дисциплины", indent: 0, get: bd => bd.total_hours, total: true },
];
