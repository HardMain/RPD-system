"""Абстракция файлового хранилища.

Поддерживает два бэкенда:
- `local` — локальная файловая система под `settings.UPLOAD_DIR` (старые
  загрузки и режим без MinIO);
- `s3`   — MinIO / любой S3-совместимый сервис.

Выбор активного бэкенда для НОВЫХ загрузок — `settings.STORAGE_BACKEND`.
Чтение/удаление работает по схеме URI:
- `local:<kind>/<filename>` — локальная FS;
- `s3://<bucket>/<key>`     — S3/MinIO;
поэтому старые файлы продолжают читаться и после переключения бэкенда.

URI пишется в БД (`StoredFile.storage_uri`), позже его получает любой роутер,
который хочет отдать файл, и не должен знать, где он физически.
"""
from __future__ import annotations

import io
import os
import uuid
from pathlib import Path
from typing import Iterator

from fastapi.responses import StreamingResponse, FileResponse
from urllib.parse import quote

from app.core.config import settings


KNOWN_KINDS = {
    "bup_xls", "fgos", "fos_main", "fos_other", "context_doc", "other",
}


# ─── Local backend ─────────────────────────────────────────────────────────


def _local_root() -> str:
    return settings.UPLOAD_DIR


def _local_dir(kind: str) -> str:
    p = os.path.join(_local_root(), kind)
    os.makedirs(p, exist_ok=True)
    return p


def _local_save(kind: str, original_name: str, data: bytes) -> tuple[str, int]:
    ext = Path(original_name).suffix.lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(_local_dir(kind), fname)
    with open(abs_path, "wb") as f:
        f.write(data)
    return f"local:{kind}/{fname}", len(data)


def _local_resolve(uri: str) -> str:
    rel = uri[len("local:"):]
    abs_path = os.path.join(_local_root(), rel)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(abs_path)
    return abs_path


def _local_read(uri: str) -> bytes:
    with open(_local_resolve(uri), "rb") as f:
        return f.read()


def _local_delete(uri: str) -> None:
    try:
        os.remove(_local_resolve(uri))
    except FileNotFoundError:
        pass


# ─── S3 / MinIO backend ────────────────────────────────────────────────────


_minio_client_instance = None
_bucket_ready = False


def _minio_client():
    global _minio_client_instance
    if _minio_client_instance is None:
        from minio import Minio  # ленивый импорт, чтобы local-режим не требовал пакета
        _minio_client_instance = Minio(
            settings.S3_ENDPOINT,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            secure=settings.S3_USE_SSL,
            region=settings.S3_REGION,
        )
    return _minio_client_instance


def _ensure_bucket():
    global _bucket_ready
    if _bucket_ready:
        return
    cli = _minio_client()
    bucket = settings.S3_BUCKET
    if not cli.bucket_exists(bucket):
        cli.make_bucket(bucket)
    _bucket_ready = True


def _s3_save(kind: str, original_name: str, data: bytes) -> tuple[str, int]:
    _ensure_bucket()
    cli = _minio_client()
    ext = Path(original_name).suffix.lower()
    key = f"{kind}/{uuid.uuid4().hex}{ext}"
    cli.put_object(
        settings.S3_BUCKET, key, io.BytesIO(data), length=len(data),
    )
    return f"s3://{settings.S3_BUCKET}/{key}", len(data)


def _s3_split(uri: str) -> tuple[str, str]:
    rest = uri[len("s3://"):]
    bucket, _, key = rest.partition("/")
    if not bucket or not key:
        raise ValueError(f"Bad S3 URI: {uri}")
    return bucket, key


def _s3_read(uri: str) -> bytes:
    bucket, key = _s3_split(uri)
    cli = _minio_client()
    resp = cli.get_object(bucket, key)
    try:
        return resp.read()
    finally:
        resp.close(); resp.release_conn()


def _s3_stream(uri: str) -> Iterator[bytes]:
    bucket, key = _s3_split(uri)
    cli = _minio_client()
    resp = cli.get_object(bucket, key)
    try:
        for chunk in resp.stream(64 * 1024):
            yield chunk
    finally:
        resp.close(); resp.release_conn()


def _s3_delete(uri: str) -> None:
    bucket, key = _s3_split(uri)
    try:
        _minio_client().remove_object(bucket, key)
    except Exception:
        pass


# ─── Public API ────────────────────────────────────────────────────────────


def save_bytes(kind: str, original_name: str, data: bytes) -> tuple[str, int]:
    """Сохранить новый файл в активном бэкенде, вернуть `(storage_uri, size)`."""
    if settings.STORAGE_BACKEND == "s3":
        return _s3_save(kind, original_name, data)
    return _local_save(kind, original_name, data)


def read_bytes(uri: str) -> bytes:
    if uri.startswith("s3://"):
        return _s3_read(uri)
    if uri.startswith("local:"):
        return _local_read(uri)
    raise ValueError(f"Unsupported storage_uri: {uri}")


def delete(uri: str) -> None:
    if uri.startswith("s3://"):
        _s3_delete(uri)
    elif uri.startswith("local:"):
        _local_delete(uri)


def resolve_path(uri: str) -> str:
    """Получить локальный путь — только для local-URI. Для S3 бросает
    ValueError, потому что объекта на диске нет; используйте `file_response`."""
    if uri.startswith("local:"):
        return _local_resolve(uri)
    raise ValueError(f"resolve_path не применим к {uri[:8]}…")


def file_response(uri: str, *, filename: str, mime: str | None = None):
    """Готовый FastAPI Response для отдачи файла независимо от бэкенда.

    Для local — `FileResponse` (sendfile через ОС).
    Для S3   — `StreamingResponse` с потоковой выгрузкой объекта.
    """
    media = mime or "application/octet-stream"
    if uri.startswith("local:"):
        return FileResponse(_local_resolve(uri), filename=filename, media_type=media)
    if uri.startswith("s3://"):
        cd = f"attachment; filename*=UTF-8''{quote(filename)}"
        return StreamingResponse(_s3_stream(uri), media_type=media, headers={"Content-Disposition": cd})
    raise ValueError(f"Unsupported storage_uri: {uri}")
