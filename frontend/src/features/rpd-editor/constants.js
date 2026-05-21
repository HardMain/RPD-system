export const SEC_KEYS = [
  "title",
  "1.1", "1.2", "1.3",
  "2",
  "3",
  "4", "4.1", "4.2",
  "5.1", "5.2",
  "6.1", "6.2", "6.3", "6.4",
  "7",
  "8",
];

export const SEC_LABELS = {
  title: "Титульник",
  "1.1": "1.1 Цели и задачи",
  "1.2": "1.2 Изучаемые объекты",
  "1.3": "1.3 Входные требования",
  "2":   "2. Результаты обучения",
  "3":   "3. Объём и виды работ",
  "4":   "4. Содержание",
  "4.1": "Тематика практ. занятий",
  "4.2": "Тематика лаб. работ",
  "5.1": "5.1 Обр. технологии",
  "5.2": "5.2 Методические указания",
  "6.1": "6.1 Печатная литература",
  "6.2": "6.2 Электронная литература",
  "6.3": "6.3 ПО",
  "6.4": "6.4 БД и ИСС",
  "7":   "7. МТО",
  "8":   "8. ФОС",
};

export const READ_ONLY_KEYS = new Set(["title", "3"]);

export const SUB_KEYS = new Set(["4.1", "4.2"]);

export const SIDEBAR_KEYS = [...SEC_KEYS];

export const NON_PDF_KEYS = new Set();

export const LITERATURE_PRINTED_KEYS = [
  "literature_printed_main",
  "literature_printed_additional",
  "literature_periodicals",
  "literature_normative",
  "literature_methodical_students",
  "literature_methodical_self_study",
];

export const GEN_SEC_KEY = {
  goals: "1.1",
  objects: "1.2",
  requirements: "1.3",
  learning_outcomes: "2",
  content: "4",
  topics_practice: "4.1",
  topics_lab: "4.2",
  educational_tech: "5.1",
  methodical_recommendations: "5.2",
  literature_printed_main: "6.1",
  literature_printed_additional: "6.1",
  literature_periodicals: "6.1",
  literature_normative: "6.1",
  literature_methodical_students: "6.1",
  literature_methodical_self_study: "6.1",
  literature_electronic: "6.2",
  software: "6.3",
  databases: "6.4",
  material_tech: "7",
};

export const PARENT_SECTION = {
  "1.1": "1", "1.2": "1", "1.3": "1",
  "2": "2",
  "3": "3",
  "4": "4", "4.1": "4", "4.2": "4",
  "5.1": "5", "5.2": "5",
  "6.1": "6", "6.2": "6", "6.3": "6", "6.4": "6",
  "7": "7",
  "8": "8",
};
