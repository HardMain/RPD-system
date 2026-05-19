import { useEffect, useState } from "react";
import * as api from "../api/client.js";
import { T, F, hdr, tcell, dataTable, adminToolbar, adminAddLabel, pageContainer, pageToolbar, pageScroll } from "../styles/index.js";
import { Btn } from "../components/Btn.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { formatDateTimeRu } from "../utils/format.js";
import { AlertModal } from "../features/rpd-editor/EditorModals.jsx";

const miniLabel = adminAddLabel;

const textareaStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid " + T.border,
  borderRadius: 4,
  fontSize: 13, fontFamily: F,
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  background: T.surface,
};

const SUBS = [
  { id: "prompts", label: "Промпты по разделам" },
  { id: "logs", label: "Журнал генерации" },
];

export function AdminLlmPage() {
  const [sub, setSub] = useState("prompts");
  return <div style={pageContainer}>
    <div style={pageToolbar}>
      {SUBS.map(s => (
        <Btn key={s.id} small primary={sub === s.id} onClick={() => setSub(s.id)}>{s.label}</Btn>
      ))}
    </div>
    <div style={pageScroll}>
      {sub === "prompts" && <LlmPromptsContent />}
      {sub === "logs" && <LlmLogsContent />}
    </div>
  </div>;
}

