# API бэкенда ИС формирования РПД

## Запуск

```bash
docker-compose up --build
```

Бэкенд доступен на `http://localhost:8000`, Swagger UI — `http://localhost:8000/docs`

## Демо-пользователи

| Логин    | Пароль   | Роль            |
|----------|----------|-----------------|
| ivanov   | password | Преподаватель   |
| petrov   | password | Зав. кафедрой   |
| admin    | password | Администратор   |
| kozlova  | password | Преподаватель   |

---

## Эндпоинты

### Авторизация (`/api/auth`)
- `POST /api/auth/login` — OAuth2 форма (username + password), возвращает JWT токен
- `GET /api/auth/me` — текущий пользователь

### РПД (`/api/rpd`)
- `GET /api/rpd/directions` — список направлений подготовки
- `GET /api/rpd/disciplines?direction_id=` — список дисциплин
- `GET /api/rpd/` — список РПД (фильтр: `status`, `academic_year`)
- `GET /api/rpd/{id}` — детальная карточка РПД (со всеми вложенными данными)
- `POST /api/rpd/` — создание РПД (с опцией `based_on_rpd_id` для копирования из архива)
- `PATCH /api/rpd/{id}` — обновление текстовых полей
- `DELETE /api/rpd/{id}` — удаление черновика

#### Разделы дисциплины
- `POST /api/rpd/{id}/sections` — добавить раздел
- `PUT /api/rpd/sections/{section_id}` — обновить раздел
- `DELETE /api/rpd/sections/{section_id}` — удалить раздел

#### Тематики занятий
- `POST /api/rpd/sections/{section_id}/topics` — добавить тему
- `PUT /api/rpd/topics/{topic_id}` — обновить тему
- `DELETE /api/rpd/topics/{topic_id}` — удалить тему

#### Литература
- `POST /api/rpd/{id}/literature` — добавить источник
- `PUT /api/rpd/literature/{lit_id}` — обновить
- `DELETE /api/rpd/literature/{lit_id}` — удалить

#### Программное обеспечение
- `POST /api/rpd/{id}/software` — добавить ПО
- `PUT /api/rpd/software/{sw_id}` — обновить
- `DELETE /api/rpd/software/{sw_id}` — удалить

#### Материально-техническое обеспечение
- `POST /api/rpd/{id}/material-tech` — добавить
- `PUT /api/rpd/material-tech/{mt_id}` — обновить
- `DELETE /api/rpd/material-tech/{mt_id}` — удалить

#### Результаты обучения (компетенции)
- `POST /api/rpd/{id}/outcomes` — добавить результат
- `PUT /api/rpd/outcomes/{outcome_id}` — обновить
- `DELETE /api/rpd/outcomes/{outcome_id}` — удалить

#### Разработчики РПД
- `POST /api/rpd/{id}/developers?user_id=` — назначить
- `DELETE /api/rpd/developers/{dev_id}` — убрать

#### Согласование
- `POST /api/rpd/{id}/send-approval` — отправить на согласование
- `POST /api/rpd/{id}/review` — согласовать/отклонить (`action: approve|reject`)
- `GET /api/rpd/{id}/approvals` — история согласования

### Компетенции (`/api/competencies`)
- `GET /api/competencies/?direction_id=` — все компетенции с индикаторами
- `GET /api/competencies/by-discipline/{id}` — компетенции привязанные к дисциплине

### LLM генерация (`/api/llm`)
- `POST /api/llm/{rpd_id}/generate` — генерация раздела (`section`: goals, tasks, objects, requirements, educational_tech, methodical_recommendations, content, topics, literature, learning_outcomes)
- `GET /api/llm/{rpd_id}/logs` — история генераций

### Загрузка документов (`/api/upload`)
- `POST /api/upload/{rpd_id}` — загрузить файл (PDF, DOCX, TXT, XLSX)
- `GET /api/upload/{rpd_id}` — список загруженных документов
- `GET /api/upload/download/{doc_id}` — скачать документ
- `DELETE /api/upload/{doc_id}` — удалить документ

### Экспорт (`/api/export`)
- `GET /api/export/{rpd_id}/pdf` — скачать РПД в PDF

### Уведомления (`/api/notifications`)
- `GET /api/notifications/` — список уведомлений
- `GET /api/notifications/unread-count` — количество непрочитанных
- `POST /api/notifications/{id}/read` — пометить как прочитанное
- `POST /api/notifications/read-all` — прочитать все

### Администрирование (`/api/admin`)
- `GET /api/admin/users` — список пользователей
- `POST /api/admin/users` — создать пользователя
- `PATCH /api/admin/users/{id}` — обновить
- `DELETE /api/admin/users/{id}` — деактивировать
- `GET /api/admin/users/search?q=` — поиск по имени (для назначения разработчиков)
- `GET /api/admin/roles` — список ролей
- `GET /api/admin/departments` — список кафедр

### Служебные
- `GET /api/health` — health check
