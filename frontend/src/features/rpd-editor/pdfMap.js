/* Грубая привязка разделов к страницам PDF — используется только как fallback,
   пока не завершено динамическое сканирование текста PDF.
   Значение: { page, y } — y в исходных PDF-единицах от верха страницы (0 = к началу страницы) */
export const PDF_PAGE_MAP_FALLBACK = {
  title: { page: 1, y: 0 },
  "1.1": { page: 2, y: 0 }, "1.2": { page: 2, y: 0 }, "1.3": { page: 2, y: 0 },
  "2":   { page: 3, y: 0 },
  "3":   { page: 4, y: 0 },
  "4":   { page: 4, y: 0 }, "4.1": { page: 6, y: 0 }, "4.2": { page: 6, y: 0 },
  "5.1": { page: 7, y: 0 }, "5.2": { page: 7, y: 0 },
  "6.1": { page: 8, y: 0 }, "6.2": { page: 8, y: 0 }, "6.3": { page: 9, y: 0 }, "6.4": { page: 9, y: 0 },
  "7":   { page: 9, y: 0 },
  "8":   { page: 10, y: 0 },
};

/* Регулярки для распознавания заголовков разделов в извлечённом тексте PDF.
   PDF.js конкатенирует строки с пробелами — допускаем различное кол-во пробелов и точек. */
export const PDF_SECTION_PATTERNS = [
  { key: "1.1", re: /1[.\s]+1[.\s]+Цели/i },
  { key: "1.2", re: /1[.\s]+2[.\s]+Изучаемые/i },
  { key: "1.3", re: /1[.\s]+3[.\s]+Входные/i },
  { key: "2",   re: /(?:^|[\s.])2[.\s]+Планируемые\s+результаты/i },
  { key: "3",   re: /(?:^|[\s.])3[.\s]+Объ[её]м\s+и\s+виды/i },
  { key: "4",   re: /(?:^|[\s.])4[.\s]+Содержание\s+дисциплины/i },
  // В шаблоне ПНИПУ заголовки идут без префикса "4.1/4.2" — просто
  // "Тематика примерных лабораторных работ" / "Тематика примерных практических занятий".
  { key: "4.1", re: /(?:4[.\s]+1[.\s]+(?:Тематика|Лабораторн|Перечень\s+(?:тем\s+)?лабораторн)|Тематика\s+(?:примерных\s+)?лабораторн|Перечень\s+(?:тем\s+)?лабораторн)/i },
  { key: "4.2", re: /(?:4[.\s]+2[.\s]+(?:Тематика|Практическ|Перечень\s+(?:тем\s+)?практическ)|Тематика\s+(?:примерных\s+)?практическ|Перечень\s+(?:тем\s+)?практическ)/i },
  { key: "5.1", re: /5[.\s]+1[.\s]+Образовательные/i },
  { key: "5.2", re: /5[.\s]+2[.\s]+Методические/i },
  { key: "6.1", re: /6[.\s]+1[.\s]+(?:Печатная|Основная|Учебно[-\s]*методическ|Учебная)/i },
  { key: "6.2", re: /6[.\s]+2[.\s]+(?:Электронная|Дополнительн)/i },
  { key: "6.3", re: /6[.\s]+3[.\s]+(?:Современные|Базы|Профессиональные|Перечень\s+(?:информац|профессион))/i },
  { key: "6.4", re: /6[.\s]+4[.\s]+(?:Лицензионное|Программное|Перечень\s+(?:лицензион|программн))/i },
  { key: "7",   re: /(?:^|[\s.])7[.\s]+Материально/i },
  { key: "8",   re: /(?:^|[\s.])8[.\s]+Фонд\s+оценочных/i },
];

export async function scanPdfForSections(pdfDoc) {
  const map = { title: { page: 1, y: 0 } };
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    // 1) Поэлементный поиск — даёт точную Y-координату заголовка
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      for (const { key, re } of PDF_SECTION_PATTERNS) {
        if (key in map) continue;
        if (re.test(item.str)) {
          const yFromTop = Math.max(0, viewport.height - (item.transform?.[5] ?? viewport.height));
          map[key] = { page: i, y: yFromTop };
        }
      }
    }
    // 2) Построчный поиск — на случай, когда заголовок разбит PDF.js на несколько items
    const lineMap = new Map(); // yKey -> { text, y }
    for (const item of tc.items) {
      if (!item.str) continue;
      const y = item.transform?.[5];
      if (typeof y !== "number") continue;
      const yKey = Math.round(y);
      const cur = lineMap.get(yKey);
      lineMap.set(yKey, { text: cur ? cur.text + " " + item.str : item.str, y });
    }
    for (const { text, y } of lineMap.values()) {
      for (const { key, re } of PDF_SECTION_PATTERNS) {
        if (key in map) continue;
        if (re.test(text)) {
          const yFromTop = Math.max(0, viewport.height - y);
          map[key] = { page: i, y: yFromTop };
        }
      }
    }
  }
  return map;
}
