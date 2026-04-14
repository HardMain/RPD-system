"""PDF export service for RPD documents using reportlab."""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable,
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import os

# ── Usable page width: A4 210mm - 25mm left - 15mm right = 170mm ──────────
_PW = 170 * mm


def _register_fonts():
    font_paths = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold"),
    ]
    for path, name in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
            except Exception:
                pass
    return os.path.exists("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


_HAS_CYRILLIC = _register_fonts()
_F = "DejaVuSans" if _HAS_CYRILLIC else "Helvetica"
_FB = "DejaVuSans-Bold" if _HAS_CYRILLIC else "Helvetica-Bold"

_HDR_BG = colors.Color(0.82, 0.86, 0.93)
_ROW_ALT = colors.Color(0.96, 0.96, 0.98)
_BORDER = colors.Color(0.55, 0.55, 0.55)


def _styles():
    s = getSampleStyleSheet()
    add = s.add

    add(ParagraphStyle("Univ",   fontName=_F,  fontSize=10, alignment=TA_CENTER, leading=15, spaceAfter=1*mm))
    add(ParagraphStyle("H1",     fontName=_FB, fontSize=12, alignment=TA_CENTER, spaceBefore=8*mm, spaceAfter=4*mm))
    add(ParagraphStyle("H2",     fontName=_FB, fontSize=11, spaceBefore=5*mm, spaceAfter=2*mm))
    add(ParagraphStyle("Body",   fontName=_F,  fontSize=10, alignment=TA_JUSTIFY, leading=14, spaceAfter=2*mm))
    add(ParagraphStyle("Cell",   fontName=_F,  fontSize=9,  leading=12))
    add(ParagraphStyle("CellB",  fontName=_FB, fontSize=9,  leading=12))
    add(ParagraphStyle("TMain",  fontName=_FB, fontSize=16, alignment=TA_CENTER, spaceBefore=12*mm, spaceAfter=5*mm))
    add(ParagraphStyle("TDisc",  fontName=_FB, fontSize=14, alignment=TA_CENTER, spaceAfter=8*mm))
    add(ParagraphStyle("TInfo",  fontName=_F,  fontSize=11, leading=17, spaceAfter=0))
    add(ParagraphStyle("TInfoB", fontName=_FB, fontSize=11, leading=17, spaceAfter=0))
    add(ParagraphStyle("TFoot",  fontName=_F,  fontSize=11, alignment=TA_CENTER, spaceBefore=15*mm))

    return s


def _h1(s, num, title):
    return Paragraph(f"{num}.&nbsp;{title}", s["H1"])


def _h2(s, num, title):
    return Paragraph(f"<b>{num}&nbsp;{title}</b>", s["H2"])


def _tbl_style(extra=None):
    base = [
        ("BACKGROUND",  (0, 0), (-1, 0),  _HDR_BG),
        ("GRID",        (0, 0), (-1, -1), 0.4, _BORDER),
        ("FONTNAME",    (0, 0), (-1, -1), _F),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",  (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    if extra:
        base.extend(extra)
    return TableStyle(base)


def _dash(s, styles):
    s.append(Paragraph("—", styles["Body"]))


def _text_block(story, text, styles):
    if not text:
        return False
    for line in text.split("\n"):
        if line.strip():
            story.append(Paragraph(line.strip(), styles["Body"]))
    return True


# ────────────────────────────────────────────────────────────────────────────

def generate_rpd_pdf(rpd_data: dict) -> bytes:
    """Generate a PDF document for an RPD.

    rpd_data must match the dict built in routers/export.py.
    Returns PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=25*mm, rightMargin=15*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )
    st = _styles()
    story = []

    # ── ТИТУЛЬНАЯ СТРАНИЦА ───────────────────────────────────────────────────
    story.append(Paragraph(
        "МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РОССИЙСКОЙ ФЕДЕРАЦИИ",
        st["Univ"],
    ))
    story.append(Paragraph(
        "ПЕРМСКИЙ НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ ПОЛИТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ",
        st["Univ"],
    ))
    story.append(Spacer(1, 2*mm))
    story.append(HRFlowable(width=_PW, thickness=1, color=colors.black))
    story.append(Paragraph("РАБОЧАЯ ПРОГРАММА ДИСЦИПЛИНЫ", st["TMain"]))

    disc_name = rpd_data.get("discipline_name", "")
    story.append(Paragraph(disc_name, st["TDisc"]))

    # Инфо-таблица на титульном листе
    def _kv(key, val):
        return [Paragraph(key, st["TInfoB"]), Paragraph(str(val or "—"), st["TInfo"])]

    year = rpd_data.get("academic_year", "")
    dir_str = f"{rpd_data.get('direction_code', '')} {rpd_data.get('direction_name', '')}".strip()
    info_rows = [
        _kv("Направление подготовки:", dir_str),
        _kv("Профиль:", rpd_data.get("direction_profile") or "—"),
        _kv("Квалификация (степень) выпускника:", rpd_data.get("degree_level") or "бакалавр"),
        _kv("Учебный год:", year),
        _kv("Семестр:", rpd_data.get("semester") or "—"),
        _kv("Форма итогового контроля:", rpd_data.get("control_form") or "—"),
        _kv("Общая трудоёмкость:", f"{rpd_data.get('total_hours') or '—'} ч."),
    ]
    info_tbl = Table(info_rows, colWidths=[70*mm, 100*mm])
    info_tbl.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 11),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (0, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3*mm),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 8*mm))

    devs = rpd_data.get("developers", [])
    if devs:
        dev_names = ", ".join(d.get("full_name", "") for d in devs)
        story.append(Paragraph(f"<b>Составитель(и):</b>&nbsp;{dev_names}", st["Body"]))

    story.append(Paragraph(f"Пермь,&nbsp;{year[:4] if year else ''}", st["TFoot"]))
    story.append(PageBreak())

    # ── 1. ЦЕЛИ И ЗАДАЧИ ДИСЦИПЛИНЫ ─────────────────────────────────────────
    story.append(_h1(st, "1", "ЦЕЛИ И ЗАДАЧИ ДИСЦИПЛИНЫ"))

    story.append(_h2(st, "1.1.", "Цели освоения дисциплины"))
    if not _text_block(story, rpd_data.get("goals_text"), st):
        _dash(story, st)

    story.append(_h2(st, "1.2.", "Задачи дисциплины"))
    if not _text_block(story, rpd_data.get("tasks_text"), st):
        _dash(story, st)

    story.append(_h2(st, "1.3.", "Объекты изучения дисциплины"))
    if not _text_block(story, rpd_data.get("objects_text"), st):
        _dash(story, st)

    # ── 2. МЕСТО ДИСЦИПЛИНЫ В СТРУКТУРЕ ОП ──────────────────────────────────
    story.append(_h1(st, "2", "МЕСТО ДИСЦИПЛИНЫ В СТРУКТУРЕ ОБРАЗОВАТЕЛЬНОЙ ПРОГРАММЫ"))
    if not _text_block(story, rpd_data.get("requirements_text"), st):
        _dash(story, st)

    # ── 3. ПЛАНИРУЕМЫЕ РЕЗУЛЬТАТЫ ОБУЧЕНИЯ ──────────────────────────────────
    story.append(_h1(st, "3", "ПЛАНИРУЕМЫЕ РЕЗУЛЬТАТЫ ОБУЧЕНИЯ"))
    outcomes = rpd_data.get("learning_outcomes", [])
    if outcomes:
        hdr = [
            Paragraph("<b>Код<br/>компет.</b>", st["CellB"]),
            Paragraph("<b>Наименование компетенции</b>", st["CellB"]),
            Paragraph("<b>Код<br/>индик.</b>", st["CellB"]),
            Paragraph("<b>Индикатор / результат обучения</b>", st["CellB"]),
            Paragraph("<b>Средства<br/>оценки</b>", st["CellB"]),
        ]
        rows = [hdr]
        for o in outcomes:
            ind_text = o.get("indicator_description", "")
            if o.get("outcome_text"):
                ind_text += f"\n{o['outcome_text']}"
            rows.append([
                Paragraph(o.get("competency_code", ""), st["Cell"]),
                Paragraph(o.get("competency_name", ""), st["Cell"]),
                Paragraph(o.get("indicator_code", ""), st["Cell"]),
                Paragraph(ind_text, st["Cell"]),
                Paragraph(o.get("assessment_tool", "") or "—", st["Cell"]),
            ])
        t = Table(rows, colWidths=[18*mm, 45*mm, 18*mm, 60*mm, 29*mm], repeatRows=1)
        t.setStyle(_tbl_style([("ALIGN", (0, 0), (0, -1), "CENTER"),
                                ("ALIGN", (2, 0), (2, -1), "CENTER")]))
        story.append(t)
    else:
        _dash(story, st)

    # ── 4. ОБЪЁМ ДИСЦИПЛИНЫ И ВИДЫ УЧЕБНОЙ РАБОТЫ ───────────────────────────
    story.append(_h1(st, "4", "ОБЪЁМ ДИСЦИПЛИНЫ И ВИДЫ УЧЕБНОЙ РАБОТЫ"))

    lec  = rpd_data.get("lecture_hours")  or 0
    pr   = rpd_data.get("practice_hours") or 0
    lab  = rpd_data.get("lab_hours")      or 0
    srs  = rpd_data.get("self_study_hours") or 0
    tot  = rpd_data.get("total_hours")    or (lec + pr + lab + srs)

    hours_rows = [
        [Paragraph("<b>Вид учебной работы</b>", st["CellB"]),
         Paragraph("<b>Трудоёмкость, ч</b>",   st["CellB"])],
        ["Лекции (Л)",                           str(lec)],
        ["Практические занятия (ПЗ)",            str(pr)],
        ["Лабораторные работы (ЛР)",             str(lab)],
        ["Самостоятельная работа студентов (СРС)", str(srs)],
        [Paragraph("<b>Итого</b>", st["CellB"]), Paragraph(f"<b>{tot}</b>", st["CellB"])],
        ["Форма итогового контроля", rpd_data.get("control_form") or "—"],
        ["Семестр",                  str(rpd_data.get("semester") or "—")],
    ]
    ht = Table(hours_rows, colWidths=[130*mm, 40*mm])
    ht.setStyle(_tbl_style([
        ("ALIGN",      (1, 1), (1, -1), "CENTER"),
        ("BACKGROUND", (0, 5), (-1, 5), colors.Color(0.90, 0.90, 0.95)),
        ("BACKGROUND", (0, 6), (-1, 7), colors.Color(0.96, 0.96, 0.98)),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4*mm))

    # ── 5. СОДЕРЖАНИЕ ДИСЦИПЛИНЫ ─────────────────────────────────────────────
    story.append(_h1(st, "5", "СОДЕРЖАНИЕ ДИСЦИПЛИНЫ"))
    sections = rpd_data.get("sections", [])

    # 5.1 Тематический план
    story.append(_h2(st, "5.1.", "Тематический план"))
    if sections:
        th = [
            Paragraph("<b>№</b>",     st["CellB"]),
            Paragraph("<b>Наименование раздела / темы</b>", st["CellB"]),
            Paragraph("<b>Л</b>",     st["CellB"]),
            Paragraph("<b>ПЗ</b>",    st["CellB"]),
            Paragraph("<b>ЛР</b>",    st["CellB"]),
            Paragraph("<b>СРС</b>",   st["CellB"]),
            Paragraph("<b>Итого</b>", st["CellB"]),
        ]
        rows = [th]
        tl = tp = tlb = ts = 0
        for sec in sections:
            sl  = sec.get("lecture_hours")   or 0
            sp  = sec.get("practice_hours")  or 0
            slb = sec.get("lab_hours")       or 0
            ss  = sec.get("self_study_hours") or 0
            rows.append([
                str(sec.get("section_number", "")),
                Paragraph(sec.get("title", ""), st["Cell"]),
                str(sl), str(sp), str(slb), str(ss),
                str(sl + sp + slb + ss),
            ])
            tl += sl; tp += sp; tlb += slb; ts += ss
        rows.append([
            "",
            Paragraph("<b>Итого</b>", st["CellB"]),
            Paragraph(f"<b>{tl}</b>",  st["CellB"]),
            Paragraph(f"<b>{tp}</b>",  st["CellB"]),
            Paragraph(f"<b>{tlb}</b>", st["CellB"]),
            Paragraph(f"<b>{ts}</b>",  st["CellB"]),
            Paragraph(f"<b>{tl+tp+tlb+ts}</b>", st["CellB"]),
        ])
        t = Table(rows, colWidths=[10*mm, 90*mm, 14*mm, 14*mm, 14*mm, 14*mm, 14*mm],
                  repeatRows=1)
        t.setStyle(_tbl_style([
            ("ALIGN",      (0, 0), (0, -1),  "CENTER"),
            ("ALIGN",      (2, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.90, 0.90, 0.95)),
        ]))
        story.append(t)
        story.append(Spacer(1, 4*mm))
    else:
        _dash(story, st)

    # 5.2 Содержание разделов
    story.append(_h2(st, "5.2.", "Содержание разделов и тем"))
    if sections:
        for sec in sections:
            story.append(Paragraph(
                f"<b>Раздел {sec.get('section_number', '')}.&nbsp;{sec.get('title', '')}</b>",
                st["Body"],
            ))
            if sec.get("brief_content"):
                story.append(Paragraph(sec["brief_content"], st["Body"]))
            else:
                _dash(story, st)
    else:
        _dash(story, st)

    # 5.3 / 5.4 Темы практических и лабораторных занятий
    practice_topics = []
    lab_topics = []
    for sec in sections:
        for t in sec.get("topics", []):
            tt = (t.get("topic_type") or "").lower()
            if tt in ("practice", "пз", "практика"):
                practice_topics.append(t)
            elif tt in ("lab", "лр", "лаборатор"):
                lab_topics.append(t)

    if practice_topics:
        story.append(_h2(st, "5.3.", "Темы практических занятий"))
        rows = [[Paragraph("<b>№</b>", st["CellB"]),
                 Paragraph("<b>Тема занятия</b>", st["CellB"]),
                 Paragraph("<b>Часов</b>", st["CellB"])]]
        for i, t in enumerate(practice_topics, 1):
            rows.append([str(i), Paragraph(t.get("title", ""), st["Cell"]),
                         str(t.get("hours", "—") or "—")])
        tbl = Table(rows, colWidths=[10*mm, 140*mm, 20*mm], repeatRows=1)
        tbl.setStyle(_tbl_style([("ALIGN", (0, 0), (0, -1), "CENTER"),
                                  ("ALIGN", (2, 0), (2, -1), "CENTER")]))
        story.append(tbl)
        story.append(Spacer(1, 3*mm))

    if lab_topics:
        story.append(_h2(st, "5.4.", "Темы лабораторных работ"))
        rows = [[Paragraph("<b>№</b>", st["CellB"]),
                 Paragraph("<b>Тема лабораторной работы</b>", st["CellB"]),
                 Paragraph("<b>Часов</b>", st["CellB"])]]
        for i, t in enumerate(lab_topics, 1):
            rows.append([str(i), Paragraph(t.get("title", ""), st["Cell"]),
                         str(t.get("hours", "—") or "—")])
        tbl = Table(rows, colWidths=[10*mm, 140*mm, 20*mm], repeatRows=1)
        tbl.setStyle(_tbl_style([("ALIGN", (0, 0), (0, -1), "CENTER"),
                                  ("ALIGN", (2, 0), (2, -1), "CENTER")]))
        story.append(tbl)
        story.append(Spacer(1, 3*mm))

    # ── 6. ОБРАЗОВАТЕЛЬНЫЕ ТЕХНОЛОГИИ ───────────────────────────────────────
    story.append(_h1(st, "6", "ОБРАЗОВАТЕЛЬНЫЕ ТЕХНОЛОГИИ"))
    if not _text_block(story, rpd_data.get("educational_tech"), st):
        _dash(story, st)

    # ── 7. МЕТОДИЧЕСКИЕ РЕКОМЕНДАЦИИ ────────────────────────────────────────
    story.append(_h1(st, "7", "МЕТОДИЧЕСКИЕ РЕКОМЕНДАЦИИ"))
    if not _text_block(story, rpd_data.get("methodical_recommendations"), st):
        _dash(story, st)

    # ── 8. УЧЕБНО-МЕТОДИЧЕСКОЕ И ИНФОРМАЦИОННОЕ ОБЕСПЕЧЕНИЕ ─────────────────
    story.append(_h1(st, "8", "УЧЕБНО-МЕТОДИЧЕСКОЕ И ИНФОРМАЦИОННОЕ ОБЕСПЕЧЕНИЕ"))

    literature = rpd_data.get("literature", [])
    basic = [l for l in literature if l.get("source_type") == "Основная"]
    extra = [l for l in literature if l.get("source_type") == "Дополнительная"]

    def _lit_table(items):
        rows = [[Paragraph("<b>№</b>", st["CellB"]),
                 Paragraph("<b>Библиографическое описание</b>", st["CellB"]),
                 Paragraph("<b>Кол-во<br/>экз.</b>", st["CellB"])]]
        for i, l in enumerate(items, 1):
            ref = " ".join(filter(None, [l.get("authors"), l.get("title")]))
            parts = [p for p in [l.get("publisher"), str(l.get("year") or "")] if p]
            if parts:
                ref += " — " + ", ".join(parts)
            rows.append([
                str(i),
                Paragraph(ref.strip(".") + ".", st["Cell"]),
                str(l.get("copies_count") or "—"),
            ])
        t = Table(rows, colWidths=[10*mm, 140*mm, 20*mm], repeatRows=1)
        t.setStyle(_tbl_style([("ALIGN", (0, 0), (0, -1), "CENTER"),
                                ("ALIGN", (2, 0), (2, -1), "CENTER")]))
        return t

    story.append(_h2(st, "8.1.", "Основная литература"))
    if basic:
        story.append(_lit_table(basic))
    else:
        _dash(story, st)

    story.append(_h2(st, "8.2.", "Дополнительная литература"))
    if extra:
        story.append(_lit_table(extra))
    else:
        _dash(story, st)

    software = rpd_data.get("software", [])
    if software:
        story.append(_h2(st, "8.3.", "Программное обеспечение"))
        rows = [[Paragraph("<b>№</b>", st["CellB"]),
                 Paragraph("<b>Наименование программного продукта</b>", st["CellB"]),
                 Paragraph("<b>Вид лицензии</b>", st["CellB"])]]
        for i, sw in enumerate(software, 1):
            rows.append([
                str(i),
                Paragraph(sw.get("name", ""), st["Cell"]),
                Paragraph(sw.get("license_type", "—") or "—", st["Cell"]),
            ])
        swt = Table(rows, colWidths=[10*mm, 120*mm, 40*mm], repeatRows=1)
        swt.setStyle(_tbl_style([("ALIGN", (0, 0), (0, -1), "CENTER")]))
        story.append(swt)

    # ── 9. МАТЕРИАЛЬНО-ТЕХНИЧЕСКОЕ ОБЕСПЕЧЕНИЕ ──────────────────────────────
    mt = rpd_data.get("material_tech", [])
    if mt:
        story.append(_h1(st, "9", "МАТЕРИАЛЬНО-ТЕХНИЧЕСКОЕ ОБЕСПЕЧЕНИЕ ДИСЦИПЛИНЫ"))
        rows = [[Paragraph("<b>Тип учебного помещения</b>", st["CellB"]),
                 Paragraph("<b>Оснащение / оборудование</b>", st["CellB"])]]
        for m in mt:
            rows.append([
                Paragraph(m.get("room_type", ""), st["Cell"]),
                Paragraph(m.get("equipment", "—") or "—", st["Cell"]),
            ])
        mtt = Table(rows, colWidths=[70*mm, 100*mm], repeatRows=1)
        mtt.setStyle(_tbl_style())
        story.append(mtt)

    doc.build(story)
    return buf.getvalue()
