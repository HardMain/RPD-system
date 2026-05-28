import { useRef, useState } from "react";
import * as api from "../../../api/client.js";
import { T, iconBtnDelete } from "../../../styles/index.js";
import { Btn } from "../../../components/Btn.jsx";
import { TrashIcon, ChevronDownIcon, ChevronUpIcon } from "../../../components/icons.jsx";
import { ConfirmDeleteModal } from "../EditorModals.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";

const DOC_LIMIT = 30000;

const SEC_ORDER = [
  "goals", "objects", "requirements", "learning_outcomes", "content",
  "topics_practice", "topics_lab", "educational_tech", "methodical_recommendations",
  "literature_printed_main", "literature_additional_books",
  "literature_periodicals", "literature_normative", "literature_methodical_students", "literature_methodical_self_study",
  "literature_electronic", "software", "databases", "material_tech",
];
const secOrder = (k) => { const i = SEC_ORDER.indexOf(k); return i < 0 ? 999 : i; };

const SEC_LABELS = {
  goals: "1.1 Цели и задачи",
  objects: "1.2 Изучаемые объекты",
  requirements: "1.3 Входные требования",
  learning_outcomes: "2. Результаты обучения",
  content: "4. Содержание",
  topics_practice: "Тематика практических",
  topics_lab: "Тематика лабораторных",
  educational_tech: "5.1 Образовательные технологии",
  methodical_recommendations: "5.2 Методические указания",
  literature_printed_main: "6.1 Литература (основная)",
  literature_additional_books: "6.1 Учебные/научные изд.",
  literature_periodicals: "6.1 Периодические издания",
  literature_normative: "6.1 Нормативные документы",
  literature_methodical_students: "6.1 Метод. указания (освоение)",
  literature_methodical_self_study: "6.1 Метод. обеспечение СРС",
  literature_electronic: "6.2 Электронная литература",
  software: "6.3 ПО",
  databases: "6.4 БД и ИСС",
  material_tech: "7. МТО",
};
const secLabel = (k) => SEC_LABELS[k] || k;
const fmt = (n) => n.toLocaleString("ru-RU");

