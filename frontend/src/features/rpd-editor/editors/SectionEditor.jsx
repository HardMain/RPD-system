import { useEffect, useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, F, td, th, inlineNumber } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import { ExpandableTextarea } from "../../../components/ExpandableTextarea.jsx";
import { RowTrashOverlay } from "../../../components/RowTrashOverlay.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { PlanSummary } from "./PlanSummary.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";

export function SectionEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const editable = isEdit && canEdit;
  const [pendingDelete, setPendingDelete] = useState(null);

  const planSemesters = computePlanSemesters(rpd);
  const isMultiSemester = planSemesters.length > 1;
  const fallbackSem = planSemesters[0] || 1;

  async function addEmpty(targetSem = null) {
    const next = (rpd.sections?.length || 0) + 1;
    try {
      await api.addSection(rpdId, {
        section_number: next,
        title: "",
        brief_content: "",
        lecture_hours: 0,
        practice_hours: 0,
        lab_hours: 0,
        self_study_hours: 0,
        semester: targetSem ?? (isMultiSemester ? fallbackSem : null),
      });
      await reload();
    } catch {}
  }

  const autoAddedRef = useRef(new Set());
  useEffect(() => {
    if (!editable) return;
    const targetSems = isMultiSemester ? planSemesters : [null];
    for (const sem of targetSems) {
      if (autoAddedRef.current.has(sem)) continue;
      autoAddedRef.current.add(sem);
      const has = (rpd.sections || []).some(s =>
        sem === null ? true : (s.semester === sem)
      );

      const needsEmpty = sem === null
        ? (rpd.sections || []).length === 0
        : !has;
      if (needsEmpty) addEmpty(sem);
    }

  }, [editable, isMultiSemester]);

  function isSectionEmpty(s) {
    return !(s.title || "").trim()
      && !(s.brief_content || "").trim()
      && !s.lecture_hours && !s.practice_hours
      && !s.lab_hours && !s.self_study_hours;
  }

  async function performDelete(s) {
    if (!s) return;
    try { await api.deleteSection(s.id_section); await reload(); } catch {}
  }
  function delSec(s) {
    if (!isSectionEmpty(s)) { setPendingDelete(s); return; }
    performDelete(s);
  }
  function delById(id) {
    const s = (rpd.sections || []).find(it => String(it.id_section) === String(id));
    if (s) delSec(s);
  }
  const tbodyRef = useRef(null);

  async function saveSec(section, patch) {
    try {
      await api.updateSection(section.id_section, {
        section_number: section.section_number,
        title: patch.title ?? section.title ?? "",
        brief_content: patch.brief_content ?? section.brief_content ?? "",
        lecture_hours: patch.lecture_hours ?? section.lecture_hours ?? 0,
        practice_hours: patch.practice_hours ?? section.practice_hours ?? 0,
        lab_hours: patch.lab_hours ?? section.lab_hours ?? 0,
        self_study_hours: patch.self_study_hours ?? section.self_study_hours ?? 0,
        semester: patch.semester !== undefined ? patch.semester
          : (section.semester ?? (isMultiSemester ? fallbackSem : null)),
      });
      await reload();
    } catch {}
  }

  const sectionsBySem = new Map();
  if (isMultiSemester) {
    for (const n of planSemesters) sectionsBySem.set(n, []);
  } else {
    sectionsBySem.set(fallbackSem, []);
  }
  for (const s of (rpd.sections || [])) {
    const n = (isMultiSemester && sectionsBySem.has(s.semester)) ? s.semester : fallbackSem;
    if (!sectionsBySem.has(n)) sectionsBySem.set(n, []);
    sectionsBySem.get(n).push(s);
  }

  let globalIdx = 0;
  const groups = [...sectionsBySem.entries()].sort((a, b) => a[0] - b[0]);

  return <div>
    <PlanSummary bupDisciplines={rpd.bup_disciplines} sections={rpd.sections} />

    <div style={{ position: "relative" }}>
    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col />
        <col style={{ width: 50 }} />
        <col style={{ width: 50 }} />
        <col style={{ width: 50 }} />
        <col style={{ width: 60 }} />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2} style={{ ...th, verticalAlign: "middle" }}>Наименование разделов дисциплины с кратким содержанием</th>
          <th colSpan={3} style={{ ...th, textAlign: "center" }}>Объём аудиторных занятий по видам в часах</th>
          <th style={{ ...th, textAlign: "center" }}>Объём внеаудиторных занятий по видам в часах</th>
        </tr>
        <tr>
          <th style={{ ...th, textAlign: "center" }}>Л</th>
          <th style={{ ...th, textAlign: "center" }}>ЛР</th>
          <th style={{ ...th, textAlign: "center" }}>ПЗ</th>
          <th style={{ ...th, textAlign: "center" }}>СРС</th>
        </tr>
      </thead>
      <tbody ref={tbodyRef}>
        {groups.map(([semNum, list]) => {
          const groupRows = [];
          if (isMultiSemester) {
            groupRows.push(
              <tr key={`sem-${semNum}`}>
                <td colSpan={5} style={{ ...td, fontWeight: 700, background: T.bg, paddingLeft: 12 }}>
                  {semNum}-й семестр
                </td>
              </tr>
            );
          }
          for (const s of list) {
            globalIdx += 1;
            groupRows.push(
              <SectionRow
                key={s.id_section}
                section={s}
                number={globalIdx}
                editable={editable}
                deletable={list.length > 1}
                onSave={(patch) => saveSec(s, patch)}
              />
            );
          }

          if (isMultiSemester && editable) {
            groupRows.push(
              <tr key={`sem-${semNum}-add`}>
                <td colSpan={5} style={{ ...td, padding: 4, background: T.surface }}>
                  <Btn small onClick={() => addEmpty(semNum)}>
                    <PlusIcon /> Добавить раздел в {semNum}-й семестр
                  </Btn>
                </td>
              </tr>
            );
          }

          if (isMultiSemester) {
            const tLec = list.reduce((a, s) => a + (s.lecture_hours || 0), 0);
            const tLab = list.reduce((a, s) => a + (s.lab_hours || 0), 0);
            const tPr = list.reduce((a, s) => a + (s.practice_hours || 0), 0);
            const tSrs = list.reduce((a, s) => a + (s.self_study_hours || 0), 0);
            groupRows.push(
              <tr key={`sem-${semNum}-total`}>
                <td style={{ ...td, fontWeight: 700, textAlign: "right", background: T.bg }}>Итого за {semNum}-й семестр</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.bg, fontVariantNumeric: "tabular-nums" }}>{tLec}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.bg, fontVariantNumeric: "tabular-nums" }}>{tLab}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.bg, fontVariantNumeric: "tabular-nums" }}>{tPr}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.bg, fontVariantNumeric: "tabular-nums" }}>{tSrs}</td>
              </tr>
            );
          }
          return groupRows;
        })}

        {isMultiSemester && (() => {
          const all = rpd.sections || [];
          const tLec = all.reduce((a, s) => a + (s.lecture_hours || 0), 0);
          const tLab = all.reduce((a, s) => a + (s.lab_hours || 0), 0);
          const tPr = all.reduce((a, s) => a + (s.practice_hours || 0), 0);
          const tSrs = all.reduce((a, s) => a + (s.self_study_hours || 0), 0);
          return <tr key="grand-total">
            <td style={{ ...td, fontWeight: 700, textAlign: "right", background: T.accentLight }}>Всего по дисциплине</td>
            <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.accentLight, fontVariantNumeric: "tabular-nums" }}>{tLec}</td>
            <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.accentLight, fontVariantNumeric: "tabular-nums" }}>{tLab}</td>
            <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.accentLight, fontVariantNumeric: "tabular-nums" }}>{tPr}</td>
            <td style={{ ...td, textAlign: "center", fontWeight: 700, background: T.accentLight, fontVariantNumeric: "tabular-nums" }}>{tSrs}</td>
          </tr>;
        })()}
      </tbody>
    </table>
    </div>
    {editable && <RowTrashOverlay tbodyRef={tbodyRef} onDelete={delById} title="Удалить раздел" />}
    </div>
    {editable && !isMultiSemester && (
      <div style={{ marginTop: 8 }}>
        <Btn small onClick={() => addEmpty(null)}><PlusIcon /> Добавить раздел</Btn>
      </div>
    )}
    {pendingDelete && <ConfirmDeleteModal
      title="Удалить раздел?"
      message="В разделе заполнены название, содержание или часы. После удаления восстановить его будет нельзя."
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const s = pendingDelete; setPendingDelete(null); await performDelete(s); }}
    />}
  </div>;
}

