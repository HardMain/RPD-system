import { describe, it, expect } from "vitest";
import { parseIndicatorCode, parseCompetencyCode, buildIndicatorCode } from "./dictionaryHelpers.js";

describe("parseIndicatorCode", () => {
  it("разбирает корректный код индикатора", () => {
    expect(parseIndicatorCode("ИД-1ОК-1")).toEqual({ index: 1, competency: "ОК-1", prefix: "ОК" });
  });

  it("возвращает запасной результат для непарсящегося кода", () => {
    const r = parseIndicatorCode("мусор");
    expect(r.index).toBe(9999);
    expect(r.competency).toBe("мусор");
  });
});

describe("parseCompetencyCode", () => {
  it("извлекает буквенный префикс компетенции", () => {
    expect(parseCompetencyCode("ОПК-2").prefix).toBe("ОПК");
    expect(parseCompetencyCode("").prefix).toBe("");
  });
});

describe("buildIndicatorCode", () => {
  it("собирает код индикатора из компетенции и индекса", () => {
    expect(buildIndicatorCode("ОК-1", "1")).toBe("ИД-1ОК-1");
  });

  it("является обратным к parseIndicatorCode по компетенции и индексу", () => {
    const code = buildIndicatorCode("УК-3", 2);
    const parsed = parseIndicatorCode(code);
    expect(parsed.index).toBe(2);
    expect(parsed.competency).toBe("УК-3");
  });
});
