import { useEffect, useState, useCallback } from "react";
import * as api from "../../../api/client.js";
import { T, F } from "../../../theme.js";
import { td, th } from "../../../styles.js";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { BupDropdown } from "../BupDropdown.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";

export function OutcomesEditor() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const [rows, setRows] = useState([]);
  const [tools, setTools] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Переключатель «текущая БУП-дисциплина». Без него при multi-БУП в таблице
  // вперемешку оказываются индикаторы разных привязок — как в АРМ ПНИПУ это
  // решено выпадающим списком сверху раздела 2.
  const bds = rpd?.bup_disciplines || [];
  const [currentBdId, setCurrentBdId] = useState(() => bds[0]?.id_bup_discipline || null);

  // Если состав привязок поменялся (после reload), синхронизируем выбор: первая
  // оставшаяся, либо null если ничего не привязано.
  useEffect(() => {
    if (bds.length === 0) { setCurrentBdId(null); return; }
    if (!bds.some(b => b.id_bup_discipline === currentBdId)) {
      setCurrentBdId(bds[0].id_bup_discipline);
    }
  }, [bds, currentBdId]);

  const reloadRows = useCallback(async () => {
    try {
      const r = await api.getOutcomesTable(rpdId, currentBdId);
      setRows(r.data);
      setLoaded(true);
    } catch { setLoaded(true); }
  }, [rpdId, currentBdId]);

  useEffect(() => {
    reloadRows();
    api.getAssessmentTools().then(r => setTools(r.data)).catch(() => setTools([]));
  }, [reloadRows]);

  // Сохранение по blur — отправляем upsert и обновляем локальную строку.
  async function saveRow(idx, patch) {
    const row = rows[idx];
    const next = { ...row, ...patch };
    setRows(prev => prev.map((r, i) => i === idx ? next : r));
    try {
      const r = await api.upsertOutcome(rpdId, {
        id_indicator: row.id_indicator,
        outcome_text: next.outcome_text || "",
        assessment_tool: next.assessment_tool || "",
      });
      // backend вернёт id_outcome=0 если запись была удалена
      const id_outcome = r.data.id_outcome || null;
      setRows(prev => prev.map((rr, i) => i === idx ? { ...rr, id_outcome } : rr));
      // Сообщаем родителю что РПД изменилась — чтобы PDF мог перерисоваться
      reload?.();
    } catch (e) {
      // Откат при ошибке
      setRows(prev => prev.map((r, i) => i === idx ? row : r));
      alert("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
  }

  if (!loaded) return null;

  if (bds.length === 0) {
    return <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
      РПД не привязана ни к одной БУП-дисциплине — раздел 2 заполнить нечем. Привязка задаётся при создании РПД.
    </div>;
  }

  const currentBd = bds.find(b => b.id_bup_discipline === currentBdId) || bds[0];

  const wrap = { wordBreak: "normal", overflowWrap: "break-word" };
  return <div>
    {/* Переключатель «текущая БУП-дисциплина»: даже если привязана одна — показываем
        её реквизиты (БУП-код, направление), как в АРМ. Если несколько — выпадающим
        списком переключаемся между привязками; таблица перерисовывается под её
        компетенции. Outcomes хранятся per-индикатор, поэтому если у двух привязок
        совпадают индикаторы (например, общая компетенция), заполненный текст там и
        там одинаковый. */}
    <div style={{ marginBottom: 14, padding: "10px 12px", background: T.bg, border: "1px solid " + T.borderLight, borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".4px", flexShrink: 0 }}>
          Дисциплина БУП
        </span>
        {bds.length === 1 ? (
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, wordBreak: "normal", overflowWrap: "break-word" }}>
            {currentBd.bup_year ? currentBd.bup_year + " " : ""}{currentBd.bup_name || "БУП"}
            {currentBd.code ? ` · ${currentBd.code}` : ""}
          </span>
        ) : (
          <BupDropdown
            bds={bds}
            value={currentBdId}
            onChange={setCurrentBdId}
            title="Переключить текущую БУП-дисциплину"
          />
        )}
      </div>
      {currentBd && (
        <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted }}>
          {currentBd.direction_code ? `${currentBd.direction_code} ${currentBd.direction_name || ""}` : (currentBd.direction_name || "—")}
          {currentBd.direction_profile ? ` · ${currentBd.direction_profile}` : ""}
        </div>
      )}
    </div>
    {rows.length === 0 ? (
      <div style={{ padding: 12, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
        У выбранной БУП-дисциплины ({currentBd.code || "—"}, БУП «{currentBd.bup_name || "—"}») в базе нет привязанных компетенций или у её компетенций не заполнены индикаторы.
      </div>
    ) : (
    <div className="table-scroll">
    {/* Шапка и порядок колонок 1:1 с шаблоном rpd_template.docx (TABLE 4):
         Компетенция | Индекс индикатора | Планируемые результаты обучения...
         | Индикатор достижения компетенции... | Средства оценки */}
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup>
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "30%" }} />
        <col style={{ width: "20%" }} />
      </colgroup>
      <thead><tr>
        <th style={{ ...th, ...wrap }}>Компетенция</th>
        <th style={{ ...th, ...wrap }}>Индекс индикатора</th>
        <th style={{ ...th, ...wrap }}>Планируемые результаты обучения по дисциплине (знать, уметь, владеть)</th>
        <th style={{ ...th, ...wrap }}>Индикатор достижения компетенции, с которым соотнесены планируемые результаты обучения</th>
        <th style={{ ...th, ...wrap }}>Средства оценки</th>
      </tr></thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.id_indicator}>
            <td style={{ ...td, ...wrap }}><b>{r.competency_code}</b></td>
            <td style={{ ...td, ...wrap }}>{r.indicator_code}</td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <OutcomeTextarea
                value={r.outcome_text || ""}
                disabled={!isEdit || !canEdit}
                onSave={v => saveRow(idx, { outcome_text: v })}
              />
            </td>
            <td style={{ ...td, ...wrap }}>{r.indicator_description}</td>
            <td style={{ ...td, padding: 4, ...wrap }}>
              <AssessmentToolPicker
                value={r.assessment_tool || ""}
                tools={tools}
                disabled={!isEdit || !canEdit}
                onSave={v => saveRow(idx, { assessment_tool: v })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
    )}
  </div>;
}