function LlmLogsContent() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.adminListLlmLogs()
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return <div>
    <div style={adminToolbar}>
      <div style={{ fontSize: 12, color: T.textMuted }}>
        Отладочная информация: что подавалось в LLM как контекст при генерации разделов (последние 200).
      </div>
      <Btn small onClick={load} disabled={loading} style={{ marginLeft: "auto" }}>Обновить</Btn>
    </div>
    {loading
      ? <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>
      : logs.length === 0
        ? <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>Генераций пока не было.</div>
        : <div className="table-scroll">
          <table style={dataTable}>
            <thead><tr style={{ background: T.surface }}>
              {["Когда", "РПД", "Раздел", "Источники контекста", "Модель", "Токены", "Время"].map(h =>
                <th key={h} style={hdr}>{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id_log} style={{ background: T.surface }}>
                  <td style={{ ...tcell, whiteSpace: "nowrap" }}>{l.created_at ? formatDateTimeRu(l.created_at) : "—"}</td>
                  <td style={tcell}>{l.rpd_label}</td>
                  <td style={tcell}>{l.section_label}</td>
                  <td style={{ ...tcell, color: l.context_sources.length ? T.text : T.textMuted }}>
                    {l.context_sources.length
                      ? l.context_sources.map((s, i) => <div key={i}>{s}</div>)
                      : "без материалов (модель сама)"}
                  </td>
                  <td style={{ ...tcell, whiteSpace: "nowrap", color: l.model_name === "fallback" ? T.orange : T.text }}>{l.model_name}</td>
                  <td style={{ ...tcell, textAlign: "center" }}>{l.tokens_used ?? "—"}</td>
                  <td style={{ ...tcell, textAlign: "center", whiteSpace: "nowrap" }}>{l.generation_time_ms != null ? `${l.generation_time_ms} мс` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
  </div>;
}

function LlmPromptsContent() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [, setSavedTick] = useState(0);

  const fetchAll = (silent) => {
    if (!silent) setLoading(true);
    api.adminListLlmPrompts().then(r => setPrompts(r.data || []))
      .catch(() => { if (!silent) setPrompts([]); })
      .finally(() => { if (!silent) setLoading(false); });
  };
  useEffect(() => { fetchAll(false); }, []);

  async function saveField(idPrompt, field, value) {
    try {
      await api.adminUpdateLlmPrompt(idPrompt, { [field]: value });
      setSavedTick(t => t + 1);
      fetchAll(true);
    } catch (err) {
      setErrorMsg("Не удалось сохранить: " + (err?.response?.data?.detail || err.message));
    }
  }

  if (loading) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner /></div>;
  }
  if (prompts.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic" }}>
      Промпты ещё не созданы. Пересоздайте БД — seed добавит базовые шаблоны.
    </div>;
  }

  return <>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {prompts.map(p => <PromptCard key={p.id_prompt} prompt={p} onSave={saveField} />)}
    </div>
    {errorMsg && <AlertModal title="Ошибка" message={errorMsg} onClose={() => setErrorMsg(null)} />}
  </>;
}

function PromptCard({ prompt, onSave }) {
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt || "");
  const [userPromptTemplate, setUserPromptTemplate] = useState(prompt.user_prompt_template || "");
  const [description, setDescription] = useState(prompt.description || "");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => { setSystemPrompt(prompt.system_prompt || ""); }, [prompt.system_prompt]);
  useEffect(() => { setUserPromptTemplate(prompt.user_prompt_template || ""); }, [prompt.user_prompt_template]);
  useEffect(() => { setDescription(prompt.description || ""); }, [prompt.description]);

  function commitSystem() {
    if (systemPrompt === (prompt.system_prompt || "")) return;
    onSave(prompt.id_prompt, "system_prompt", systemPrompt || null);
  }
  function commitUserTemplate() {
    if (userPromptTemplate === (prompt.user_prompt_template || "")) return;
    onSave(prompt.id_prompt, "user_prompt_template", userPromptTemplate);
  }
  function commitDescription() {
    if (description === (prompt.description || "")) return;
    onSave(prompt.id_prompt, "description", description || null);
  }

  const updatedAt = prompt.updated_at ? formatDateTimeRu(prompt.updated_at) : null;

  return <div style={{ background: T.surface, border: "1px solid " + T.borderLight, borderRadius: 6, overflow: "hidden" }}>
    <button type="button" onClick={() => setCollapsed(c => !c)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", background: "transparent", border: "none",
        borderBottom: collapsed ? "none" : "1px solid " + T.borderLight,
        cursor: "pointer", textAlign: "left", fontFamily: F,
      }}>
      <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 22 }}>{prompt.order_index || ""}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1 }}>{prompt.section_label}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase",
        padding: "2px 8px", borderRadius: 10,
        background: prompt.is_structural ? T.accentLight : T.bg,
        color: prompt.is_structural ? T.accent : T.textMuted,
      }}>{prompt.is_structural ? "JSON" : "Текст"}</span>
      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>{prompt.section_key}</span>
      <span style={{ color: T.textMuted, fontSize: 14 }}>{collapsed ? "▸" : "▾"}</span>
    </button>
    {!collapsed && <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={miniLabel}>Описание / подсказка для админа</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={commitDescription}
          placeholder="Кратко: что именно генерируется, какой формат ожидается"
          rows={2}
          style={textareaStyle}
        />
      </div>
      <div>
        <label style={miniLabel}>System prompt <span style={{ color: T.textMuted, fontWeight: 400 }}>(оставьте пустым — будет использован общий системный промпт)</span></label>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          onBlur={commitSystem}
          placeholder="Опционально: переопределить системный промпт для этого раздела"
          rows={3}
          style={textareaStyle}
        />
      </div>
      <div>
        <label style={miniLabel}>User prompt template <span style={{ color: T.red, fontWeight: 700 }}>*</span></label>
        <textarea
          value={userPromptTemplate}
          onChange={e => setUserPromptTemplate(e.target.value)}
          onBlur={commitUserTemplate}
          placeholder="Шаблон промпта. Плейсхолдеры: {discipline}, {direction}, {profile}, {total_hours}, {lecture_hours}, {practice_hours}, {lab_hours}, {self_study_hours}"
          rows={8}
          style={{ ...textareaStyle, fontFamily: "monospace", fontSize: 12 }}
        />
      </div>
      {updatedAt && <div style={{ fontSize: 10, color: T.textMuted, textAlign: "right", fontStyle: "italic" }}>
        Обновлено: {updatedAt}
      </div>}
    </div>}
  </div>;
}
