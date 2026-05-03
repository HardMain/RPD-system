import { T, F } from "./theme.js";

/* PDF toolbar button */
export const pdfToolBtn = (disabled) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 24, padding: 0,
  border: "1px solid " + T.border, borderRadius: 4,
  background: disabled ? T.borderLight : T.surface,
  color: disabled ? T.textLight : T.text,
  cursor: disabled ? "default" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: F,
});

/* Table cell styles for inner editor tables.
 * `wordBreak: normal + overflowWrap: break-word` — стандартный wrap-режим:
 * обычные слова делятся по пробелам, и только когда слово целиком не влезает
 * в ячейку (длинный URL, идентификатор), оно ломается посимвольно. Без этого
 * длинные строки вылезают из ячейки и наезжают на соседнюю.
 *
 * Все таблицы редактора используют эти стили + обёртку `.table-scroll` →
 * сначала колонки сжимаются по содержимому, потом таблица расширяется
 * за пределы контейнера и появляется горизонтальный скролл. */
export const td = { padding: 8, border: "1px solid " + T.borderLight, fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };
export const th = { padding: 8, border: "1px solid " + T.border, background: T.bg, fontWeight: 700, textAlign: "left", fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" };

/* Table cell styles for top-level page tables */
export const hdr = { padding: "10px 12px", borderBottom: "2px solid " + T.border, textAlign: "left", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: .5 };
export const tcell = { padding: "10px 12px", borderBottom: "1px solid " + T.borderLight };

/* Класс-обёртка для таблиц редактора (определён в App.jsx <style>):
 * width:100% + overflow-x:auto + тонкий webkit-скроллбар. Используется через
 * className="table-scroll", сами таблицы внутри без min-width — пусть браузер
 * сжимает столбцы по содержимому до min-content (длиннейшего неразрывного
 * слова в ячейке) и только после этого включает горизонтальный скролл. */
