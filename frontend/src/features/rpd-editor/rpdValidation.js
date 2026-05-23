function f(v) { return !!(v && String(v).trim()); }

function _planSemesters(rpd) {
  const bds = rpd.bup_disciplines || [];
  if (bds.length === 0) return null;
  const bd = bds[0];
  if (bd.semesters_data && bd.semesters_data.length > 0) {
    return bd.semesters_data.map(s => ({
      number: s.number,
      lec: s.lecture || 0, lab: s.lab || 0, pr: s.practice || 0, srs: s.srs || 0,
    }));
  }
  return [{
    number: parseInt(String(bd.semester || "1").split(/[,\s\-]/)[0], 10) || 1,
    lec: bd.lecture_hours || 0, lab: bd.lab_hours || 0,
    pr: bd.practice_hours || 0, srs: bd.self_study_hours || 0,
  }];
}

function _sectionsHoursMatch(rpd) {
  const plan = _planSemesters(rpd);
  if (!plan) return false;
  const fallback = plan[0].number;
  for (const sem of plan) {
    const rows = (rpd.sections || []).filter(s => (s.semester ?? fallback) === sem.number);
    const sumOf = (k) => rows.reduce((a, s) => a + (s[k] || 0), 0);
    if (sumOf("lecture_hours") !== sem.lec) return false;
    if (sumOf("lab_hours") !== sem.lab) return false;
    if (sumOf("practice_hours") !== sem.pr) return false;
    if (sumOf("self_study_hours") !== sem.srs) return false;
  }
  return true;
}

function _isSectionRowEmpty(s) {
  return !f(s.title) && !f(s.brief_content)
    && !s.lecture_hours && !s.lab_hours && !s.practice_hours && !s.self_study_hours;
}
function _isSectionRowComplete(s) { return f(s.title) && f(s.brief_content); }

function _sectionRowsAllComplete(rpd) {
  const rows = rpd.sections || [];
  const nonEmpty = rows.filter(r => !_isSectionRowEmpty(r));
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(_isSectionRowComplete);
}

function sectionsState(rpd) {
  return _sectionRowsAllComplete(rpd) && _sectionsHoursMatch(rpd);
}

function topicsState(rpd, type) {
  const rows = (rpd.topics || []).filter(t => t.topic_type === type);
  const nonEmpty = rows.filter(t => f(t.title));
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(t => f(t.title));
}

function outcomesState(rpd) {
  const rows = rpd.learning_outcomes || [];
  if (rows.length === 0) return false;
  return rows.every(o => f(o.outcome_text) && f(o.assessment_tool));
}

function printedLitState(rpd) {
  const rows = (rpd.literature || []).filter(l => !f(l.url));
  const nonEmpty = rows.filter(l => f(l.title) || l.copies_count);
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(l => f(l.title));
}

function electronicLitState(rpd) {
  const rows = (rpd.literature || []).filter(l => f(l.url));
  const nonEmpty = rows.filter(l => f(l.title) || f(l.url));
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(l => f(l.title) && f(l.url));
}

function softwareState(rpd) {
  const rows = rpd.software || [];
  const nonEmpty = rows.filter(s => f(s.name) || f(s.license_type));
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(s => f(s.name) && f(s.license_type));
}

function databasesState(rpd) {
  const rows = rpd.databases || [];
  const nonEmpty = rows.filter(d => f(d.name) || f(d.url));
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(d => f(d.name) && f(d.url));
}

function mtechState(rpd) {
  const rows = rpd.material_tech || [];
  const nonEmpty = rows.filter(m => f(m.room_type) || f(m.equipment) || m.quantity);
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every(m => f(m.room_type) && f(m.equipment));
}