export function DocsUpload() {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingSecDelete, setPendingSecDelete] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sectionsCache, setSectionsCache] = useState({});
  const [loadingSec, setLoadingSec] = useState(false);
  const [openSec, setOpenSec] = useState(() => new Set());

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setBusy(true);
    try { await api.uploadDocument(rpdId, file); } catch { }
    await reload();
    setBusy(false);
  };

  async function performDelete(doc) {
    if (!doc) return;
    setBusy(true);
    try { await api.deleteDocument(doc.id_document); } catch { }
    await reload();
    setBusy(false);
  }

  async function fetchSections(docId) {
    setLoadingSec(true);
    try {
      const r = await api.getDocumentSections(docId);
      setSectionsCache(prev => ({ ...prev, [docId]: r.data?.sections || [] }));
    } catch { setSectionsCache(prev => ({ ...prev, [docId]: [] })); }
    setLoadingSec(false);
  }

  async function toggleExpand(docId) {
    if (expandedId === docId) { setExpandedId(null); return; }
    setExpandedId(docId);
    if (!sectionsCache[docId]) await fetchSections(docId);
  }

  async function performSecDelete(docId, chunk) {
    if (!chunk) return;
    setBusy(true);
    try { await api.deleteDocumentSection(chunk.id_section_chunk); } catch { }
    await fetchSections(docId);
    await reload();
    setBusy(false);
  }

  function toggleSec(key) {
    setOpenSec(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const docs = rpd.uploaded_documents || [];
  const sectionedDocs = docs.filter(d => d.parse_mode === "sections");
  const fullDocs = docs.filter(d => d.parse_mode !== "sections");

  const perSection = {};
  for (const d of sectionedDocs) {
    for (const s of (d.parsed_sections || [])) {
      perSection[s.section_key] = (perSection[s.section_key] || 0) + s.chars;
    }
  }
  const parsedVals = Object.values(perSection);
  const maxParsed = parsedVals.length ? Math.min(DOC_LIMIT, Math.max(...parsedVals)) : 0;
  const fullDocUsage = (() => {
    const out = {};
    let remaining = Math.max(0, DOC_LIMIT - maxParsed);
    for (const d of fullDocs) {
      const chars = d.text_chars || 0;
      const used = Math.min(chars, remaining);
      remaining -= used;
      out[d.id_document] = { minUsed: used, truncatable: chars > 0 && used < chars };
    }
    return out;
  })();
  const anySectionFilled = Object.keys(perSection).length > 0;
  const budgetRows = [...new Set([...SEC_ORDER, ...Object.keys(perSection)])]
    .map(key => [key, perSection[key] || 0])
    .sort((a, b) => secOrder(a[0]) - secOrder(b[0]));

  return <div>
    {docs.length > 0 && <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6, padding: "10px 14px", marginBottom: 12, background: T.bg }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        Бюджет на генерацию одного раздела: документы до {fmt(DOC_LIMIT)} символов
      </div>
      {anySectionFilled ? <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {budgetRows.map(([key, chars]) => {
          const pct = Math.min(100, Math.round((chars / DOC_LIMIT) * 100));
          const over = chars >= DOC_LIMIT;
          const empty = chars === 0;
          const color = over ? T.red : pct >= 70 ? T.orange : T.green;
          return <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, opacity: empty ? 0.55 : 1 }}>
            <span style={{ fontSize: 11, width: 170, flexShrink: 0, color: T.text }}>{secLabel(key)}</span>
            <span style={{ flex: 1, height: 6, background: T.borderLight, borderRadius: 3, overflow: "hidden" }}>
              <span style={{ display: "block", width: pct + "%", height: "100%", background: color }} />
            </span>
            <span style={{ fontSize: 11, width: 110, textAlign: "right", color: over ? T.red : T.textMuted, fontVariantNumeric: "tabular-nums" }}>{fmt(chars)} / {fmt(DOC_LIMIT)}</span>
          </div>;
        })}
      </div> : <div style={{ fontSize: 11, color: T.textMuted }}>Ни один документ не разбит по разделам.</div>}
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
        На каждый раздел: сначала распознанный кусок раздела, затем файлы без разбора добивают остаток — вместе не более {fmt(DOC_LIMIT)} симв.; одинаковые разделы из разных документов суммируются.
      </div>
    </div>}

    {docs.length > 0 ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>{docs.map((d, i) => {
      const sectioned = d.parse_mode === "sections";
      const isOpen = expandedId === d.id_document;
      const secs = [...(sectionsCache[d.id_document] || [])].sort((a, b) => secOrder(a.section_key) - secOrder(b.section_key));
      return <div key={d.id_document} style={{ borderBottom: i < docs.length - 1 ? "1px solid " + T.borderLight : "none" }}>
        <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.filename}</span>
              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{d.file_size ? (d.file_size / 1024).toFixed(0) + " КБ" : ""}</span>
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                background: sectioned ? T.greenLight : T.orangeLight,
                color: sectioned ? T.green : T.orange,
              }}>
                {sectioned ? `Разобран по разделам: ${d.parsed_sections.length} · ${fmt(d.parsed_chars)} симв.` : `Будет прочитан целиком${d.text_chars ? `: ${fmt(d.text_chars)} симв.` : ""}${fullDocUsage[d.id_document]?.truncatable ? ` (в контекст войдёт не менее ${fmt(fullDocUsage[d.id_document].minUsed)} симв.)` : ""}`}
              </span>
              {sectioned && <button onClick={() => toggleExpand(d.id_document)} style={{
                border: "none", background: "none", cursor: "pointer", color: T.accent,
                fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
              }}>
                {isOpen ? "Скрыть разбор" : "Показать разбор"}{isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>}
            </div>
            {sectioned && !isOpen && <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted }}>
              {[...d.parsed_sections].sort((a, b) => secOrder(a.section_key) - secOrder(b.section_key)).map(s => secLabel(s.section_key)).join(" · ")}
            </div>}
          </div>
          {isEdit && canEdit && <button onClick={() => setPendingDelete(d)} disabled={busy} title="Удалить документ" style={{ ...iconBtnDelete, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, flexShrink: 0 }}><TrashIcon /></button>}
        </div>
        {isOpen && <div style={{ padding: "0 14px 12px 14px" }}>
          {loadingSec && !sectionsCache[d.id_document] ? <div style={{ fontSize: 12, color: T.textMuted }}>Загрузка разбора…</div>
            : secs.length === 0 ? <div style={{ fontSize: 12, color: T.textMuted }}>Разделы не выделены.</div>
              : secs.map((s, idx) => {
                const k = `${d.id_document}:${s.id_section_chunk}`;
                const open = openSec.has(k);
                return <div key={k} style={{ marginBottom: 6, border: "1px solid " + T.borderLight, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", background: T.bg }}>
                    <button onClick={() => toggleSec(k)} style={{
                      flex: 1, minWidth: 0, padding: "6px 10px", background: "none", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                    }}>
                      <span style={{ display: "inline-flex", color: T.textMuted }}>{open ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
                      <span style={{ flex: 1 }}>{secLabel(s.section_key)}</span>
                      <span style={{ color: T.textMuted, fontWeight: 400 }}>{fmt(s.length)} симв.</span>
                    </button>
                    {isEdit && canEdit && <button
                      onClick={() => setPendingSecDelete({ docId: d.id_document, chunk: s })}
                      disabled={busy}
                      title="Убрать этот раздел из контекста"
                      style={{ ...iconBtnDelete, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, flexShrink: 0, marginRight: 6 }}
                    ><TrashIcon /></button>}
                  </div>
                  {open && <div style={{ padding: "8px 10px", fontSize: 12, color: T.textMuted, whiteSpace: "pre-wrap", lineHeight: 1.5, borderTop: "1px solid " + T.borderLight }}>
                    {s.content}
                  </div>}
                </div>;
              })}
        </div>}
      </div>;
    })}</div> : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>Документы не загружены</div>}

    {isEdit && canEdit && <div style={{ marginTop: 12 }}>
      <input ref={fileRef} type="file" onChange={handleUpload} accept=".pdf,.docx,.doc,.txt,.xlsx" style={{ display: "none" }} />
      <Btn small onClick={() => fileRef.current.click()} disabled={busy}>{busy ? "Загрузка…" : "Загрузить документ"}</Btn>
      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>PDF, DOCX, TXT, XLSX (до 50 МБ). Если разбить по разделам не вышло — документ читается целиком.</span>
    </div>}

    {pendingDelete && <ConfirmDeleteModal
      title="Удалить документ?"
      message={`«${pendingDelete.filename}» будет удалён и больше не будет использоваться как контекст при автогенерации этой РПД.`}
      confirmLabel="Удалить"
      onClose={() => setPendingDelete(null)}
      onConfirm={async () => { const d = pendingDelete; setPendingDelete(null); await performDelete(d); }}
    />}

    {pendingSecDelete && <ConfirmDeleteModal
      title="Убрать раздел из контекста?"
      message={`Раздел «${secLabel(pendingSecDelete.chunk.section_key)}» из «${(docs.find(x => x.id_document === pendingSecDelete.docId) || {}).filename || ""}» больше не будет использоваться при автогенерации. Сам документ останется.`}
      confirmLabel="Убрать"
      onClose={() => setPendingSecDelete(null)}
      onConfirm={async () => { const p = pendingSecDelete; setPendingSecDelete(null); await performSecDelete(p.docId, p.chunk); }}
    />}
  </div>;
}
