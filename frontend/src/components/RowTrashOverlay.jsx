import { useEffect, useRef, useState } from "react";
import { T } from "../theme.js";
import { TrashIcon } from "./icons.jsx";

/**
 * Overlay-кнопки «корзина» для строк таблицы. Кнопки живут ВНЕ обёртки
 * `.table-scroll` и потому не учитываются в её horizontal overflow — ложного
 * горизонтального скролла не возникает, а сама таблица может занимать всю
 * ширину контейнера.
 *
 * Использование:
 *   const tbodyRef = useRef(null);
 *   <div style={{ position: "relative" }}>
 *     <div className="table-scroll">
 *       <table>
 *         <tbody ref={tbodyRef}>
 *           {items.map(it => (
 *             <tr key={it.id} data-trash-row data-trash-id={it.id}>...</tr>
 *           ))}
 *         </tbody>
 *       </table>
 *     </div>
 *     <RowTrashOverlay tbodyRef={tbodyRef} onDelete={(id) => del(byId(id))} />
 *   </div>
 *
 * Кнопки выровнены по вертикальному центру помеченного `<tr data-trash-row>`.
 * Атрибут — чтобы исключить служебные строки (заголовки семестров, итоги,
 * кнопки добавления). `top` каждой кнопки пересчитывается ResizeObserver'ом,
 * чтобы при правке высоты строки (textarea растёт) корзины ехали вместе с ней.
 *
 * Кнопка позиционирована `right: -32` относительно внешнего relative-блока —
 * она торчит за правый край этого блока (≈ за правый край таблицы). Это
 * место принадлежит padding-right'у внешнего контейнера-«карточки» РПД,
 * поэтому ничего не обрезается и не наезжает на соседние блоки.
 */
// right: -30 — середина 40-px padding'а карточки РПД: правый край кнопки
// at outer.right + 30, центр at outer.right + 30 - 11 ≈ outer.right + 19,
// что близко к середине между правым краем таблицы и правым краем карточки.
export function RowTrashOverlay({ tbodyRef, onDelete, title = "Удалить", right = -30 }) {
  const [rows, setRows] = useState([]); // [{ id, top }]
  const overlayRef = useRef(null);

  useEffect(() => {
    const tbody = tbodyRef.current;
    const overlay = overlayRef.current;
    if (!tbody || !overlay) return;

    const recompute = () => {
      const trs = Array.from(tbody.querySelectorAll(":scope > tr[data-trash-row]"));
      const overlayTop = overlay.getBoundingClientRect().top;
      const next = trs.map(tr => {
        const r = tr.getBoundingClientRect();
        return {
          id: tr.getAttribute("data-trash-id") || "",
          top: r.top - overlayTop + r.height / 2,
        };
      });
      setRows(next);
    };

    recompute();

    // tbody-observer ловит добавление/удаление строк (height tbody меняется);
    // tr-observer'ы — изменение высоты конкретной строки (раскрытие textarea).
    // На каждый recompute подключаем observer'ы заново — иначе свежедобавленные
    // <tr> не наблюдались бы.
    const ro = new ResizeObserver(recompute);
    ro.observe(tbody);
    const trs = Array.from(tbody.querySelectorAll(":scope > tr[data-trash-row]"));
    for (const tr of trs) ro.observe(tr);

    // MutationObserver — на случай если строки добавляются/удаляются между
    // ResizeObserver-фреймами (количество tr меняется, height tbody мог не
    // успеть обновиться). После любой DOM-перестройки tbody — пересчитываем.
    const mo = new MutationObserver(recompute);
    mo.observe(tbody, { childList: true, subtree: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });

  return <div ref={overlayRef} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 0, pointerEvents: "none" }}>
    {rows.map(row => (
      <button
        key={row.id}
        type="button"
        onClick={() => onDelete(row.id)}
        title={title}
        style={{
          position: "absolute",
          right,
          top: row.top,
          transform: "translateY(-50%)",
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: 4,
          color: T.textMuted,
          display: "inline-flex",
          pointerEvents: "auto",
        }}
      ><TrashIcon /></button>
    ))}
  </div>;
}
