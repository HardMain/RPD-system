import { useState } from "react";
import * as api from "../../../api/client.js";
import { T } from "../../../theme.js";
import { Btn } from "../../../components/Btn.jsx";
import { Dropdown } from "../../../components/Dropdown.jsx";
import { MultiSelectDropdown } from "../../../components/MultiSelectDropdown.jsx";
import { PlusIcon, TrashIcon } from "../../../components/icons.jsx";
import { useRpdEditor } from "../RpdEditorContext.jsx";
import { LITERATURE_TYPES, ELS_OPTIONS } from "../catalogs.js";

const UCH = "Учебные и научные издания";

/**
 * Универсальный редактор разделов 6.1 (печатная) и 6.2 (электронная литература).
 *
 * Печатная:    вид + наименование + кол-во экземпляров.
 * Электронная: вид + наименование + URL + список ЭБС, в которых она доступна.
 *
 * Для основной литературы («Учебные и научные издания») в будущем планируется
 * парсинг с сайта-каталога ПНИПУ — преподаватель будет тыкать в нужное и
 * остальное (наименование, кол-во экземпляров, URL для электронных) подставится
 * автоматически. Пока это просто ручной ввод как у остальных видов; кнопка-
 * заглушка «Подобрать с сайта» оставлена местом под будущий picker.
 */
export function LiteratureEditor({ kind }) {
  const { rpd, rpdId, isEdit, canEdit, reload } = useRpdEditor();
  const isElectronic = kind === "electronic";
  const items = (rpd.literature || []).filter(l => isElectronic ? !!l.url : !l.url);

  const [showAdd, setShowAdd] = useState(false);
  const initialForm = () => ({
    source_type: UCH,
    title: "",
    copies_count: "",
    url: "",
    availability: [],
  });
  const [form, setForm] = useState(initialForm);

  const addLit = async () => {
    if (!form.title.trim()) return;
    const payload = {
      source_type: form.source_type || UCH,
      title: form.title.trim(),
    };
    if (isElectronic) {
      payload.url = form.url.trim() || null;
      payload.availability = form.availability;
    } else {
      payload.copies_count = form.copies_count ? +form.copies_count : null;
    }
    try { await api.addLiterature(rpdId, payload); setShowAdd(false); setForm(initialForm()); await reload(); } catch { }
  };
  const delLit = async (id) => { await api.deleteLiterature(id); await reload(); };

  const typeOptions = LITERATURE_TYPES.map(t => ({ value: t, label: t }));

  return <div>
    {items.length > 0
      ? <div style={{ border: "1px solid " + T.borderLight, borderRadius: 6 }}>
          {items.map((l, i) => <LitRow
            key={l.id_literature}
            item={l}
            isElectronic={isElectronic}
            isLast={i === items.length - 1}
            canDelete={isEdit && canEdit}
            onDelete={() => delLit(l.id_literature)}
          />)}
        </div>
      : <div style={{ padding: 16, background: T.bg, borderRadius: 6, fontSize: 13, color: T.textMuted }}>
          {isElectronic ? "Электронная" : "Печатная"} литература не добавлена
        </div>}

    {isEdit && canEdit && <div style={{ marginTop: 12 }}>
      {!showAdd
        ? <Btn small onClick={() => { setForm(initialForm()); setShowAdd(true); }}><PlusIcon /> Добавить</Btn>
        : <div style={{ padding: 16, border: "1px solid " + T.accent, borderRadius: 8, background: T.accentLight + "33" }}>
            <Field label="Вид литературы">
              <Dropdown
                value={form.source_type}
                options={typeOptions}
                onChange={v => setForm(p => ({ ...p, source_type: v || UCH }))}
                placeholder="Выбрать вид"
              />
            </Field>
            {!isElectronic && form.source_type === UCH && (
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: -4, marginBottom: 8, fontStyle: "italic" }}>
                Для этого вида в будущем будет подбор из каталога библиотеки ПНИПУ — пока вводится вручную.
              </div>
            )}
            <Field label="Наименование">
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder={isElectronic ? "Например: Информатика. Базовый курс (Денисова Э.В., 2017)" : "Например: Курс физики (Трофимова Т.И., Академия, 2019)"}
                style={inputStyle()}
              />
            </Field>
            {isElectronic ? <>
              <Field label="URL электронного ресурса">
                <input
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://…"
                  style={inputStyle()}
                />
              </Field>
              <Field label="Доступность ЭБС">
                <MultiSelectDropdown
                  value={form.availability}
                  options={ELS_OPTIONS}
                  onChange={v => setForm(p => ({ ...p, availability: v }))}
                  placeholder="Выбрать ЭБС"
                />
              </Field>
            </> : (
              <Field label="Количество экземпляров">
                <input
                  type="number"
                  min="0"
                  value={form.copies_count}
                  onChange={e => setForm(p => ({ ...p, copies_count: e.target.value }))}
                  placeholder="Например, 30"
                  style={{ ...inputStyle(), width: 140 }}
                />
              </Field>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn small primary onClick={addLit}>Добавить</Btn>
              <Btn small onClick={() => setShowAdd(false)}>Отмена</Btn>
            </div>
          </div>}
    </div>}
  </div>;
}


function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, fontWeight: 600 }}>{label}</div>
    {children}
  </div>;
}

function inputStyle() {
  return {
    width: "100%",
    padding: "6px 10px",
    border: "1px solid " + T.border,
    borderRadius: 4,
    fontSize: 13,
    boxSizing: "border-box",
    background: T.surface,
  };
}


function LitRow({ item, isElectronic, isLast, canDelete, onDelete }) {
  const avail = Array.isArray(item.availability) ? item.availability : [];
  return <div style={{
    padding: "10px 14px",
    borderBottom: isLast ? "none" : "1px solid " + T.borderLight,
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 2 }}>
        {item.source_type || "—"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "normal", overflowWrap: "break-word" }}>
        {item.title}
      </div>
      {!isElectronic && item.copies_count != null && (
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>экз.: {item.copies_count}</div>
      )}
      {isElectronic && item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.blue, wordBreak: "break-all" }}>{item.url}</a>
      )}
      {isElectronic && avail.length > 0 && (
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
          Доступно: {avail.join(", ")}
        </div>
      )}
    </div>
    {canDelete && (
      <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", flexShrink: 0 }}>
        <TrashIcon />
      </button>
    )}
  </div>;
}
