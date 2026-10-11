# 02-nest-cinema — REST API кінотеатру на NestJS + PostgreSQL (ДЗ 2)

**Студентка:** Вох Ірина (Iryna Vokh)

REST API для кінотеатру: фільми, зали, сеанси та бронювання місць.
Це продовження першого домашнього завдання: масиви в сервісах замінено на таблиці
PostgreSQL, сутності TypeORM і репозиторії; схема бази створюється **лише міграціями**.
Зовнішня поведінка маршрутів ДЗ 1 не змінилася, крім описаних нижче доповнень.

Що нового порівняно з ДЗ 1:

- PostgreSQL у Docker Compose, параметри підключення читаються з `.env` і валідуються;
- 5 таблиць (`films`, `halls`, `showings`, `bookings`, `booking_seats`) і міграції з `up`/`down`;
- `GET /showings` — посторінкова видача й сортування, усе виконується запитом до бази;
- бронювання записується в **одній транзакції**; унікальний індекс
  `(showing_id, row, seat)` не дає продати місце двічі навіть при одночасних запитах;
- `DELETE /films/:id`, `DELETE /halls/:id` → 409, якщо є сеанси (без каскадного видалення);
- глобальний фільтр винятків — єдина структура відповіді з помилкою;
- скрипт засівання бази `npm run seed`.

## Стек

- Node.js 20+ (перевірено на Node 22), TypeScript, NestJS 11
- PostgreSQL 16 (Docker Compose), TypeORM 0.3 + `@nestjs/typeorm`, драйвер `pg`
- `@nestjs/config` + `class-validator` — конфігурація з валідацією
- `class-validator` / `class-transformer` — валідація DTO; `@nestjs/swagger` — документація
- Jest + Supertest — e2e-тести на справжній базі; ESLint + Prettier

## Запуск

```bash
# 1. Встановити залежності
npm install

# 2. Створити .env (приклад нижче)
cp .env.example .env

# 3. Підняти PostgreSQL через Docker Compose
docker compose up -d

# 4. Застосувати міграції (створюють усі таблиці в порожній базі)
npm run migration:run

# 5. (необов'язково) Засіяти базу даними для перевірки
npm run seed

# 6. Запустити в режимі розробки
npm run start:dev
```

API: <http://localhost:3000>, Swagger UI: <http://localhost:3000/docs>

### Файл `.env`

Зразок — `.env.example`:

```env
# HTTP port of the API
PORT=3000

# PostgreSQL connection (docker-compose.yml uses the same values)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=cinema
DB_PASSWORD=cinema
DB_NAME=cinema

# Log SQL queries (true/false)
DB_LOGGING=false

# Database for e2e tests (created by docker/initdb/01-create-test-db.sh); it is wiped by the tests
DB_TEST_NAME=cinema_test
```

| Змінна | Обов'язкова | Опис |
|---|---|---|
| `PORT` | ні (3000) | порт HTTP-сервера |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | **так** | підключення до PostgreSQL |
| `DB_LOGGING` | ні (`false`) | логувати SQL-запити |
| `DB_TEST_NAME` | ні (`cinema_test`) | окрема база для e2e-тестів |

Змінні описані класом `EnvironmentVariables` (`src/config/env.validation.ts`) з декораторами
`class-validator` — тими самими, що й у DTO. `ConfigModule.forRoot({ validate })` перевіряє їх
під час старту: якщо параметра підключення бракує або він некоректний (напр. `DB_PORT=abc`),
**застосунок не стартує** й пише, що саме не так. Сервіси й `TypeOrmModule` беруть значення
через `ConfigService`, а не через `process.env`.

`docker-compose.yml` бере логін, пароль, назву бази й порт із того самого `.env`.
Під час першого створення тому скрипт `docker/initdb/01-create-test-db.sh` створює ще й
тестову базу `DB_TEST_NAME`.

### Усі команди