export function computePlanSemesters(rpd) {
  const set = new Set();
  for (const bd of (rpd?.bup_disciplines || [])) {
    if (bd.semesters_data && bd.semesters_data.length > 0) {
      for (const s of bd.semesters_data) {
        if (s.number != null) set.add(s.number);
      }
    } else if (bd.semester) {
      const m = String(bd.semester).match(/\d+/);
      if (m) set.add(parseInt(m[0], 10));
    }
  }
  if (set.size === 0 && rpd?.semester) {
    const m = String(rpd.semester).match(/\d+/);
    if (m) set.add(parseInt(m[0], 10));
  }
  if (set.size === 0) set.add(1);
  return [...set].sort((a, b) => a - b);
}

function SectionRow({ section, number, editable, deletable, onSave }) {
  const [local, setLocal] = useState(section);

  const lastSyncedRef = useRef(section);
  useEffect(() => {
    const prev = lastSyncedRef.current;
    const dirty = ["title","brief_content","lecture_hours","lab_hours","practice_hours","self_study_hours"]
      .some(k => (local[k] ?? "") !== (prev[k] ?? ""));
    if (!dirty) setLocal(section);
    lastSyncedRef.current = section;
  }, [section]);

  function patch(k, v) { setLocal(p => ({ ...p, [k]: v })); }
  function commitField(k) {
    const cur = (local[k] ?? "").trim();
    if (cur !== (local[k] ?? "")) patch(k, cur);
    const orig = section[k] ?? "";
    if (cur === orig) return;
    onSave({ [k]: cur });
  }
  function commitNum(k) {
    const cur = +local[k] || 0;
    const orig = +section[k] || 0;
    if (cur === orig) return;
    onSave({ [k]: cur });
  }

  if (!editable) {
    return <tr>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{number}. {section.title || ""}</div>
        {section.brief_content && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{section.brief_content}</div>
        )}
      </td>
      <td style={cellNum}>{section.lecture_hours}</td>
      <td style={cellNum}>{section.lab_hours}</td>
      <td style={cellNum}>{section.practice_hours}</td>
      <td style={cellNum}>{section.self_study_hours}</td>
    </tr>;
  }

  const trashProps = deletable ? { "data-trash-row": "", "data-trash-id": section.id_section } : {};
  return <tr {...trashProps}>
    <td style={{ ...td, padding: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontWeight: 700, color: T.textMuted, flexShrink: 0, minWidth: 18 }}>{number}.</span>
        <input
          value={local.title || ""}
          onChange={e => patch("title", e.target.value)}
          onBlur={() => commitField("title")}
          placeholder="Название раздела"
          style={inlineInput}
        />
      </div>
      <ExpandableTextarea
        value={local.brief_content || ""}
        onChange={e => patch("brief_content", e.target.value)}
        onBlur={() => commitField("brief_content")}
        placeholder="Краткое содержание (необязательно)"
        collapsedMaxHeight={64}
        wrapperStyle={{ marginTop: 4 }}
        style={inlineTextarea}
      />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.lecture_hours} onChange={v => patch("lecture_hours", v)} onBlur={() => commitNum("lecture_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.lab_hours} onChange={v => patch("lab_hours", v)} onBlur={() => commitNum("lab_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.practice_hours} onChange={v => patch("practice_hours", v)} onBlur={() => commitNum("practice_hours")} />
    </td>
    <td style={{ ...td, padding: 4, textAlign: "center" }}>
      <HourInput value={local.self_study_hours} onChange={v => patch("self_study_hours", v)} onBlur={() => commitNum("self_study_hours")} />
    </td>
  </tr>;
}

function HourInput({ value, onChange, onBlur }) {
  return <input
    type="number"
    min="0"
    value={value ?? 0}
    onChange={e => onChange(e.target.value === "" ? 0 : +e.target.value)}
    onBlur={onBlur}
    style={inlineNumber}
  />;
}

const cellNum = { ...td, textAlign: "center", fontVariantNumeric: "tabular-nums" };

const inlineInput = {
  flex: 1, minWidth: 0,
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 13, fontWeight: 600, fontFamily: F,
  background: T.surface,
  outline: "none",
};

const inlineTextarea = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid " + T.borderLight,
  borderRadius: 4,
  fontSize: 11, fontFamily: F, lineHeight: 1.45,
  color: T.textMuted,
  background: T.surface,
  minHeight: 28,
  boxSizing: "border-box",
  outline: "none",
};


