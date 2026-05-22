# Backend-тесты (pytest)

API-тесты FastAPI поверх отдельной БД `rpd_test` в том же postgres-контейнере.
LLM работает в `demo`-режиме, файлы — локально (`STORAGE_BACKEND=local`), minio не нужен.

## Запуск (в контейнере, рекомендуется)

```bash
docker compose up -d db backend
docker compose exec backend pip install -r requirements-test.txt
docker compose exec backend pytest
```

## Запуск локально

Поднимите postgres (порт 5432 проброшен compose-ом) и укажите базовый URL:

```bash
cd backend
pip install -r requirements.txt -r requirements-test.txt
set TEST_BASE_DATABASE_URL=postgresql+asyncpg://rpd_user:rpd_secret@localhost:5432/rpd_db
pytest
```

## Как это устроено

- `conftest.py` пересоздаёт БД `rpd_test`, прогоняет `lifespan` приложения (схема + сид) один раз на сессию и отдаёт `httpx.AsyncClient`.
- Фикстуры `auth(login)` / `login(login)` логинят демо-пользователей (пароль `password`) и кешируют токены.
- Тесты создают свои РПД (не полагаются на конкретные id сида), сидовые данные используются как опора (демо-пользователи, БУП, согласованная РПД-образец).

## Переменные окружения

- `TEST_BASE_DATABASE_URL` — базовый URL postgres (имя БД заменяется на тестовую).
- `TEST_DB_NAME` — имя тестовой БД (по умолчанию `rpd_test`).