```bash
docker compose up -d          # підняти PostgreSQL
docker compose down           # зупинити (дані лишаються в томі pgdata)
docker compose down -v        # зупинити й видалити дані

npm run migration:run         # застосувати міграції
npm run migration:revert      # відкотити останню міграцію (метод down)
npm run migration:show        # список міграцій і їхній стан
npm run migration:generate --name=AddSomething   # нова міграція зі змін у сутностях
npm run migration:create --name=AddSomething     # порожня міграція
npm run seed                  # засіяти базу (повторний запуск не створює дублікатів)

npm run start:dev             # режим розробки
npm run build                 # збірка в dist/
npm run migration:run:prod    # міграції зі зібраного коду (dist)
npm run start:prod            # запуск зібраної версії

npm test                      # unit-тести
npm run test:e2e              # e2e-тести (потрібна запущена база)
npm run lint                  # ESLint
npx prettier --check src test
```

## Схема бази даних

Схема створюється **тільки міграціями** (`src/database/migrations`), `synchronize` вимкнено.
Окремий файл джерела даних `src/database/data-source.ts` описує підключення для CLI TypeORM
(читає `.env` і валідує його тим самим класом). Розширення для UUID вмикається опцією
`uuidExtension: 'pgcrypto'` (ключі мають `DEFAULT gen_random_uuid()`).
Кожна міграція оборотна: `down` повертає базу в попередній стан. Застосовані міграції
не редагуються — зміна схеми означає нову міграцію (і рядок у масиві `MIGRATIONS`
у `src/database/database.options.ts`).

| Таблиця | Колонки | Обмеження |
|---|---|---|
| `films` | `id uuid`, `title varchar`, `duration_minutes integer`, `release_year integer` | PK, усі `NOT NULL` |
| `halls` | `id uuid`, `name varchar`, `rows integer`, `seats_per_row integer` | PK, `UNIQUE(name)` + унікальний індекс на `LOWER(name)` |
| `showings` | `id uuid`, `film_id uuid`, `hall_id uuid`, `starts_at timestamptz`, `price integer` (копійки) | FK на `films` і `halls` — `ON DELETE RESTRICT` |
| `bookings` | `id uuid`, `showing_id uuid`, `total_price integer` (копійки), `created_at timestamptz DEFAULT now()` | FK на `showings` — `ON DELETE CASCADE` |
| `booking_seats` | `id uuid`, `booking_id uuid`, `showing_id uuid`, `row integer`, `seat integer` | FK на `bookings` — `ON DELETE CASCADE`; **унікальний індекс `(showing_id, row, seat)`** |

Зв'язки: фільм і зала мають багато сеансів (обидва зв'язки сеансу обов'язкові); сеанс має багато
бронювань; бронювання має багато місць у `booking_seats` і не існує без сеансу.
Сутності — класи з декораторами TypeORM у папці `entities` свого модуля; зв'язки описані
з обох боків (`@ManyToOne` / `@OneToMany`), обов'язкові позначені `nullable: false`,
унікальний індекс на трійці колонок описаний у класі `BookingSeat` (`@Index(..., { unique: true })`).

Місця зали в базі не зберігаються — сервіс обчислює їх з `rows × seats_per_row`, як у ДЗ 1.
`showing_id` у `booking_seats` дубльовано навмисно: індекс будується по колонках однієї таблиці,
тож саме база (а не код) гарантує, що одне місце на одному сеансі не продадуть двічі.

## Маршрути

