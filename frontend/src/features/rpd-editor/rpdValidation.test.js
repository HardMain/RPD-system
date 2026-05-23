import { describe, it, expect } from "vitest";
import { getValidationErrors, getRequiredCompletion } from "./rpdValidation.js";

const emptyRpd = {
  learning_outcomes: [],
  sections: [],
  topics: [],
  literature: [],
  software: [],
  databases: [],
  material_tech: [],
  fos_main: null,
  fos_other: [],
  developers: [],
};

const fullRpd = {
  bup_disciplines: [{
    id_bup_discipline: 1,
    form_of_study: "очная",
    degree_level: "бакалавриат",
    semester: "1",
    lecture_hours: 36, lab_hours: 0, practice_hours: 0, self_study_hours: 36,
    semesters_data: [{ number: 1, lecture: 36, lab: 0, practice: 0, srs: 36 }],
  }],
  learning_outcomes: [{ outcome_text: "Знает основы", assessment_tool: "Экзамен" }],
  sections: [{
    title: "Введение", brief_content: "Содержание раздела.",
    lecture_hours: 36, lab_hours: 0, practice_hours: 0, self_study_hours: 36, semester: 1,
  }],
  topics: [],
  literature: [
    { title: "Учебник", url: null },
    { title: "Электронный ресурс", url: "https://e.lanbook.com" },
  ],
  software: [{ name: "VS Code", license_type: "Среды разработки, тестирования и отладки" }],
  databases: [{ name: "Лань", url: "https://e.lanbook.com" }],
  material_tech: [{ room_type: "Лекционная аудитория", equipment: "Проектор" }],
  fos_main: { id_rpd_fos: 1 },
  fos_other: [],
  developers: [{ id_user: 1 }],
};

const fullTexts = {
  goals: "Цель",
  objects: "Объекты",
  requirements: "Требования",
  educational_tech: "Технологии",
  methodical_recommendations: "Указания",
};

describe("getValidationErrors", () => {
  it("возвращает ошибки по всем обязательным разделам для пустой РПД", () => {
    const errors = getValidationErrors(emptyRpd, {});
    const keys = errors.map(e => e.secKey);
    expect(keys).toEqual(expect.arrayContaining([
      "1.1", "1.2", "1.3", "2", "4", "5.1", "5.2",
      "6.1", "6.2", "6.3", "6.4", "7", "8", "developers",
    ]));
  });

  it("не возвращает ошибок для полностью заполненной РПД", () => {
    expect(getValidationErrors(fullRpd, fullTexts)).toEqual([]);
  });

  it("требует темы практик, только если есть часы практик", () => {
    const rpd = { ...fullRpd, sections: [{ title: "Раздел", practice_hours: 4, lab_hours: 0 }], topics: [] };
    const keys = getValidationErrors(rpd, fullTexts).map(e => e.secKey);
    expect(keys).toContain("4.1");
    expect(keys).not.toContain("4.2");
  });
});

describe("getRequiredCompletion", () => {
  it("для пустой РПД filled = 0", () => {
    const { total, filled, missing } = getRequiredCompletion(emptyRpd, {});
    expect(filled).toBe(0);
    expect(total).toBeGreaterThan(0);
    expect(missing.length).toBe(total);
  });

  it("для полной РПД filled = total и missing пуст", () => {
    const { total, filled, missing } = getRequiredCompletion(fullRpd, fullTexts);
    expect(filled).toBe(total);
    expect(missing).toEqual([]);
  });
});