function OutcomeTextarea({ value, disabled, onSave }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  if (disabled) {
    return <div style={{ padding: "6px 8px", whiteSpace: "pre-wrap", fontSize: 13, color: value ? T.text : T.textMuted, fontStyle: value ? "normal" : "italic" }}>{value || "—"}</div>;
  }
  return <textarea
    value={local}
    onChange={e => setLocal(e.target.value)}
    onBlur={() => { if (local !== value) onSave(local); }}
    placeholder="Знать… / Уметь… / Владеть…"
    style={{ width: "100%", minHeight: 56, padding: "6px 8px", border: "1px solid " + T.borderLight, borderRadius: 4, fontSize: 13, fontFamily: F, resize: "vertical", boxSizing: "border-box", background: T.surface, outline: "none" }}
  />;
}


function AssessmentToolPicker({ value, tools, disabled, onSave }) {
  if (disabled) {
    return <div style={{ padding: "6px 8px", fontSize: 13, color: value ? T.text : T.textMuted, fontStyle: value ? "normal" : "italic" }}>{value || "—"}</div>;
  }
  // Значения средств оценки уникальны по name (так же ключуем backend-список),
  // поэтому value/label дропдауна — это просто name. clearLabel позволяет
  // вернуться в «не выбрано», без отдельной кнопки X.
  const options = tools.map(t => ({ value: t.name, label: t.name }));
  return <Dropdown
    value={value || ""}
    options={options}
    onChange={v => { if (v !== value) onSave(v); }}
    placeholder="Выбрать средство оценки"
    clearLabel="Не выбрано"
    title="Средство оценки"
  />;
}