export function getValidationErrors(rpd, editTexts) {
  const e = [];
  const repBd = (rpd.bup_disciplines || [])[0] || null;
  if (!f(repBd?.form_of_study)) e.push({ secKey: "title", label: "Титульник: форма обучения" });
  if (!f(repBd?.degree_level)) e.push({ secKey: "title", label: "Титульник: уровень образования" });

  if (!f(editTexts.goals)) e.push({ secKey: "1.1", label: "1.1 Цели и задачи дисциплины" });
  if (!f(editTexts.objects)) e.push({ secKey: "1.2", label: "1.2 Изучаемые объекты" });
  if (!f(editTexts.requirements)) e.push({ secKey: "1.3", label: "1.3 Входные требования" });

  if (!outcomesState(rpd)) e.push({ secKey: "2", label: "2. Результаты обучения — для каждого индикатора заполните результат и средство оценки" });

  if (!_sectionRowsAllComplete(rpd)) {
    e.push({ secKey: "4", label: "4. Содержание — в каждой строке должны быть заполнены название и краткое содержание" });
  } else if (!_sectionsHoursMatch(rpd)) {
    e.push({ secKey: "4", label: "4. Содержание — часы в строках должны совпадать с планом БУПа по каждому виду работ и семестру" });
  }

  const _practiceH = (rpd.sections || []).reduce((a, s) => a + (s.practice_hours || 0), 0);
  const _labH = (rpd.sections || []).reduce((a, s) => a + (s.lab_hours || 0), 0);
  if (_practiceH > 0 && !topicsState(rpd, "practice")) e.push({ secKey: "4.1", label: "4.1 Тематика практических занятий — заполните название в каждой строке" });
  if (_labH > 0 && !topicsState(rpd, "lab")) e.push({ secKey: "4.2", label: "4.2 Тематика лабораторных работ — заполните название в каждой строке" });

  if (!f(editTexts.educational_tech)) e.push({ secKey: "5.1", label: "5.1 Образовательные технологии" });
  if (!f(editTexts.methodical_recommendations)) e.push({ secKey: "5.2", label: "5.2 Методические указания" });

  if (!printedLitState(rpd)) e.push({ secKey: "6.1", label: "6.1 Печатная литература — заполните название в каждой строке" });
  if (!electronicLitState(rpd)) e.push({ secKey: "6.2", label: "6.2 Электронная литература — заполните название и ссылку в каждой строке" });
  if (!softwareState(rpd)) e.push({ secKey: "6.3", label: "6.3 ПО — заполните вид и наименование в каждой строке" });
  if (!databasesState(rpd)) e.push({ secKey: "6.4", label: "6.4 БД и ИСС — заполните наименование и ссылку в каждой строке" });
  if (!mtechState(rpd)) e.push({ secKey: "7", label: "7. МТО — заполните тип помещения и оборудование в каждой строке" });

  if (!rpd.fos_main && !(rpd.fos_other || []).length) e.push({ secKey: "8", label: "8. Фонд оценочных средств (прикрепите файл)" });
  if (!(rpd.developers || []).length) e.push({ secKey: "developers", label: "Не добавлен ни один разработчик (откройте «Свойства РПД»)" });
  return e;
}

export function getRequiredCompletion(rpd, editTexts) {
  const practiceHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.practice_hours || 0), 0);
  const labHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.lab_hours || 0), 0);
  const checks = [
    ["1.1", f(editTexts.goals) || f(rpd.goals_text)],
    ["1.2", f(editTexts.objects) || f(rpd.objects_text)],
    ["1.3", f(editTexts.requirements) || f(rpd.requirements_text)],
    ["2", outcomesState(rpd)],
    ["4", sectionsState(rpd)],
    ["5.1", f(editTexts.educational_tech) || f(rpd.educational_tech)],
    ["5.2", f(editTexts.methodical_recommendations) || f(rpd.methodical_recommendations)],
    ["6.1", printedLitState(rpd)],
    ["6.2", electronicLitState(rpd)],
    ["6.3", softwareState(rpd)],
    ["6.4", databasesState(rpd)],
    ["7", mtechState(rpd)],
    ["8", !!rpd.fos_main || (rpd.fos_other || []).length > 0],
  ];
  if (practiceHoursTotal > 0) checks.push(["4.1", topicsState(rpd, "practice")]);
  if (labHoursTotal > 0) checks.push(["4.2", topicsState(rpd, "lab")]);
  const total = checks.length;
  const filled = checks.filter(([, v]) => v).length;
  const missing = checks.filter(([, v]) => !v).map(([k]) => k);
  return { total, filled, missing };
}
