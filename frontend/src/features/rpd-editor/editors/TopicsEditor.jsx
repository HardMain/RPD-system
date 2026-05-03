import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

/**
 * Разделы 4.1 / 4.2 — тематика лабораторных работ или практических занятий.
 * Шаблон rpd_template.docx (TABLE 7/8) — это плоская 2-колоночная таблица
 * «№ п.п. | Наименование темы …», нумерация сквозная по всем разделам.
 *
 * В редакторе оставляем группировку по разделам дисциплины — добавлять тему
 * нужно к конкретному разделу, иначе непонятно куда. Внутри каждого раздела —
 * мини-таблица в стиле шаблона. Сквозная нумерация считается по всем разделам.
 *
 * Разделы без названия не показываем (они ещё «не готовы»), это же правило
 * применяется в backend/services/rpd_template_context.py.
 */
export function TopicsEditor({ kind }) {
  const { rpd, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const titleLabel = kind === "lab" ? "Наименование темы лабораторной работы" : "Наименование темы практического (семинарского) занятия";

  const sections = (rpd.sections || []).filter(s => (s.title || "").trim());

  if (!sections.length) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      Сначала добавьте разделы дисциплины (раздел 4) и заполните их названия
    </div>;
  }

  // Сквозная нумерация по всем разделам (как в шаблоне). Накопительная сумма
  // длин предыдущих разделов даёт стартовый индекс текущего.
  let running = 0;
  const blocks = sections.map(s => {
    const topics = (s.topics || []).filter(t => t.topic_type === kind);
    const startIndex = running + 1;
    running += topics.length;
    return { section: s, topics, startIndex };
  });

  return <div>
    {blocks.map(({ section, topics, startIndex }) => (
      <SectionBlock
        key={section.id_section}
        section={section}
        topics={topics}
        kind={kind}
        titleLabel={titleLabel}
        editable={editable}
        startIndex={startIndex}
        reload={reload}
      />
    ))}
  </div>;
}


function SectionBlock({ section, topics, kind, titleLabel, editable, startIndex, reload }) {
  const tbodyRef = useRef(null);
  async function addTopic() {
    try {
      await api.addTopic(section.id_section, { topic_type: kind, title: "" });
      await reload();
    } catch {}
  }
  async function delTopic(t) {
    // Пустую тему удаляем без подтверждения — пользователь её только что
    // увидел из автодобавления или передумал. Терять там нечего.
    if ((t.title || "").trim() && !confirm("Удалить тему?")) return;
    try { await api.deleteTopic(t.id_topic); await reload(); } catch {}
  }
  async function delById(id) {
    const t = topics.find(it => String(it.id_topic) === String(id));
    if (t) await delTopic(t);
  }
  // Один раз на маунт блока — если у раздела для текущего kind ещё нет ни
  // одной темы, добавляем пустую. Так пользователь сразу видит готовую к
  // вводу строку. Пустые темы фильтруются в печатной форме.
  const autoAddedRef = useRef(false);
  useEffect(() => {
    if (!editable || autoAddedRef.current) return;
    autoAddedRef.current = true;
    if (topics.length === 0) addTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);
  async function saveTitle(topic, title) {
    if ((topic.title || "") === title) return;
    try {
      await api.updateTopic(topic.id_topic, { title });
      await reload();
    } catch {}
  }

  return <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
      Раздел {section.section_number}. {section.title}
    </div>
    {/* Шапка и колонки 1:1 с шаблоном (TABLE 7/8): «№ п.п. | Наименование темы …». */}
    <div style={{ position: "relative" }}>
    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col style={{ width: 60 }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: "center" }}>№ п.п.</th>
          <th style={th}>{titleLabel}</th>
        </tr>
      </thead>
      <tbody ref={tbodyRef}>
        {topics.length === 0 && (
          <tr>
            <td colSpan={2} style={{ ...td, textAlign: "center", color: T.textMuted, fontStyle: "italic" }}>
              Не используется
            </td>
          </tr>
        )}
        {topics.map((t, i) => (
          <TopicRow
            key={t.id_topic}
            topic={t}
            index={startIndex + i}
            editable={editable}
            onSave={(title) => saveTitle(t, title)}
          />
        ))}
      </tbody>
    </table>
    </div>
    {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить тему" />}
    </div>
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={addTopic}><PlusIcon /> Добавить тему</Btn>
      </div>
    )}
  </div>;
}


function TopicRow({ topic, index, editable, onSave }) {
  const [local, setLocal] = useState(topic.title || "");
  useEffect(() => { setLocal(topic.title || ""); }, [topic.title]);

  if (!editable) {
    return <tr>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
      <td style={td}>{topic.title || ""}</td>
    </tr>;
  }

  return <tr data-trash-row data-trash-id={topic.id_topic}>
    <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
    <td style={{ ...td, padding: 4 }}>
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => onSave(local)}
        placeholder="Название темы"
        style={inlineInput}
      />
    </td>
  </tr>;
}


// ─── Styles ─────────────────────────────────────────────────────────────────

const inlineInput = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  background: T.surface,
  outline: "none",
  boxSizing: "border-box",
};
