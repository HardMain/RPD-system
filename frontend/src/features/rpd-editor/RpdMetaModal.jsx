import { useEffect, useRef, useState } from "react";
import * as api from "../../api/client.js";
import { T, F, sectionLabel } from "../../styles/index.js";
import { Btn } from "../../components/Btn.jsx";
import { Modal } from "../../components/Modal.jsx";
import { BupDisciplinesTable, ManualDisciplineTable } from "./meta/DisciplineTables.jsx";
import { ApprovalRouteEditor } from "./meta/ApprovalRouteEditor.jsx";
import { DeveloperEditor } from "./meta/DeveloperEditor.jsx";

export function RpdMetaModal({ rpd, rpdId, canEdit, user, reload, onClose }) {
  const totalZet = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.zet || 0), 0);
  const totalHours = (rpd.bup_disciplines || []).reduce((s, b) => s + (b.total_hours || 0), 0);
  const rpdName = `${rpd.academic_year} ${rpd.discipline_name}` + (totalHours ? ` (${totalHours} ч)` : "");

  const [comment, setComment] = useState(rpd.comment || "");
  const initialCommentRef = useRef(rpd.comment || "");
  const debounceRef = useRef(null);
  const lastSavedRef = useRef(rpd.comment || "");
  const routeApiRef = useRef(null);

  useEffect(() => {
    const fresh = rpd.comment || "";
    if (comment === initialCommentRef.current) {
      setComment(fresh);
      lastSavedRef.current = fresh;
    }
    initialCommentRef.current = fresh;

  }, [rpd.comment]);

  useEffect(() => {
    if (!canEdit) return;
    if (comment === lastSavedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const value = comment;
      try {
        await api.updateRpd(rpdId, { comment: value });
        lastSavedRef.current = value;
        await reload();
      } catch {

      }
    }, 600);
    return () => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; } };
  }, [comment, canEdit, rpdId, reload]);

  async function handleClose() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      if (canEdit && comment !== lastSavedRef.current) {
        try { await api.updateRpd(rpdId, { comment }); lastSavedRef.current = comment; await reload(); } catch {}
      }
    }
    const r = routeApiRef.current;
    if (r && r.isDirty()) {
      const ok = await r.commit();
      if (!ok) return;
    }
    onClose();
  }

  return <Modal width={760} onClose={handleClose}>
    <div style={{ padding: "18px 24px", borderBottom: "1px solid " + T.borderLight, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Свойства РПД</div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: T.textMuted }}>{rpd.status}</span>
    </div>

    <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
      <Section title="Основные">
        <FieldGrid>
          <Field label="Дисциплина"><Ro>{rpd.discipline_name}</Ro></Field>
          <Field label="Учебный год"><Ro>{rpd.academic_year}</Ro></Field>
          <Field label="Наименование РПД" colSpan={2}><Ro>{rpdName}</Ro></Field>
          <Field label="Общая трудоёмкость">
            <Ro>
              {totalZet > 0 ? `${totalZet} ЗЕ` : "—"}
              {totalHours > 0 && <span style={{ color: T.textMuted, marginLeft: 8 }}>· {totalHours} ч</span>}
            </Ro>
          </Field>
          <Field label="Автор РПД"><Ro>{rpd.author_name || "—"}</Ro></Field>
        </FieldGrid>
      </Section>

      {(rpd.bup_disciplines || []).some(b => b.is_manual) ? (
        <Section title="Учебные параметры">
          <ManualDisciplineTable bupDisciplines={rpd.bup_disciplines || []} disciplineName={rpd.discipline_name} />
          <Hint>Параметры заданы при создании РПД и после создания не редактируются. Если данные некорректные — создайте РПД заново.</Hint>
        </Section>
      ) : (
        <Section title="Привязанные дисциплины БУПа">
          <BupDisciplinesTable bupDisciplines={rpd.bup_disciplines || []} disciplineName={rpd.discipline_name} />
          <Hint>Дисциплины БУПа задаются при создании РПД и после создания не редактируются. Если состав некорректный — создайте РПД заново.</Hint>
        </Section>
      )}

      <Section title="Комментарий к РПД">
        {canEdit ? (
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Произвольная заметка для разработчика. В печатную форму не попадает."
            style={{ width: "100%", minHeight: 80, padding: "8px 10px", border: "1px solid " + T.border, borderRadius: 4, fontSize: 13, fontFamily: F, resize: "vertical", boxSizing: "border-box", outline: "none" }}
          />
        ) : <Ro placeholder="—">{rpd.comment}</Ro>}
      </Section>

      <Section title="Разработчики">
        <DeveloperEditor rpdId={rpdId} developers={rpd.developers || []} canEdit={canEdit} reload={reload} />
      </Section>

      <Section title="Маршрут согласования">
        <ApprovalRouteEditor rpdId={rpdId} rpd={rpd} canEdit={canEdit} user={user} reload={reload} routeApiRef={routeApiRef} />
      </Section>
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "1px solid " + T.borderLight, position: "sticky", bottom: 0, background: T.surface }}>
      <Btn onClick={handleClose}>Закрыть</Btn>
    </div>
  </Modal>;
}

function Section({ title, children }) {
  return <div>
    <div style={{ ...sectionLabel, marginBottom: 10 }}>{title}</div>
    {children}
  </div>;
}

function FieldGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>{children}</div>;
}

function Field({ label, children, colSpan }) {
  return <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}

function Ro({ children, placeholder }) {
  const empty = children === null || children === undefined || children === "" || (typeof children === "string" && !children.trim());
  return <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 4, fontSize: 13, color: empty ? T.textMuted : T.text, fontStyle: empty ? "italic" : "normal", minHeight: 18 }}>
    {empty ? (placeholder || "—") : children}
  </div>;
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>{children}</div>;
}
