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
 * В АРМ РПД это две плоских таблицы тем без привязки к разделам дисциплины:
 * преподаватель просто перечисляет темы. Поэтому темы хранятся на уровне РПД
 * (`rpd.topics`, `topic_type: "lab" | "practice"`), без `id_section`.
 *
 * Если в содержании дисциплины суммарно 0 часов соответствующего вида
 * (например, ни в одном разделе нет практических занятий) — раздел вообще
 * не показывается: писать темы, для которых нет ни одного часа, бессмысленно.
 */
export function TopicsEditor({ kind }) {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const titleLabel = kind === "lab"
    ? "Наименование темы лабораторной работы"
    : "Наименование темы практического (семинарского) занятия";

  // Часов выбранного вида в содержании. Берём суммой по разделам.
  const sections = rpd.sections || [];
  const totalHoursForKind = sections.reduce((acc, s) => {
    const h = kind === "lab" ? (s.lab_hours || 0) : (s.practice_hours || 0);
    return acc + h;
  }, 0);

  if (totalHoursForKind <= 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      В содержании дисциплины нет часов {kind === "lab" ? "лабораторных работ" : "практических занятий"} — раздел не используется.
    </div>;
  }

  const topics = (rpd.topics || []).filter(t => t.topic_type === kind);

  return <TopicsTable
    topics={topics}
    kind={kind}
    rpdId={rpdId}
    titleLabel={titleLabel}
    editable={editable}
    reload={reload}
  />;
}


function TopicsTable({ topics, kind, rpdId, titleLabel, editable, reload }) {
  const tbodyRef = useRef(null);
  async function addTopic() {
    try {
      await api.addTopic(rpdId, { topic_type: kind, title: "" });
      await reload();
    } catch {}
  }
  async function delTopic(t) {
    if ((t.title || "").trim() && !confirm("Удалить тему?")) return;
    try { await api.deleteTopic(t.id_topic); await reload(); } catch {}
  }
  async function delById(id) {
    const t = topics.find(it => String(it.id_topic) === String(id));
    if (t) await delTopic(t);
  }
  // Один раз после маунта — если тем для этого вида ещё нет, добавляем пустую,
  // чтобы пользователь сразу видел готовую к вводу строку.
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

  return <div style={{ position: "relative" }}>
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
            index={i + 1}
            editable={editable}
            onSave={(title) => saveTitle(t, title)}
          />
        ))}
      </tbody>
    </table>
    </div>
    {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить тему" />}
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