| Метод | Шлях | Відповіді |
|---|---|---|
| POST | `/films` | 201 · 400 |
| GET | `/films` | 200 масив (за назвою) |
| GET | `/films/:id` | 200 · 400 · 404 |
| PATCH | `/films/:id` | 200 · 400 · 404 |
| DELETE | `/films/:id` | 204 · 404 · **409, якщо на фільм посилається хоча б один сеанс** |
| POST | `/halls` | 201 · 400 · 409 (назва вже існує, без урахування регістру) |
| GET | `/halls` | 200 масив (за назвою) |
| GET | `/halls/:id` | 200 зала + `seats` · 404 |
| DELETE | `/halls/:id` | 204 · 404 · **409, якщо є сеанси в цій залі** |
| POST | `/showings` | 201 · 400 (фільм/зала не знайдені, дата, ціна) |
| GET | `/showings` | 200 `{ items, total, page, limit }` · 400 |
| GET | `/showings/:id` | 200 · 404 |
| GET | `/showings/:id/seats` | 200 `[{ row, seat, isBooked }]` · 404 |
| POST | `/showings/:id/bookings` | 201 · 400 · 404 · 409 (місце зайняте, нічого не записано) |
| GET | `/showings/:id/bookings` | 200 · 404 |
| GET | `/bookings` | 200 масив |
| DELETE | `/bookings/:id` | 204 (місця звільняються) · 404 |

Невалідний UUID у `:id` → 400. Тіла відповідей ті самі, що в ДЗ 1
(сеанс: `{ id, filmTitle, hallName, startsAt, price }`, бронювання:
`{ id, showingId, seats: [{ row, seat }], totalPrice }`).

### `GET /showings` — фільтри, сортування, сторінки

| Параметр | За замовчуванням | Опис / помилка 400 |
|---|---|---|
| `filmId` | — | UUID фільму |
| `date` | — | `YYYY-MM-DD`, сеанси, що починаються цієї доби (UTC) |
| `page` | `1` | ціле ≥ 1 |
| `limit` | `20` | ціле від 1 до 100 |
| `sort` | `asc` | `asc` або `desc` — порядок за часом початку |

Сеанси з однаковим часом початку впорядковані за `id` (за зростанням) — тому сторінки стабільні.
Відповідь: `{ "items": [...], "total": 42, "page": 1, "limit": 20 }`, де `total` — кількість
усіх сеансів, що відповідають фільтрам. Фільтрація, сортування й `LIMIT/OFFSET` будуються через
Query Builder і виконуються **одним запитом до бази** (`getManyAndCount`), масив у застосунку
не обрізається. `page`/`limit` приймаються лише як цілі числа (`1.5`, `abc`, `1e1`, порожнє → 400).

## Бронювання в транзакції

`BookingsService.create` відкриває транзакцію через `DataSource.transaction`
(`@InjectDataSource()`); усередині працює лише `manager` транзакції:

1. вставляється рядок у `bookings` (база генерує `id`);
2. вставляються рядки в `booking_seats` — по одному на місце.

Якщо хоча б одне місце вже зайняте, PostgreSQL відхиляє вставку через унікальний індекс
(код `23505`), TypeORM робить `ROLLBACK` — у базі не лишається **ні бронювання, ні жодного місця**.
`try/catch` стоїть навколо виклику `transaction`, а не всередині колбека; помилка `23505`
перетворюється на 409 з переліком зайнятих місць (`Seats already booked for this showing: row 1 seat 2`),
текст помилки бази клієнту не потрапляє. Інші помилки бази прокидаються далі (500).

Це працює й для одночасних запитів: друга вставка того самого місця чекає на першу транзакцію
й після її `COMMIT` отримує порушення індексу (перевірено e2e-тестом із 10 паралельними запитами).
Місця вставляються у фіксованому порядку (ряд, місце), щоб зустрічні запити не потрапили
в deadlock. Видалення бронювання видаляє його місця каскадом на рівні бази (`ON DELETE CASCADE`),
циклу в сервісі немає.

Видалення фільму/зали з сеансами блокує сама база (`ON DELETE RESTRICT`); сервіс перехоплює
порушення зовнішнього ключа (`23503`) і відповідає 409 з поясненням.

## Формат помилок

Глобальний фільтр `AllExceptionsFilter` (`src/common/filters`) приводить усі помилки до одного вигляду
(описано в Swagger як `ErrorResponseDto`):

