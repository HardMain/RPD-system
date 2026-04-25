"""PDF export: PyMuPDF fills the official ПНИПУ template title page,
ReportLab generates content pages matching the same format.
"""
import io
import os

import fitz  # PyMuPDF

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Paths ──────────────────────────────────────────────────────────────────
_HERE = os.path.dirname(__file__)
_TEMPLATE_PDF = os.path.normpath(os.path.join(_HERE, "..", "templates", "rpd_template.pdf"))

# Usable content width:  A4 210 mm − 25 mm left − 15 mm right = 170 mm
_PW = 170 * mm

# ── Font discovery ─────────────────────────────────────────────────────────
_FONT_CANDIDATES = [
    (  # Liberation Serif — metrically identical to Times New Roman
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ),
    (  # DejaVu Sans — always present (fonts-dejavu-core in Dockerfile)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ),
]


def _pick_fonts():
    for reg, bold in _FONT_CANDIDATES:
        if os.path.exists(reg):
            return reg, bold
    return None, None


_FONT_REG, _FONT_BOLD = _pick_fonts()


def _rl_font_names():
    """Register fonts for ReportLab; return (regular_name, bold_name)."""
    if _FONT_REG:
        try:
            pdfmetrics.registerFont(TTFont("RpdFont", _FONT_REG))
            pdfmetrics.registerFont(TTFont("RpdFont-Bold", _FONT_BOLD))
            return "RpdFont", "RpdFont-Bold"
        except Exception:
            pass
    return "Helvetica", "Helvetica-Bold"


_F, _FB = _rl_font_names()

_HDR_BG = colors.Color(0.85, 0.85, 0.90)
_BORDER  = colors.Color(0.40, 0.40, 0.40)


# ═══════════════════════════════════════════════════════════════════════════
# PART 1 — title page via PyMuPDF
# ═══════════════════════════════════════════════════════════════════════════

# Coordinates of VALUE spans on title page (from text extraction):
#   format: (y0, y1, field_key_or_value, bold?)
# x range of value area: 228 … 543 (A4 pt width ≈ 595)
_TITLE_FIELDS = [
    (367, 386, "discipline_name", True),
    (408, 426, "__очная__",       False),   # fixed
    (447, 465, "degree_level",    False),
    (487, 505, "__hours__",       False),   # computed
    (532, 551, "__direction__",   False),   # computed
    (578, 597, "direction_profile", False),
]
_YEAR_RECT = fitz.Rect(255, 788, 355, 808)
_VALUE_X0, _VALUE_X1 = 228.0, 543.0
_FS = 13.5   # font size matching template's 13.6 pt


def _field_value(key: str, rpd: dict) -> str:
    if key == "__очная__":
        return "очная"
    if key == "__hours__":
        h = rpd.get("total_hours") or 0
        zet = round(h / 36) if h else None
        return f"{h} ({zet})" if zet else (str(h) if h else "—")
    if key == "__direction__":
        return " ".join(filter(None, [
            rpd.get("direction_code", ""), rpd.get("direction_name", ""),
        ])).strip()
    return (rpd.get(key) or "—").strip()


def _fill_title_page(rpd_data: dict) -> bytes:
    """Open the template PDF, white-out old values, insert new ones.
    Returns single-page PDF bytes."""
    if not os.path.exists(_TEMPLATE_PDF):
        raise FileNotFoundError(f"Template not found: {_TEMPLATE_PDF}")

    doc  = fitz.open(_TEMPLATE_PDF)
    page = doc[0]

    fitz_font_r = fitz.Font(fontfile=_FONT_REG)  if _FONT_REG  else fitz.Font("helv")
    fitz_font_b = fitz.Font(fontfile=_FONT_BOLD) if _FONT_BOLD else fitz.Font("helv")

    # ── 1. Draw white rectangles over old values ──────────────────────────
    shape = page.new_shape()
    for y0, y1, _, __ in _TITLE_FIELDS:
        shape.draw_rect(fitz.Rect(_VALUE_X0, y0, _VALUE_X1, y1))
        shape.finish(fill=(1, 1, 1), color=None, width=0)
    shape.draw_rect(_YEAR_RECT)
    shape.finish(fill=(1, 1, 1), color=None, width=0)
    shape.commit()

    # ── 2. Insert new values ──────────────────────────────────────────────
    for y0, y1, key, bold in _TITLE_FIELDS:
        text = _field_value(key, rpd_data)
        font = fitz_font_b if bold else fitz_font_r
        tw   = fitz.TextWriter(page.rect)
        tw.append(_center_x(text, font, _VALUE_X0, _VALUE_X1, y1 - 2),
                  text, fontsize=_FS, font=font)
        tw.write_text(page)

    # ── 3. Update year in "Пермь XXXX" ───────────────────────────────────
    year = (rpd_data.get("academic_year") or "")[:4]
    if year:
        label = f"Пермь {year}"
        tw = fitz.TextWriter(page.rect)
        tw.append(_center_x(label, fitz_font_r, 0, 595, 804),
                  label, fontsize=_FS, font=fitz_font_r)
        tw.write_text(page)

    out = fitz.open()
    out.insert_pdf(doc, from_page=0, to_page=0)
    return out.tobytes()


def _center_x(text: str, font: fitz.Font, x0: float, x1: float, y_base: float):
    """Return (x, y_base) so that text is centered between x0 and x1."""
    tw = font.text_length(text, fontsize=_FS)
    x  = x0 + max(0.0, (x1 - x0 - tw) / 2)
    return (x, y_base)


# ═══════════════════════════════════════════════════════════════════════════
# PART 2 — content pages via ReportLab
# ═══════════════════════════════════════════════════════════════════════════

def _styles():
    s = getSampleStyleSheet()
    kw = dict(fontName=_F,  fontSize=11, leading=16, alignment=TA_JUSTIFY,
               spaceAfter=2 * mm)
    s.add(ParagraphStyle("H1",     fontName=_FB, fontSize=12, alignment=TA_CENTER,
                          spaceBefore=6 * mm, spaceAfter=4 * mm))
    s.add(ParagraphStyle("H2",     fontName=_FB, fontSize=11, alignment=TA_CENTER,
                          spaceBefore=4 * mm, spaceAfter=2 * mm))
    s.add(ParagraphStyle("Body",   firstLineIndent=7 * mm, **kw))
    s.add(ParagraphStyle("BodyNI", **kw))
    s.add(ParagraphStyle("Cell",   fontName=_F,  fontSize=10, leading=13))
    s.add(ParagraphStyle("CellB",  fontName=_FB, fontSize=10, leading=13))
    s.add(ParagraphStyle("CellS",  fontName=_F,  fontSize=9,  leading=12))
    return s


def _mktable(rows, col_widths, extra_style=None):
    base = [
        ("BACKGROUND",    (0, 0), (-1, 0),  _HDR_BG),
        ("GRID",          (0, 0), (-1, -1), 0.5, _BORDER),
        ("FONTNAME",      (0, 0), (-1, -1), _F),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    if extra_style:
        base.extend(extra_style)
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(base))
    return t


def _boxed(content_para, width=_PW):
    """Wrap a Paragraph in a single-cell bordered table (like the template)."""
    t = Table([[content_para]], colWidths=[width])
    t.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, _BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
    ]))
    return t


