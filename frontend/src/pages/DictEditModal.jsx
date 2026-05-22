import { useMemo, useState } from "react";
import * as api from "../api/client.js";
import { T, modalTitleHeader, modalFooterWide } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { Modal } from "../components/Modal.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import {
  INDICATOR_KINDS, parseIndicatorCode, buildIndicatorCode,
  MODE_OPTIONS, litTypeOptions, INDEX_OPTIONS, SOFTWARE_TYPE_OPTIONS,
  miniLabel, miniInput, inputStyle,
} from "./dictionaryHelpers.js";

export function DictEditModal({ entry, competencyOptions, directionOptions, disciplineOptions, onClose, onSaved, onError, onDelete }) {
  const isLiterature = entry.kind === "literature_title";
  const isIndicatorKind = INDICATOR_KINDS.has(entry.kind);
  const isDirectionScoped = entry.kind === "indicator_description";
  const isDisciplineScoped = entry.kind === "literature_title";
  const isSoftware = entry.kind === "software_name";
  const isDatabase = entry.kind === "database_name";

  const initialIndicatorContext = useMemo(() => {
    if (entry.kind === "indicator_code") {
      const p = parseIndicatorCode(entry.value || "");
      return { competency: p.competency || (entry.source_type || ""), index: String(p.index || 1) };
    }
    if (entry.kind === "indicator_description") {
      const p = parseIndicatorCode(entry.source_type || "");
      return { competency: p.competency || "", index: String(p.index || 1) };
    }
    return { competency: "", index: "1" };
  }, [entry]);

  const [value, setValue] = useState(entry.value || "");
  const [sourceType, setSourceType] = useState(entry.source_type || "");
  const [mode, setMode] = useState(entry.mode || "");
  const [competency, setCompetency] = useState(initialIndicatorContext.competency);
  const [index, setIndex] = useState(initialIndicatorContext.index);
  const [directionCode, setDirectionCode] = useState(entry.direction_code || "");
  const [disciplineId, setDisciplineId] = useState(entry.id_discipline || "");
  const [extra, setExtra] = useState(entry.extra || "");
  const [saving, setSaving] = useState(false);

  const longText = entry.kind === "indicator_description" || entry.kind === "literature_title";

  async function save() {
    setSaving(true);
    try {
      if (entry.kind === "discipline") {
        const v = value.trim();
        if (!v) throw new Error("Заполните название");
        await api.adminUpdateDiscipline(entry.id_entry, { name: v });
        onSaved();
        return;
      }
      let payload;
      if (entry.kind === "indicator_code") {
        const comp = competency.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        payload = { value: buildIndicatorCode(comp, index), source_type: comp };
      } else if (entry.kind === "indicator_description") {
        const comp = competency.trim();
        const desc = value.trim();
        if (!comp) throw new Error("Выберите компетенцию");
        if (!desc) throw new Error("Заполните описание");
        if (!directionCode) throw new Error("Выберите направление");
        payload = { value: desc, source_type: buildIndicatorCode(comp, index), direction_code: directionCode };
      } else if (isLiterature) {
        const v = value.trim();
        if (!v) throw new Error("Заполните значение");
        if (!sourceType) throw new Error("Выберите подраздел");
        if (!mode) throw new Error("Выберите тип");
        if (!disciplineId) throw new Error("Выберите дисциплину");
        payload = { value: v, source_type: sourceType, mode: mode, id_discipline: Number(disciplineId) };
      } else if (isSoftware) {
        const v = value.trim();
        if (!v) throw new Error("Заполните значение");
        if (!sourceType) throw new Error("Выберите вид ПО");
        payload = { value: v, source_type: sourceType };
      } else if (isDatabase) {
        const v = value.trim();
        if (!v) throw new Error("Заполните наименование");
        if (!extra.trim()) throw new Error("Укажите ссылку на информационный ресурс");
        payload = { value: v, extra: extra.trim() };
      } else {
        const v = value.trim();
        if (!v) throw new Error("Заполните значение");
        payload = { value: v };
      }
      await api.adminUpdateDictionary(entry.id_entry, payload);
      onSaved();
    } catch (e) {
      onError("Не удалось сохранить: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  }

  return <Modal width={560} onClose={onClose}>
    <div style={modalTitleHeader}>
      Редактирование записи
    </div>
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      {isLiterature && (
        <>
          <div>
            <div style={miniLabel}>Тип <span style={{ color: T.red }}>*</span></div>
            <Dropdown value={mode} options={MODE_OPTIONS}
              onChange={(v) => {
                setMode(v);
                const opts = litTypeOptions(v).map(o => o.value);
                if (sourceType && !opts.includes(sourceType)) setSourceType("");
              }}
              placeholder="— не указано —" clearLabel="— не указано —" />
          </div>
          <div>
            <div style={miniLabel}>Подраздел <span style={{ color: T.red }}>*</span></div>
            <Dropdown value={sourceType} options={litTypeOptions(mode)} onChange={setSourceType}
              disabled={!mode}
              placeholder={mode ? "— не указано —" : "Сначала выберите тип"}
              clearLabel="— не указано —" />
          </div>
        </>
      )}
      {isIndicatorKind && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", minWidth: 220 }}>
            <div style={miniLabel}>Компетенция</div>
            {(competencyOptions || []).length === 0
              ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>—</div>
              : <Dropdown
                  value={competency}
                  options={competencyOptions.map(c => ({ value: c, label: c }))}
                  onChange={setCompetency}
                  placeholder="— не указано —"
                  clearLabel="— не указано —"
                />}
          </div>
          <div style={{ flex: "0 0 180px" }}>
            <div style={miniLabel}>Индекс</div>
            <Dropdown value={index} options={INDEX_OPTIONS} onChange={setIndex} />
          </div>
          {entry.kind === "indicator_code" && (
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <div style={miniLabel}>Получится</div>
              <div style={{
                ...miniInput,
                fontWeight: 600,
                color: competency ? T.accent : T.textMuted,
                background: competency ? T.accentLight : T.bg,
                border: "1px solid " + (competency ? T.accent : T.borderLight),
                fontStyle: competency ? "normal" : "italic",
              }}>
                {competency ? buildIndicatorCode(competency, index) : "выберите компетенцию"}
              </div>
            </div>
          )}
          {isDirectionScoped && (
            <div style={{ flex: "1 1 260px", minWidth: 240 }}>
              <div style={miniLabel}>Направление <span style={{ color: T.red }}>*</span></div>
              {(directionOptions || []).length === 0
                ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>—</div>
                : <Dropdown
                    value={directionCode}
                    options={directionOptions.map(d => ({ value: d.code, label: `${d.code} ${d.name}` }))}
                    onChange={setDirectionCode}
                    placeholder="— не указано —"
                    clearLabel="— не указано —"
                  />}
            </div>
          )}
        </div>
      )}
      {isDisciplineScoped && (
        <div>
          <div style={miniLabel}>Дисциплина <span style={{ color: T.red }}>*</span></div>
          {(disciplineOptions || []).length === 0
            ? <div style={{ ...miniInput, color: T.textMuted, fontStyle: "italic" }}>—</div>
            : <Dropdown
                value={disciplineId ? String(disciplineId) : ""}
                options={disciplineOptions.map(d => ({ value: String(d.id), label: d.name }))}
                onChange={v => setDisciplineId(v ? Number(v) : "")}
                placeholder="— не указано —"
                clearLabel="— не указано —"
              />}
        </div>
      )}
      {isSoftware && (
        <div>
          <div style={miniLabel}>Вид ПО <span style={{ color: T.red }}>*</span></div>
          <Dropdown
            value={sourceType}
            options={SOFTWARE_TYPE_OPTIONS}
            onChange={setSourceType}
            placeholder="— не указано —"
            clearLabel="— не указано —"
          />
        </div>
      )}
      {entry.kind === "indicator_code" ? null : (
        <div>
          <div style={miniLabel}>{entry.kind === "indicator_description" ? "Описание" : "Значение"}</div>
          {longText
            ? <textarea
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              />
            : <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); }}
                style={inputStyle}
              />}
        </div>
      )}
      {isDatabase && (
        <div>
          <div style={miniLabel}>Ссылка на информационный ресурс <span style={{ color: T.red }}>*</span></div>
          <input value={extra} onChange={e => setExtra(e.target.value)} style={inputStyle} placeholder="https://… или «локальная сеть»" />
        </div>
      )}
    </div>
    <div style={modalFooterWide("space-between")}>
      <div>
        {onDelete && <Btn danger onClick={onDelete}>Удалить</Btn>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn primary onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Btn>
        <Btn onClick={onClose}>Отмена</Btn>
      </div>
    </div>
  </Modal>;
}
