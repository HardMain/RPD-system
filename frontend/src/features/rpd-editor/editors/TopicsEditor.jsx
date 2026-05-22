import { useEffect, useRef, useState, memo } from "react";
import * as api from "../../../api/client.js";
import { T, td, th, inlineTextarea } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { useRowEditor } from "../hooks/useRowEditor.jsx";

function TopicsEditorBase({ kind }) {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const titleLabel = kind === "lab"
    ? "Наименование темы лабораторной работы"
    : "Наименование темы практического (семинарского) занятия";

  const sections = rpd.sections || [];
  const totalHoursForKind = sections.reduce((acc, s) => {
    const h = kind === "lab" ? (s.lab_hours || 0) : (s.practice_hours || 0);
    return acc + h;
  }, 0);

  if (totalHoursForKind <= 0) {
    return <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
      Не используется
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
  const { addRow, saveRow, delById, confirmModal } = useRowEditor({
    items: topics, editable, reload, idKey: "id_topic",
    autoAddWhenEmpty: true,
    add: () => api.addTopic(rpdId, { topic_type: kind, title: "" }),
    update: (t, title) => api.updateTopic(t.id_topic, { title }),
    remove: (t) => api.deleteTopic(t.id_topic),
    isFilled: (t) => !!(t.title || "").trim(),
    confirmTitle: "Удалить тему?",
    confirmMessage: "У темы заполнено название. После удаления восстановить её будет нельзя.",
  });

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
        {topics.map((t, i) => (
          <TopicRow
            key={t.id_topic}
            topic={t}
            index={i + 1}
            editable={editable}
            deletable={topics.length > 1}
            onSave={(title) => saveRow(t, title)}
          />
        ))}
      </tbody>
    </table>
    </div>
    {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить тему" />}
    {editable && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={addRow}><PlusIcon /> Добавить тему</Btn>
      </div>
    )}
    {confirmModal}
  </div>;
}

function TopicRow({ topic, index, editable, deletable, onSave }) {
  const [local, setLocal] = useState(topic.title || "");
  const lastSyncedRef = useRef(topic.title || "");
  useEffect(() => {
    const next = topic.title || "";
    if (local === lastSyncedRef.current) setLocal(next);
    lastSyncedRef.current = next;
  }, [topic.title]);

  if (!editable) {
    return <tr>
      <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
      <td style={td}>{topic.title || ""}</td>
    </tr>;
  }

  const trashProps = deletable ? { "data-trash-row": "", "data-trash-id": topic.id_topic } : {};
  return <tr {...trashProps}>
    <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{index}</td>
    <td style={{ ...td, padding: 4 }}>
      <ExpandableTextarea
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const t = local.trim(); if (t !== local) setLocal(t); if (t !== (topic.title || "")) onSave(t); }}
        placeholder="Название темы"
        collapsedMaxHeight={64}
        style={inlineTextarea}
      />
    </td>
  </tr>;
}

export const TopicsEditor = memo(TopicsEditorBase);
