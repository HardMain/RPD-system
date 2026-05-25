from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path

from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from lxml import etree

SIGNATURE_PLACEHOLDER = ">___________ <"
SIGNATURE_REPLACEMENT = ">{{signature}}<"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"

_JINJA_TAG_RE = re.compile(r"(\{[{%])(.*?)([%}]\})", re.DOTALL)
_XML_INSIDE_RE = re.compile(r"<[^>]+>")

def _clean_jinja_tag(match: re.Match) -> str:
    opener, inner, closer = match.group(1), match.group(2), match.group(3)
    return opener + _XML_INSIDE_RE.sub("", inner) + closer

def _repair_docx_tags(src_docx: Path, dst_docx: Path) -> None:
    with zipfile.ZipFile(src_docx, "r") as zin, zipfile.ZipFile(
        dst_docx, "w", zipfile.ZIP_DEFLATED
    ) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.endswith(".xml") and (
                item.filename.startswith("word/document")
                or item.filename.startswith("word/header")
                or item.filename.startswith("word/footer")
            ):
                xml = data.decode("utf-8")
                xml = xml.replace(SIGNATURE_PLACEHOLDER, SIGNATURE_REPLACEMENT)
                xml = _JINJA_TAG_RE.sub(_clean_jinja_tag, xml)
                data = xml.encode("utf-8")
            zout.writestr(item, data)

def _get_grid_span(tc: etree._Element) -> int:
    tcPr = tc.find(f"{W}tcPr")
    if tcPr is None:
        return 1
    gs = tcPr.find(f"{W}gridSpan")
    return int(gs.get(f"{W}val", 1)) if gs is not None else 1

def _set_grid_span(tc: etree._Element, val: int) -> None:
    tcPr = tc.find(f"{W}tcPr")
    if tcPr is None:
        tcPr = etree.SubElement(tc, f"{W}tcPr")
        tc.insert(0, tcPr)
    gs = tcPr.find(f"{W}gridSpan")
    if val <= 1:
        if gs is not None:
            tcPr.remove(gs)
        return
    if gs is None:
        gs = etree.SubElement(tcPr, f"{W}gridSpan")
    gs.set(f"{W}val", str(val))

def _set_tcw_dxa(tc: etree._Element, value: int) -> None:
    tcPr = tc.find(f"{W}tcPr")
    if tcPr is None:
        tcPr = etree.SubElement(tc, f"{W}tcPr")
        tc.insert(0, tcPr)
    tcW = tcPr.find(f"{W}tcW")
    if tcW is None:
        tcW = etree.SubElement(tcPr, f"{W}tcW")
    tcW.set(f"{W}w", str(int(value)))
    tcW.set(f"{W}type", "dxa")

def _fix_tables_in_xml(xml_bytes: bytes) -> bytes:
    tree = etree.fromstring(xml_bytes)
    changed = False

    for tbl in tree.iter(f"{W}tbl"):
        rows = tbl.findall(f"{W}tr")
        if not rows:
            continue
        tblGrid = tbl.find(f"{W}tblGrid")
        if tblGrid is None:
            continue
        grid_cols = tblGrid.findall(f"{W}gridCol")

        plain_widths = []
        merged_rows = []
        for tr in rows:
            tcs = tr.findall(f"{W}tc")
            spans = [_get_grid_span(tc) for tc in tcs]
            width = sum(spans)
            if any(s > 1 for s in spans):
                merged_rows.append((tr, tcs, width))
            else:
                plain_widths.append(width)

        if not plain_widths or not merged_rows:
            continue
        target = max(plain_widths)
        if not any(w != target for *_, w in merged_rows):
            continue

        changed = True

        for tr, tcs, width in merged_rows:
            diff = target - width
            if diff == 0:
                continue
            for tc in tcs:
                s = _get_grid_span(tc)
                if s > 1:
                    _set_grid_span(tc, max(1, s + diff))
                    break

        widest = None
        for tr in rows:
            col = 0
            for tc in tr.findall(f"{W}tc"):
                s = _get_grid_span(tc)
                if s > 1:
                    if widest is None or s > (widest[1] - widest[0]):
                        widest = (col, col + s)
                col += s

        if widest and len(grid_cols) > target:
            while len(grid_cols) > target:
                tblGrid.remove(grid_cols[-1])
                grid_cols = tblGrid.findall(f"{W}gridCol")

        if widest and len(grid_cols) >= widest[1]:
            col_start, col_end = widest
            n = col_end - col_start
            if n >= 2:
                total = sum(
                    int(grid_cols[i].get(f"{W}w", 0))
                    for i in range(col_start, col_end)
                )
                if total > 0:
                    eq = total // n
                    rem = total - eq * n
                    for i in range(col_start, col_end):
                        w = eq + (rem if i == col_start else 0)
                        grid_cols[i].set(f"{W}w", str(w))

        for tr in rows:
            col = 0
            for tc in tr.findall(f"{W}tc"):
                s = _get_grid_span(tc)
                if col + s <= len(grid_cols):
                    new_w = sum(
                        int(grid_cols[i].get(f"{W}w", 0))
                        for i in range(col, col + s)
                    )
                    _set_tcw_dxa(tc, new_w)
                col += s

    if not changed:
        return xml_bytes
    return etree.tostring(
        tree, xml_declaration=True, encoding="UTF-8", standalone=True
    )

