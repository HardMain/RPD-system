"""PDF export service for RPD documents using reportlab."""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import os


def _register_fonts():
    """Register fonts - try DejaVu (common on Linux), fallback to built-in."""
    font_paths = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold"),
    ]
    registered = False
    for path, name in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                registered = True
            except Exception:
                pass
    return registered


_HAS_CYRILLIC = _register_fonts()
_FONT = "DejaVuSans" if _HAS_CYRILLIC else "Helvetica"
_FONT_BOLD = "DejaVuSans-Bold" if _HAS_CYRILLIC else "Helvetica-Bold"


def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "RpdTitle", fontName=_FONT_BOLD, fontSize=14,
        alignment=TA_CENTER, spaceAfter=6*mm,
    ))
    styles.add(ParagraphStyle(
        "RpdHeading", fontName=_FONT_BOLD, fontSize=12,
        spaceBefore=6*mm, spaceAfter=3*mm,
    ))
    styles.add(ParagraphStyle(
        "RpdBody", fontName=_FONT, fontSize=10,
        alignment=TA_JUSTIFY, spaceAfter=2*mm, leading=14,
    ))
    styles.add(ParagraphStyle(
        "RpdSmall", fontName=_FONT, fontSize=9,
        alignment=TA_LEFT, spaceAfter=1*mm, leading=12,
    ))
    return styles


