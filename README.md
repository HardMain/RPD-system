# Руководство по сборке и запуску ИС формирования РПД

## Структура проекта

```
rpd-system/
├── docker-compose.yml          # Оркестрация контейнеров
├── .env.example                # Шаблон переменных окружения
├── backend/                    # FastAPI бэкенд (Python 3.11)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # Точка входа, seed-данные
│       ├── core/               # Конфиг, БД, авторизация
│       ├── models/user.py      # SQLAlchemy модели (18 таблиц)
│       ├── schemas/__init__.py # Pydantic-схемы
│       ├── routers/            # 8 роутеров (~50 эндпоинтов)
│       │   ├── auth.py         # Авторизация (login, me)
│       │   ├── rpd.py          # CRUD РПД + все вложенные сущности
│       │   ├── competencies.py # Компетенции и индикаторы
│       │   ├── llm.py          # Генерация разделов через LLM
│       │   ├── upload.py       # Загрузка документов
│       │   ├── export.py       # Экспорт в PDF
│       │   ├── notifications.py# Уведомления
│       │   └── admin.py        # Управление пользователями
│       └── services/
│           ├── llm_service.py  # LLM-сервис (OpenAI API + fallback)
│           └── pdf_service.py  # Генерация PDF (ReportLab)
└── frontend/                   # React + Vite фронтенд
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             # Главный компонент (~560 строк)
        └── api/client.js       # Axios-клиент (все API-методы)
```

---

## Быстрый запуск (Docker)

### 1. Подготовка

```bash
# Клонируем / копируем проект
cd rpd-system

# Создаём файл переменных окружения
cp .env.example .env
```

### 2. Запуск

```bash
docker-compose up --build
```

Это поднимет три сервиса:
- **PostgreSQL 16** на порту `5432`
- **Backend (FastAPI)** на порту `8000`
- **Frontend (Vite)** на порту `3000`

### 3. Открыть приложение

Откройте в браузере: **http://localhost:3000**

### Демо-пользователи

| Логин   | Пароль   | Роль            |
|---------|----------|-----------------|
| ivanov  | password | Преподаватель   |
| kozlova | password | Преподаватель   |
| petrov  | password | Зав. кафедрой   |
| admin   | password | Администратор   |

---

## Запуск без Docker (для разработки)

### Предварительные требования
- Python 3.11+
- Node.js 18+
- PostgreSQL 16

### Backend

```bash
cd backend

# Создаём виртуальное окружение
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows

# Устанавливаем зависимости
pip install -r requirements.txt

# Настраиваем БД (создать базу rpd_db в PostgreSQL)
export DATABASE_URL="postgresql+asyncpg://rpd_user:rpd_secret@localhost:5432/rpd_db"

# Запускаем
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend автоматически создаст таблицы и заполнит демо-данными при первом запуске.

Swagger UI доступен по адресу: **http://localhost:8000/docs**

### Frontend

```bash
cd frontend

# Устанавливаем зависимости
npm install

# Запускаем dev-сервер
npm run dev
```

Фронтенд на **http://localhost:3000**, API проксируется на `http://backend:8000`.

Для локальной разработки измените `vite.config.js`:
```js
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // вместо http://backend:8000
    changeOrigin: true,
  },
},
```

---

## Подключение LLM

По умолчанию система работает в **demo-режиме** (fallback-тексты без LLM).

Для подключения реальной LLM (OpenAI, Ollama, и т.д.) отредактируйте `.env`:

```env
# OpenAI
LLM_API_KEY=sk-...your-key...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Или Ollama (локально)
LLM_API_KEY=ollama
LLM_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=llama3.1

# Или любой OpenAI-совместимый API
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.together.xyz/v1
LLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
```

После изменения `.env` перезапустите бэкенд:
```bash
docker-compose restart backend
```

---

## Как связаны фронтенд и бэкенд

```
Браузер (React SPA)
    │
    │  HTTP-запросы на /api/*
    ▼
Vite Dev Server (порт 3000)
    │
    │  proxy: /api → http://backend:8000
    ▼
FastAPI Backend (порт 8000)
    │
    │  SQLAlchemy async queries
    ▼
PostgreSQL (порт 5432)
```

- Фронтенд (React) делает все запросы на `/api/*`
- Vite проксирует их на бэкенд (FastAPI)
- Бэкенд обрабатывает и обращается к PostgreSQL
- JWT-токен хранится в `localStorage` и передаётся в заголовке `Authorization: Bearer ...`

---

## Основные пользовательские сценарии

1. **Преподаватель** создаёт РПД → заполняет разделы (вручную или через LLM) → загружает документы для контекста → отправляет на согласование
2. **Зав. кафедрой** видит РПД на согласовании → просматривает → согласовывает или возвращает на доработку с комментарием
3. **Администратор** управляет пользователями, ролями, кафедрами
4. **LLM** генерирует текст разделов РПД на основе названия дисциплины, направления и загруженных документов

---

## Полезные команды

```bash
# Пересоздать БД с нуля
docker-compose down -v && docker-compose up --build

# Только бэкенд
docker-compose up backend db

# Логи бэкенда
docker-compose logs -f backend

# Подключиться к БД
docker exec -it rpd-system-db-1 psql -U rpd_user rpd_db
```