def _text_paras(text: str, st, indent=True):
    """Split text on newlines, return list of Paragraph flowables."""
    style = st["Body"] if indent else st["BodyNI"]
    result = []
    for line in (text or "").split("\n"):
        if line.strip():
            result.append(Paragraph(line.strip(), style))
    return result or [Paragraph("—", st["BodyNI"])]


def _generate_content_pages(rpd_data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=25 * mm, rightMargin=15 * mm,
        topMargin=20 * mm,  bottomMargin=20 * mm,
    )
    st    = _styles()
    story = []

    def dash():
        story.append(Paragraph("—", st["BodyNI"]))

    # ── 1. Общие положения ─────────────────────────────────────────────────
    story.append(Paragraph("1. Общие положения", st["H1"]))

    story.append(Paragraph("1.1. Цели и задачи дисциплины", st["H2"]))
    story.extend(_text_paras(rpd_data.get("goals_text"), st))
    if rpd_data.get("tasks_text"):
        story.extend(_text_paras(rpd_data["tasks_text"], st))

    story.append(Paragraph("1.2. Изучаемые объекты дисциплины", st["H2"]))
    story.extend(_text_paras(rpd_data.get("objects_text"), st))

    story.append(Paragraph("1.3. Входные требования", st["H2"]))
    reqs = _text_paras(rpd_data.get("requirements_text"), st)
    if reqs[0].text == "—":
        story.append(Paragraph("Не предусмотрены.", st["BodyNI"]))
    else:
        story.extend(reqs)

    # ── 2. Планируемые результаты обучения ─────────────────────────────────
    story.append(Paragraph("2. Планируемые результаты обучения по дисциплине", st["H1"]))
    outcomes = rpd_data.get("learning_outcomes", [])
    if outcomes:
        hdr = [
            Paragraph("<b>Компе-<br/>тенция</b>",                                          st["CellB"]),
            Paragraph("<b>Индекс<br/>индикатора</b>",                                      st["CellB"]),
            Paragraph("<b>Планируемые результаты обучения (знать, уметь, владеть)</b>",    st["CellB"]),
            Paragraph("<b>Индикатор достижения компетенции, с которым соотнесены ПРО</b>", st["CellB"]),
            Paragraph("<b>Средства<br/>оценки</b>",                                        st["CellB"]),
        ]
        rows = [hdr]
        for o in outcomes:
            rows.append([
                Paragraph(o.get("competency_code", ""),       st["Cell"]),
                Paragraph(o.get("indicator_code", ""),         st["Cell"]),
                Paragraph(o.get("outcome_text", "") or "—",   st["Cell"]),
                Paragraph(o.get("indicator_description", ""), st["Cell"]),
                Paragraph(o.get("assessment_tool", "") or "—", st["Cell"]),
            ])
        story.append(_mktable(rows, [18*mm, 22*mm, 44*mm, 56*mm, 30*mm]))
    else:
        dash()

    # ── 3. Объём и виды учебной работы ─────────────────────────────────────
    story.append(Paragraph("3. Объём и виды учебной работы", st["H1"]))

    lec = rpd_data.get("lecture_hours")      or 0
    pr  = rpd_data.get("practice_hours")     or 0
    lab = rpd_data.get("lab_hours")          or 0
    srs = rpd_data.get("self_study_hours")   or 0
    tot = rpd_data.get("total_hours")        or (lec + pr + lab + srs)
    contact = lec + pr + lab

    rows = [
        [Paragraph("<b>Вид учебной работы</b>", st["CellB"]),
         Paragraph("<b>Всего часов</b>",         st["CellB"])],
        ["1. Контактная аудиторная работа, из них:", str(contact)],
        ["   − лекции (Л)",                    str(lec)],
        ["   − лабораторные работы (ЛР)",      str(lab)],
        ["   − практические занятия (ПЗ)",     str(pr)],
        ["1.2. Самостоятельная работа студентов (СРС)", str(srs)],
        [Paragraph("<b>Общая трудоёмкость дисциплины</b>", st["CellB"]),
         Paragraph(f"<b>{tot}</b>", st["CellB"])],
        ["Форма итогового контроля", rpd_data.get("control_form") or "—"],
        ["Семестр(ы)",                str(rpd_data.get("semester") or "—")],
    ]
    story.append(_mktable(rows, [135*mm, 35*mm], [
        ("ALIGN",      (1, 1), (1, -1),  "CENTER"),
        ("BACKGROUND", (0, 6), (-1, 6),  colors.Color(0.90, 0.90, 0.95)),
        ("BACKGROUND", (0, 7), (-1, 8),  colors.Color(0.96, 0.96, 0.98)),
    ]))
    story.append(Spacer(1, 4 * mm))

    # ── 4. Содержание дисциплины ────────────────────────────────────────────
    story.append(Paragraph("4. Содержание дисциплины", st["H1"]))
    sections = rpd_data.get("sections", [])

    if sections:
        hdr = [
            Paragraph("<b>Наименование разделов дисциплины с кратким содержанием</b>", st["CellB"]),
            Paragraph("<b>Л</b>",   st["CellB"]),
            Paragraph("<b>ЛР</b>",  st["CellB"]),
            Paragraph("<b>ПЗ</b>",  st["CellB"]),
            Paragraph("<b>СРС</b>", st["CellB"]),
        ]
        rows = [hdr]
        tl = tp = tlb = ts = 0
        for sec in sections:
            sl  = sec.get("lecture_hours")    or 0
            sp  = sec.get("practice_hours")   or 0
            slb = sec.get("lab_hours")        or 0
            ss  = sec.get("self_study_hours") or 0
            cell = f"<b>{sec.get('section_number', '')}. {sec.get('title', '')}</b>"
            if sec.get("brief_content"):
                cell += f"<br/><font size=9>{sec['brief_content']}</font>"
            rows.append([Paragraph(cell, st["Cell"]),
                         str(sl), str(slb), str(sp), str(ss)])
            tl += sl; tp += sp; tlb += slb; ts += ss
        rows.append([
            Paragraph("<b>ИТОГО по дисциплине</b>", st["CellB"]),
            Paragraph(f"<b>{tl}</b>",  st["CellB"]),
            Paragraph(f"<b>{tlb}</b>", st["CellB"]),
            Paragraph(f"<b>{tp}</b>",  st["CellB"]),
            Paragraph(f"<b>{ts}</b>",  st["CellB"]),
        ])
        story.append(_mktable(rows, [118*mm, 13*mm, 13*mm, 13*mm, 13*mm], [
            ("ALIGN",      (1, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.90, 0.90, 0.95)),
        ]))
        story.append(Spacer(1, 4 * mm))

        # Lab topics
        lab_topics = [t for sec in sections for t in sec.get("topics", [])
                      if (t.get("topic_type") or "").lower() in ("lab", "лр", "лаб", "laboratory")]
        if lab_topics:
            story.append(Paragraph("Тематика примерных лабораторных работ", st["H2"]))
            rows = [[Paragraph("<b>№<br/>п.п.</b>", st["CellB"]),
                     Paragraph("<b>Наименование темы лабораторной работы</b>", st["CellB"])]]
            for i, t in enumerate(lab_topics, 1):
                rows.append([str(i), Paragraph(t.get("title", ""), st["Cell"])])
            story.append(_mktable(rows, [15*mm, 155*mm],
                                  [("ALIGN", (0, 0), (0, -1), "CENTER")]))
            story.append(Spacer(1, 4 * mm))

        # Practice topics
        prac_topics = [t for sec in sections for t in sec.get("topics", [])
                       if (t.get("topic_type") or "").lower() in ("practice", "пз", "практика", "seminar")]
        if prac_topics:
            story.append(Paragraph("Тематика практических занятий", st["H2"]))
            rows = [[Paragraph("<b>№<br/>п.п.</b>", st["CellB"]),
                     Paragraph("<b>Наименование темы практического занятия</b>", st["CellB"])]]
            for i, t in enumerate(prac_topics, 1):
                rows.append([str(i), Paragraph(t.get("title", ""), st["Cell"])])
            story.append(_mktable(rows, [15*mm, 155*mm],
                                  [("ALIGN", (0, 0), (0, -1), "CENTER")]))
            story.append(Spacer(1, 4 * mm))
    else:
        dash()

    # ── 5. Организационно-педагогические условия ───────────────────────────
    story.append(Paragraph("5. Организационно-педагогические условия", st["H1"]))

    story.append(Paragraph(
        "5.1. Образовательные технологии, используемые для формирования компетенций", st["H2"]))
    edu = rpd_data.get("educational_tech", "")
    if edu:
        story.append(_boxed(Paragraph(edu, st["BodyNI"])))
    else:
        dash()

    story.append(Paragraph(
        "5.2. Методические указания для обучающихся по освоению дисциплины", st["H2"]))
    meth = rpd_data.get("methodical_recommendations", "")
    if meth:
        story.append(_boxed(Paragraph(meth, st["BodyNI"])))
    else:
        dash()

    # ── 6. Учебно-методическое обеспечение ─────────────────────────────────
    story.append(Paragraph(
        "6. Перечень учебно-методического и информационного обеспечения", st["H1"]))

    literature = rpd_data.get("literature", [])
    basic = [l for l in literature if l.get("source_type") == "Основная"]
    extra = [l for l in literature if l.get("source_type") == "Дополнительная"]

    def _lit_ref(l):
        ref = " ".join(filter(None, [l.get("authors"), l.get("title")]))
        parts = [p for p in [l.get("publisher"), str(l.get("year") or "")] if p]
        if parts:
            ref += " — " + ", ".join(parts)
        return ref.rstrip(".") + "."

    story.append(Paragraph("6.1. Печатная учебно-методическая литература", st["H2"]))
    if basic:
        hdr = [Paragraph("<b>№/п.п</b>", st["CellB"]),
               Paragraph("<b>Библиографическое описание (автор, заглавие, место, издательство, год, кол-во стр.)</b>", st["CellB"]),
               Paragraph("<b>Кол-во экз. в библиотеке</b>", st["CellB"])]
        rows = [hdr]
        for i, l in enumerate(basic, 1):
            rows.append([str(i), Paragraph(_lit_ref(l), st["CellS"]),
                         str(l.get("copies_count") or "—")])
        story.append(_mktable(rows, [12*mm, 133*mm, 25*mm], [
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ]))
    else:
        story.append(Paragraph("Не используется", st["BodyNI"]))

    story.append(Paragraph("6.2. Электронная учебно-методическая литература", st["H2"]))
    if extra:
        hdr = [Paragraph("<b>Вид литературы</b>", st["CellB"]),
               Paragraph("<b>Наименование разработки</b>", st["CellB"]),
               Paragraph("<b>Ссылка на информационный ресурс</b>", st["CellB"]),
               Paragraph("<b>Доступность</b>", st["CellB"])]
        rows = [hdr]
        for l in extra:
            rows.append([
                Paragraph(l.get("source_type", ""), st["CellS"]),
                Paragraph(" ".join(filter(None, [l.get("authors"), l.get("title")])), st["CellS"]),
                Paragraph(l.get("url", "") or "—", st["CellS"]),
                "свободный доступ",
            ])
        story.append(_mktable(rows, [25*mm, 60*mm, 55*mm, 30*mm]))
    else:
        story.append(Paragraph("Не используется", st["BodyNI"]))

    story.append(Paragraph(
        "6.3. Лицензионное и свободно распространяемое программное обеспечение", st["H2"]))
    software = rpd_data.get("software", [])
    if software:
        rows = [[Paragraph("<b>Вид ПО</b>", st["CellB"]),
                 Paragraph("<b>Наименование программного обеспечения</b>", st["CellB"])]]
        for sw in software:
            rows.append([
                Paragraph(sw.get("license_type", "—") or "—", st["CellS"]),
                Paragraph(sw.get("name", ""),                  st["CellS"]),
            ])
        story.append(_mktable(rows, [50*mm, 120*mm]))
    else:
        story.append(Paragraph("Не используется", st["BodyNI"]))

    story.append(Paragraph(
        "6.4. Современные профессиональные базы данных и информационные справочные системы",
        st["H2"]))
    story.append(Paragraph("Не используется", st["BodyNI"]))

    # ── 7. МТО ──────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "7. Материально-техническое обеспечение образовательного процесса по дисциплине",
        st["H1"]))
    mt = rpd_data.get("material_tech", [])
    if mt:
        hdr = [Paragraph("<b>Вид занятий</b>", st["CellB"]),
               Paragraph("<b>Наименование необходимого основного оборудования и технических средств</b>", st["CellB"]),
               Paragraph("<b>Кол-во<br/>единиц</b>", st["CellB"])]
        rows = [hdr]
        for m in mt:
            rows.append([
                Paragraph(m.get("room_type", ""), st["CellS"]),
                Paragraph(m.get("equipment", "—") or "—", st["CellS"]),
                "—",
            ])
        story.append(_mktable(rows, [45*mm, 105*mm, 20*mm]))
    else:
        dash()

    # ── 8. ФОС ──────────────────────────────────────────────────────────────
    story.append(Paragraph("8. Фонд оценочных средств дисциплины", st["H1"]))
    story.append(_boxed(Paragraph("Описан в отдельном документе", st["BodyNI"])))

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════

def generate_rpd_pdf(rpd_data: dict) -> bytes:
    """Fill the ПНИПУ RPD template (title page) with PyMuPDF,
    generate content pages with ReportLab, merge and return PDF bytes."""

    # Content pages are always generated
    content_bytes = _generate_content_pages(rpd_data)

    if not os.path.exists(_TEMPLATE_PDF):
        # Template missing — return content-only PDF
        return content_bytes

    try:
        title_bytes = _fill_title_page(rpd_data)
    except Exception:
        return content_bytes

    # Merge
    try:
        title_doc   = fitz.open("pdf", title_bytes)
        content_doc = fitz.open("pdf", content_bytes)
        merged      = fitz.open()
        merged.insert_pdf(title_doc)
        merged.insert_pdf(content_doc)
        return merged.tobytes()
    except Exception:
        return content_bytes
