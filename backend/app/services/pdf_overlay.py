from io import BytesIO

import fitz


MM_TO_PT = 72.0 / 25.4


def overlay_signature(
    pdf_bytes: bytes,
    signature_png_bytes: bytes,
    x_frac: float,
    y_frac: float,
    width_mm: float,
    height_mm: float,
    page_index: int = 0,
) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if page_index >= doc.page_count:
            return pdf_bytes
        page = doc[page_index]
        page_w = page.rect.width
        page_h = page.rect.height

        width_pt = width_mm * MM_TO_PT
        height_pt = height_mm * MM_TO_PT

        x0 = max(0.0, min(page_w - width_pt, x_frac * page_w))
        y0 = max(0.0, min(page_h - height_pt, y_frac * page_h))
        rect = fitz.Rect(x0, y0, x0 + width_pt, y0 + height_pt)

        page.insert_image(rect, stream=signature_png_bytes, overlay=True, keep_proportion=False)

        out = BytesIO()
        doc.save(out, garbage=4, deflate=True)
        return out.getvalue()
    finally:
        doc.close()


def render_first_page_png(pdf_bytes: bytes, dpi: int = 110) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("Пустой PDF")
        page = doc[0]
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


def get_page_size_pt(pdf_bytes: bytes, page_index: int = 0) -> tuple[float, float]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if page_index >= doc.page_count:
            return 0.0, 0.0
        page = doc[page_index]
        return page.rect.width, page.rect.height
    finally:
        doc.close()