def generate_rpd_pdf(rpd_data: dict) -> bytes:
    """Generate a PDF document for an RPD.
    
    rpd_data should be a dict matching RpdDetailOut schema.
    Returns PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=1.5*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = _get_styles()
    story = []

    # ── Title page ──
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ", styles["RpdSmall"]))
    story.append(Paragraph("ПЕРМСКИЙ НАЦИОНАЛЬНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ ПОЛИТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ", styles["RpdSmall"]))
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("РАБОЧАЯ ПРОГРАММА ДИСЦИПЛИНЫ", styles["RpdTitle"]))
    story.append(Spacer(1, 1*cm))

    disc_name = rpd_data.get("discipline_name", "")
    story.append(Paragraph(f"<b>{disc_name}</b>", styles["RpdTitle"]))
    story.append(Spacer(1, 1*cm))

    info_lines = [
        f"Направление подготовки: {rpd_data.get('direction_code', '')} {rpd_data.get('direction_name', '')}",
        f"Профиль: {rpd_data.get('direction_profile', '')}",
        f"Учебный год: {rpd_data.get('academic_year', '')}",
        f"Семестр: {rpd_data.get('semester', '')}",
        f"Форма контроля: {rpd_data.get('control_form', '')}",
    ]
    for line in info_lines:
        story.append(Paragraph(line, styles["RpdBody"]))

    story.append(PageBreak())

    # ── Section 1: Goals ──
    story.append(Paragraph("1. ЦЕЛИ И ЗАДАЧИ ДИСЦИПЛИНЫ", styles["RpdHeading"]))
    if rpd_data.get("goals_text"):
        for para in rpd_data["goals_text"].split("\n"):
            if para.strip():
                story.append(Paragraph(para.strip(), styles["RpdBody"]))
    if rpd_data.get("tasks_text"):
        story.append(Paragraph("<b>Задачи дисциплины:</b>", styles["RpdBody"]))
        for para in rpd_data["tasks_text"].split("\n"):
            if para.strip():
                story.append(Paragraph(para.strip(), styles["RpdBody"]))

    # ── Section 2: Objects ──
    story.append(Paragraph("2. ИЗУЧАЕМЫЕ ОБЪЕКТЫ ДИСЦИПЛИНЫ", styles["RpdHeading"]))
    if rpd_data.get("objects_text"):
        story.append(Paragraph(rpd_data["objects_text"], styles["RpdBody"]))

    # ── Section 3: Requirements ──
    story.append(Paragraph("3. ВХОДНЫЕ ТРЕБОВАНИЯ", styles["RpdHeading"]))
    if rpd_data.get("requirements_text"):
        story.append(Paragraph(rpd_data["requirements_text"], styles["RpdBody"]))

    # ── Section 4: Content table ──
    story.append(Paragraph("4. СОДЕРЖАНИЕ ДИСЦИПЛИНЫ", styles["RpdHeading"]))
    sections = rpd_data.get("sections", [])
    if sections:
        # Hours distribution table
        table_data = [["№", "Раздел", "Лек", "Пр", "Лаб", "СРС", "Итого"]]
        total_lec = total_pr = total_lab = total_srs = 0
        for s in sections:
            lec = s.get("lecture_hours", 0) or 0
            pr = s.get("practice_hours", 0) or 0
            lab = s.get("lab_hours", 0) or 0
            srs = s.get("self_study_hours", 0) or 0
            row_total = lec + pr + lab + srs
            table_data.append([
                str(s.get("section_number", "")),
                Paragraph(s.get("title", ""), styles["RpdSmall"]),
                str(lec), str(pr), str(lab), str(srs), str(row_total),
            ])
            total_lec += lec
            total_pr += pr
            total_lab += lab
            total_srs += srs
        table_data.append(["", Paragraph("<b>Итого</b>", styles["RpdSmall"]),
                           str(total_lec), str(total_pr), str(total_lab), str(total_srs),
                           str(total_lec + total_pr + total_lab + total_srs)])

        col_widths = [12*mm, 70*mm, 14*mm, 14*mm, 14*mm, 14*mm, 16*mm]
        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.85, 0.85, 0.9)),
            ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 1), (-1, -1), _FONT),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ]))
        story.append(t)
        story.append(Spacer(1, 4*mm))

        # Section descriptions
        for s in sections:
            if s.get("brief_content"):
                story.append(Paragraph(
                    f"<b>Раздел {s.get('section_number', '')}. {s.get('title', '')}</b>",
                    styles["RpdBody"]
                ))
                story.append(Paragraph(s["brief_content"], styles["RpdBody"]))

    # ── Section 5: Edu tech ──
    story.append(Paragraph("5. ОБРАЗОВАТЕЛЬНЫЕ ТЕХНОЛОГИИ", styles["RpdHeading"]))
    if rpd_data.get("educational_tech"):
        story.append(Paragraph(rpd_data["educational_tech"], styles["RpdBody"]))

    # ── Section 6: Methodical ──
    story.append(Paragraph("6. МЕТОДИЧЕСКИЕ РЕКОМЕНДАЦИИ", styles["RpdHeading"]))
    if rpd_data.get("methodical_recommendations"):
        story.append(Paragraph(rpd_data["methodical_recommendations"], styles["RpdBody"]))

    # ── Section 7: Literature ──
    story.append(Paragraph("7. УЧЕБНО-МЕТОДИЧЕСКОЕ ОБЕСПЕЧЕНИЕ", styles["RpdHeading"]))
    literature = rpd_data.get("literature", [])
    if literature:
        basic = [l for l in literature if l.get("source_type") == "Основная"]
        extra = [l for l in literature if l.get("source_type") == "Дополнительная"]
        if basic:
            story.append(Paragraph("<b>Основная литература:</b>", styles["RpdBody"]))
            for i, l in enumerate(basic, 1):
                line = f"{i}. {l.get('authors', '')} {l.get('title', '')} — {l.get('publisher', '')}, {l.get('year', '')}."
                story.append(Paragraph(line, styles["RpdBody"]))
        if extra:
            story.append(Paragraph("<b>Дополнительная литература:</b>", styles["RpdBody"]))
            for i, l in enumerate(extra, 1):
                line = f"{i}. {l.get('authors', '')} {l.get('title', '')} — {l.get('publisher', '')}, {l.get('year', '')}."
                story.append(Paragraph(line, styles["RpdBody"]))

    # ── Section 8: Software ──
    software = rpd_data.get("software", [])
    if software:
        story.append(Paragraph("8. ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ", styles["RpdHeading"]))
        for sw in software:
            line = f"• {sw.get('name', '')}"
            if sw.get("license_type"):
                line += f" ({sw['license_type']})"
            story.append(Paragraph(line, styles["RpdBody"]))

    # ── Section 9: Material-tech ──
    mt = rpd_data.get("material_tech", [])
    if mt:
        story.append(Paragraph("9. МАТЕРИАЛЬНО-ТЕХНИЧЕСКОЕ ОБЕСПЕЧЕНИЕ", styles["RpdHeading"]))
        for m in mt:
            story.append(Paragraph(f"<b>{m.get('room_type', '')}</b>", styles["RpdBody"]))
            if m.get("equipment"):
                story.append(Paragraph(m["equipment"], styles["RpdBody"]))

    # Build PDF
    doc.build(story)
    return buf.getvalue()
