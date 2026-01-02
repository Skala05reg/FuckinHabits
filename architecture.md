Отличное уточнение. Сдвиг «логических суток» до 04:00 — это мастхэв для «сов», иначе статистика будет кривой.

Ниже подробный файл `ARCHITECTURE.md`, который можно положить в корень проекта. Это готовый план для разработки.

---

# ARCHITECTURE.md

## 1. Обзор проекта

Telegram Mini App для трекинга продуктивности (Quantified Self).
**Ключевая особенность:** "Логический день" длится до 04:00 утра следующих суток.
**Цель:** Бесплатный хостинг, вечное хранение данных, Serverless архитектура.

---

## 2. Технологический стек (Free Tier)

### Frontend (Mini App UI)

* **Framework:** React (Vite) + TypeScript.
* **UI Kit:** TailwindCSS + Shadcn/ui (для красивых графиков и чеклистов).
* **State Management:** Zustand или React Context.
* **Charts:** Recharts (для графиков и Heatmap).
* **Hosting:** Vercel (Static Web Apps).

### Backend (API & Bot Logic)

* **Runtime:** Node.js (Vercel Serverless Functions).
* **Framework:** Hono.js или Next.js API Routes (легковесные, быстро стартуют).
* **Bot Library:** `grammy` (лучшая поддержка TypeScript и serverless-режима).
* **Hosting:** Vercel Functions.

### Database

* **Provider:** Supabase (PostgreSQL).
* **ORM:** Drizzle ORM или Supabase JS Client (прямые запросы).

### Scheduler (Cron)

* **Service:** Cron-job.org (внешний триггер).
* **Задача:** Раз в сутки (в 00:00 или 04:00) дергать эндпоинт бота для рассылки напоминаний.

---

## 3. Схема данных (Database Schema)

Мы используем реляционную структуру в PostgreSQL.

### Таблица: `users`

Хранит профиль пользователя.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | Primary Key |
| `telegram_id` | bigint | Уникальный ID из Telegram (Index) |
| `first_name` | text | Имя |
| `created_at` | timestamp | Дата регистрации |

### Таблица: `habits`

Список привычек пользователя.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK на users |
| `title` | text | Название (напр. "Чтение") |
| `is_active` | boolean | Активна ли привычка сейчас |
| `position` | integer | Для сортировки в списке |

### Таблица: `daily_logs`

Главная таблица дня. Хранит оценки, заметки и связь с датой.
**Важно:** Поле `date` хранит "логическую дату" (без времени).
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK на users |
| `date` | date | Логическая дата (2024-01-01) |
| `rating_efficiency`| int2 | Оценка 1-5 |
| `rating_social` | int2 | Оценка 1-5 |
| `journal_text` | text | Ответ на вечерний вопрос |
| `created_at` | timestamp | Реальное время записи |

### Таблица: `habit_completions`

Факты выполнения привычек.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `habit_id` | uuid | FK на habits |
| `date` | date | Логическая дата выполнения |
| `user_id` | uuid | FK (для ускорения выборок) |

---

## 4. Ключевая логика

### 4.1. Алгоритм "Логических суток" (The 04:00 AM Rule)

Любое действие (отметка привычки, оценка дня), совершенное пользователем, должно привязываться к правильной дате.

**Формула вычисления даты:**

```typescript
function getLogicalDate(timestamp: Date): string {
  // Клонируем дату, чтобы не мутировать оригинал
  const date = new Date(timestamp);
  
  // Отнимаем 4 часа
  // Если сейчас 02 янв 03:00 -> минус 4ч -> 01 янв 23:00 -> Логическая дата: 01 янв
  // Если сейчас 02 янв 10:00 -> минус 4ч -> 02 янв 06:00 -> Логическая дата: 02 янв
  date.setHours(date.getHours() - 4);
  
  // Возвращаем строку YYYY-MM-DD
  return date.toISOString().split('T')[0];
}

```

*Этот расчет должен происходить на **Backend** для надежности, либо на клиенте с обязательной валидацией часового пояса.*

### 4.2. Расчет Heatmap (Тепловая карта)

Для построения графика (как на GitHub) фронтенд запрашивает данные за год.

**SQL Logic (Supabase RPC):**
Нам нужно одним запросом получить массив: `[{ date: "2024-01-01", score: 4 }, ...]`.
`Score` для Heatmap можно считать как среднее арифметическое оценок дня или % выполненных привычек.

Пример запроса:

```sql
SELECT 
  date, 
  rating_efficiency as value 
FROM daily_logs 
WHERE user_id = '...' 
AND date > now() - interval '1 year';

```

На фронте мапим `value` в цвета (1 - бледный, 5 - ярко-зеленый).

---

## 5. API Endpoints (Serverless Functions)

Все эндпоинты лежат в `/api`.

1. `POST /api/webhook`
* Принимает апдейты от Telegram.
* Обрабатывает команды `/start`, текстовые сообщения (журналинг).


2. `GET /api/user/status`
* Получает данные на сегодня (для Mini App): какие привычки нажаты, какие оценки стоят.
* Использует `getLogicalDate()` для поиска в БД.


3. `POST /api/habits/toggle`
* Вход: `habitId`.
* Действие: Создает или удаляет запись в `habit_completions` с текущей *логической* датой.


4. `POST /api/day/rate`
* Вход: `efficiency`, `social`.
* Действие: Upsert (создать или обновить) запись в `daily_logs` по *логической* дате.


5. `POST /api/cron/remind`
* Защищен секретным ключом.
* Вызывается внешним кроном.
* Рассылает пользователям: "День кончился (или почти). Запиши итоги."



---

## 6. Флоу работы (User Flow)

### Сценарий 1: Пользователь в 02:30 ночи (Среда)

1. Открывает Mini App.
2. App вычисляет: 02:30 Среды минус 4ч = 22:30 Вторника.
3. Загружает данные за **Вторник**.
4. Пользователь ставит галочку "Спорт". В БД летит запись `date: "2024-Tuesday"`.
5. Пользователь закрывает день, ставит оценку 5.

### Сценарий 2: Напоминание

1. В 00:00 (или в удобное время) Cron дергает бота.
2. Бот пишет юзеру: "Как прошел день?".
3. Юзер отвечает текстом (даже в 03:00 ночи).
4. Бот ловит сообщение -> вычисляет логическую дату -> сохраняет текст в поле `journal_text` таблицы `daily_logs` за *вчера*.

---

## 7. План деплоя (CI/CD)

1. **Supabase:**
* Создать проект.
* Выполнить SQL скрипты (Migration) для создания таблиц.
* Включить RLS (Row Level Security), чтобы юзеры не читали чужие данные (хотя у нас вся логика на бэке, но для безопасности полезно).


2. **GitHub + Vercel:**
* Пуш кода в репозиторий.
* Vercel автоматически подхватывает изменения.
* В Environment Variables на Vercel добавить: `SUPABASE_URL`, `SUPABASE_KEY`, `TELEGRAM_BOT_TOKEN`.


3. **Telegram:**
* BotFather -> `/setwebhook` -> указать URL от Vercel (`https://your-app.vercel.app/api/webhook`).
* BotFather -> `/newapp` -> создать кнопку Menu Button, ведущую на `https://your-app.vercel.app`.