```json
{
  "statusCode": 404,
  "message": "Film with id 00000000-0000-4000-8000-000000000000 not found",
  "error": "Not Found",
  "path": "/films/00000000-0000-4000-8000-000000000000",
  "timestamp": "2026-10-11T07:45:05.228Z"
}
```

Для помилок валідації `message` — масив повідомлень. Невідомі помилки → 500
`Internal server error` (деталі лише в лозі сервера).

## Засівання бази

`src/seed.ts` (`npm run seed`) додає 2 фільми, 2 зали, 4 сеанси в різні дати (15–18.01.2030)
та одне бронювання (2 місця). Запускається на порожній базі після міграцій. Кожен запис спершу
шукається за природним ключем (назва+рік фільму, назва зали, фільм+зала+час, заброньоване місце),
тому повторний запуск не створює дублікатів.

## Тести

```bash
docker compose up -d
npm run test:e2e
npm test
```

e2e-тести працюють зі **справжнім PostgreSQL** в окремій базі `DB_TEST_NAME` (за замовчуванням
`cinema_test`; решта параметрів — із `.env`). Перед запуском `test/global-setup.ts` очищає її
й створює схему міграціями; перед кожним тестом таблиці очищаються (`TRUNCATE`).
Покрито: усі маршрути й помилки ДЗ 1; пагінацію, сортування й 400 на кожен неправильний параметр;
структуру помилок; транзакцію (409 без часткового запису), 10 одночасних бронювань одного місця
(рівно одне 201), зустрічні запити без deadlock; каскадне видалення місць; 409 при видаленні
фільму/зали з сеансами; збереження даних після перезапуску застосунку; типи колонок, обмеження,
індекси й правила FK; оборотність міграцій (`down` → порожня база → `up`); ідемпотентність seed.
Unit-тест перевіряє, що конфігурація без параметрів БД не проходить валідацію.

## requests.http

`requests.http` у корені виконується **згори донизу** (VS Code, розширення REST Client):
фільм → зала → сеанс → бронювання → решта маршрутів (зокрема пагінація й сортування) →
кожна помилка з опису маршрутів (400/404/409, у т.ч. неправильні `page`/`limit`/`sort`/`date`,
зайняте місце, видалення фільму/зали з сеансами) → скасування бронювання й перевірка, що місця
звільнилися. Ідентифікатори підставляються зі змінних (`@filmId = {{createFilm.response.body.id}}`),
біля кожного запиту є `# Expected: <код>`. Перед запуском потрібні `docker compose up -d`,
`npm run migration:run` і `npm run start:dev`.

## Структура

```
docker-compose.yml, docker/initdb/        # PostgreSQL + створення тестової бази
src/
  main.ts, app.module.ts, app.setup.ts    # bootstrap, ConfigModule, TypeOrmModule, ValidationPipe, Swagger
  config/env.validation.ts                # клас змінних оточення + validateEnv
  database/
    database.options.ts                   # спільні опції підключення, ENTITIES, MIGRATIONS
    data-source.ts                        # DataSource для CLI TypeORM і seed
    migrations/                           # міграції (up/down)
  seed.ts                                 # npm run seed
  common/                                 # фільтр винятків, ErrorResponseDto, Seat, межі, валідатори
  films/ halls/ showings/ bookings/       # модуль = контролер + сервіс (репозиторії) + dto/ + entities/
test/
  app.e2e-spec.ts                         # маршрути, пагінація, транзакції, конкурентність
  migrations.e2e-spec.ts                  # схема, оборотність міграцій, seed
  global-setup.ts, test-env.ts            # тестова база й міграції перед тестами
requests.http
```

Модулі не мають циклічних залежностей: `showings` використовує `FilmsService`/`HallsService`,
`bookings` — `ShowingsService`/`HallsService`; перевірка «є сеанси» при видаленні фільму чи зали
делегована обмеженню зовнішнього ключа в базі.
