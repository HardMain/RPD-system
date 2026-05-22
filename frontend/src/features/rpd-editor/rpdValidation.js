export function getValidationErrors(rpd, editTexts) {
  const e = [];
  if (!editTexts.goals?.trim()) e.push({ secKey: "1.1", label: "1.1 Цели и задачи дисциплины" });
  if (!editTexts.objects?.trim()) e.push({ secKey: "1.2", label: "1.2 Изучаемые объекты" });
  if (!editTexts.requirements?.trim()) e.push({ secKey: "1.3", label: "1.3 Входные требования" });
  if (!editTexts.educational_tech?.trim()) e.push({ secKey: "5.1", label: "5.1 Образовательные технологии" });
  if (!editTexts.methodical_recommendations?.trim()) e.push({ secKey: "5.2", label: "5.2 Методические указания" });

  if (!rpd.learning_outcomes?.some(o => (o.outcome_text || "").trim())) e.push({ secKey: "2", label: "2. Результаты обучения (заполните хотя бы один)" });
  if (!rpd.sections?.some(s => (s.title || "").trim())) e.push({ secKey: "4", label: "4. Содержание (нет ни одного заполненного раздела)" });
  const _practiceH = (rpd.sections || []).reduce((a, s) => a + (s.practice_hours || 0), 0);
  const _labH = (rpd.sections || []).reduce((a, s) => a + (s.lab_hours || 0), 0);
  if (_practiceH > 0 && !rpd.topics?.some(t => t.topic_type === "practice" && (t.title || "").trim())) e.push({ secKey: "4.1", label: "4.1 Тематика практических занятий (заполните темы)" });
  if (_labH > 0 && !rpd.topics?.some(t => t.topic_type === "lab" && (t.title || "").trim())) e.push({ secKey: "4.2", label: "4.2 Тематика лабораторных работ (заполните темы)" });
  if (!rpd.literature?.some(l => !l.url && (l.title || "").trim())) e.push({ secKey: "6.1", label: "6.1 Печатная литература (нет ни одного источника)" });
  if (!rpd.literature?.some(l => l.url && (l.title || "").trim())) e.push({ secKey: "6.2", label: "6.2 Электронная литература (нет ни одного источника)" });
  if (!rpd.software?.some(s => (s.name || "").trim())) e.push({ secKey: "6.3", label: "6.3 Программное обеспечение" });
  if (!rpd.databases?.some(d => (d.name || "").trim())) e.push({ secKey: "6.4", label: "6.4 БД и информационные справочные системы" });
  if (!rpd.material_tech?.some(m => (m.room_type || "").trim() || (m.equipment || "").trim())) e.push({ secKey: "7", label: "7. Материально-техническое обеспечение" });
  if (!rpd.fos_main && !(rpd.fos_other || []).length) e.push({ secKey: "8", label: "8. Фонд оценочных средств (прикрепите файл)" });
  if (!(rpd.developers || []).length) e.push({ secKey: "developers", label: "Не добавлен ни один разработчик (откройте «Свойства РПД»)" });
  return e;
}

export function getRequiredCompletion(rpd, editTexts) {
  const practiceHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.practice_hours || 0), 0);
  const labHoursTotal = (rpd.sections || []).reduce((a, s) => a + (s.lab_hours || 0), 0);
  const checks = [
    ["1.1", !!(editTexts.goals?.trim() || rpd.goals_text?.trim())],
    ["1.2", !!(editTexts.objects?.trim() || rpd.objects_text?.trim())],
    ["1.3", !!(editTexts.requirements?.trim() || rpd.requirements_text?.trim())],
    ["2", (rpd.learning_outcomes || []).some(o => (o.outcome_text || "").trim())],
    ["4", (rpd.sections || []).some(s => (s.title || "").trim())],
    ["5.1", !!(editTexts.educational_tech?.trim() || rpd.educational_tech?.trim())],
    ["5.2", !!(editTexts.methodical_recommendations?.trim() || rpd.methodical_recommendations?.trim())],
    ["6.1", (rpd.literature || []).some(l => !l.url && (l.title || "").trim())],
    ["6.2", (rpd.literature || []).some(l => l.url && (l.title || "").trim())],
    ["6.3", (rpd.software || []).some(s => (s.name || "").trim())],
    ["6.4", (rpd.databases || []).some(d => (d.name || "").trim())],
    ["7", (rpd.material_tech || []).some(m => (m.room_type || "").trim() || (m.equipment || "").trim())],
    ["8", !!rpd.fos_main || (rpd.fos_other || []).length > 0],
  ];
  if (practiceHoursTotal > 0) checks.push(["4.1", (rpd.topics || []).some(t => t.topic_type === "practice" && (t.title || "").trim())]);
  if (labHoursTotal > 0) checks.push(["4.2", (rpd.topics || []).some(t => t.topic_type === "lab" && (t.title || "").trim())]);
  const total = checks.length;
  const filled = checks.filter(([, v]) => v).length;
  const missing = checks.filter(([, v]) => !v).map(([k]) => k);
  return { total, filled, missing };
}