def _fix_document_after_render(docx_path: Path) -> None:
    with zipfile.ZipFile(docx_path, "r") as z:
        xml_bytes = z.read("word/document.xml")

    new_xml = _fix_tables_in_xml(xml_bytes)
    if new_xml == xml_bytes:
        return

    tmp = docx_path.with_suffix(docx_path.suffix + ".tmp")
    with zipfile.ZipFile(docx_path, "r") as zin, zipfile.ZipFile(
        tmp, "w", zipfile.ZIP_DEFLATED
    ) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                data = new_xml
            zout.writestr(item, data)
    shutil.move(str(tmp), str(docx_path))

def fill_docx_template(
    template_path: Path,
    context: dict,
    output_docx_path: Path,
    signature_bytes: bytes | None = None,
) -> Path:
    template_path = Path(template_path)
    output_docx_path = Path(output_docx_path)
    if not template_path.exists():
        raise FileNotFoundError(f"Шаблон не найден: {template_path}")

    output_docx_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        suffix=".docx", delete=False, dir=output_docx_path.parent
    ) as tmp:
        repaired_path = Path(tmp.name)
    try:
        _repair_docx_tags(template_path, repaired_path)

        doc = DocxTemplate(str(repaired_path))
        ctx = dict(context)
        if signature_bytes:
            ctx["signature"] = InlineImage(doc, BytesIO(signature_bytes), width=Mm(35))
        else:
            ctx["signature"] = "___________"
        doc.render(ctx)
        doc.save(str(output_docx_path))

        _fix_document_after_render(output_docx_path)
    finally:
        if repaired_path.exists():
            repaired_path.unlink()

    return output_docx_path

def _find_soffice() -> str | None:
    for name in ("libreoffice", "soffice", "soffice.exe"):
        path = shutil.which(name)
        if path:
            return path
    win_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in win_paths:
        if os.path.exists(p):
            return p
    return None

def convert_docx_to_pdf(
    docx_path: Path,
    output_pdf_path: Path,
    timeout: int = 120,
) -> Path:
    docx_path = Path(docx_path)
    output_pdf_path = Path(output_pdf_path)
    if not docx_path.exists():
        raise FileNotFoundError(f"DOCX не найден: {docx_path}")

    soffice_bin = _find_soffice()
    if soffice_bin is None:
        raise RuntimeError(
            "LibreOffice не найден в PATH. "
            "Установите: apt install libreoffice --no-install-recommends"
        )

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        user_profile = tmp / "lo_profile"
        result = subprocess.run(
            [
                soffice_bin, "--headless",
                f"-env:UserInstallation=file://{user_profile.as_posix()}",
                "--convert-to", "pdf",
                "--outdir", str(tmp),
                str(docx_path),
            ],
            capture_output=True, text=True, timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(
                "LibreOffice упал при конвертации.\n"
                f"stdout: {result.stdout}\nstderr: {result.stderr}"
            )

        produced = tmp / (docx_path.stem + ".pdf")
        if not produced.exists():
            raise RuntimeError(
                f"LibreOffice не создал PDF. Содержимое {tmp}: "
                f"{list(tmp.iterdir())}"
            )

        shutil.move(str(produced), str(output_pdf_path))

    return output_pdf_path

def render_rpd_pdf(
    template_path: Path,
    context: dict,
    output_pdf_path: Path,
    keep_docx: bool = False,
    signature_bytes: bytes | None = None,
) -> Path:
    output_pdf_path = Path(output_pdf_path)
    docx_path = output_pdf_path.with_suffix(".docx")

    fill_docx_template(template_path, context, docx_path, signature_bytes=signature_bytes)
    try:
        convert_docx_to_pdf(docx_path, output_pdf_path)
    finally:
        if not keep_docx and docx_path.exists():
            docx_path.unlink()

    return output_pdf_path

def render_rpd_pdf_bytes(template_path: Path, context: dict, signature_bytes: bytes | None = None) -> bytes:
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "rpd.pdf"
        render_rpd_pdf(Path(template_path), context, out, keep_docx=False, signature_bytes=signature_bytes)
        return out.read_bytes()
