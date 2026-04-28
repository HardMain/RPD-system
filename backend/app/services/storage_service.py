"""Абстракция файлового хранилища.

Сейчас единственный backend — локальная файловая система под `settings.UPLOAD_DIR`.
В этапе 9 добавится S3/MinIO с тем же интерфейсом.

`storage_uri` — это короткая опаковая строка, которую мы пишем в БД:
- `local:<kind>/<filename>` — локальная FS;
- `s3://<bucket>/<key>`     — будущий MinIO.

Файлы группируются по подпапкам = `kind` (bup_xls, fgos, fos_main, fos_other,
context_doc). Это упрощает разбор/чистку и совпадает с подсегментацией бакета
в S3.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from app.core.config import settings


KNOWN_KINDS = {"bup_xls", "fgos", "fos_main", "fos_other", "context_doc", "other"}


def _root() -> str:
    return settings.UPLOAD_DIR


def _ensure_kind_dir(kind: str) -> str:
    if kind not in KNOWN_KINDS:
        # допускаем неизвестный kind — просто создаём свою папку
        pass
    p = os.path.join(_root(), kind)
    os.makedirs(p, exist_ok=True)
    return p


def save_bytes(kind: str, original_name: str, data: bytes) -> tuple[str, int]:
    """Сохранить байты, вернуть `(storage_uri, size_bytes)`."""
    ext = Path(original_name).suffix.lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    abs_dir = _ensure_kind_dir(kind)
    abs_path = os.path.join(abs_dir, fname)
    with open(abs_path, "wb") as f:
        f.write(data)
    return f"local:{kind}/{fname}", len(data)


def resolve_path(storage_uri: str) -> str:
    """Получить абсолютный путь по URI. Бросает FileNotFoundError, если файла нет."""
    if not storage_uri.startswith("local:"):
        raise ValueError(f"Unsupported storage_uri scheme: {storage_uri}")
    rel = storage_uri[len("local:") :]
    abs_path = os.path.join(_root(), rel)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(abs_path)
    return abs_path


def read_bytes(storage_uri: str) -> bytes:
    with open(resolve_path(storage_uri), "rb") as f:
        return f.read()


def delete(storage_uri: str) -> None:
    """Безопасно удалить файл; молча игнорирует отсутствие."""
    try:
        os.remove(resolve_path(storage_uri))
    except FileNotFoundError:
        pass
