# TaskBoard — a Trello-style task board

A full-stack task board app: boards → lists → cards, with drag-and-drop,
labels, due dates, checklists, comments, assignees, activity history,
search/filter, and user accounts.

This repository contains **Level 1** of the developer brief: the complete
application running locally with Docker.

---

## 1. What you need installed

You only need **one** thing:

- **Docker Desktop** — <https://www.docker.com/products/docker-desktop/>
  (Docker Desktop includes "Docker Compose", which is what actually runs the app.)

You do **not** need Node.js, a database, or any other tools to run the app.

To check Docker is ready, open a terminal and run:

```bash
docker --version
docker compose version
```

Both commands should print a version number.

---

## 2. Run the app (3 steps)

From the project folder (the folder that contains this README):

### Step 1 — create your configuration file

```bash
cp .env.example .env
```

This copies the example settings to a real settings file called `.env`.
The defaults work as-is. If you want, open `.env` and change `JWT_SECRET`
to any long random string (this is the key used to sign login sessions).

### Step 2 — build and start everything

```bash
docker compose up --build
```

The first run downloads images and builds the app, so it can take a few
minutes. You'll know it's ready when you see lines like:

```
server-1  | ==> Applying database migrations...
server-1  | ==> Seeding database (safe to run repeatedly)...
server-1  | Seed complete.
server-1  | API listening on http://localhost:4000
web-1     | ... nginx ... start worker processes
```

### Step 3 — open the app

Open **<http://localhost:8080>** in your browser.

Log in with the demo account (the login form is pre-filled with it):

| Field    | Value              |
| -------- | ------------------ |
| Email    | `demo@example.com` |
| Password | `demo1234`         |

Two extra teammates also exist so you can test sharing and assignments:

- `alex@example.com` — password `teammate123`
- `sam@example.com` — password `teammate123`

### Stopping the app

Press `Ctrl+C` in the terminal, then optionally:

```bash
docker compose down
```

Your data is kept in a Docker volume, so it survives `down` and restarts.
To wipe everything and start fresh:

```bash
docker compose down -v
```

---

## 3. What to try (confirm it works)

After logging in as `demo@example.com`:

1. **Boards dashboard** — you'll see a board called **"Product Roadmap (Sample)"**.
   Click it.
2. **Lists & cards** — the board has lists (Backlog, In Progress, Review, Done)
   with sample cards.
3. **Drag and drop** — drag a card to another list. Refresh the page — it stays
   where you dropped it. Drag the grip handle on a list header to reorder lists.
4. **Open a card** — click a card to open it. Try:
   - editing the **description**
   - toggling **labels**
   - setting a **due date**
   - adding a **checklist** and ticking items
   - writing a **comment**
   - assigning **Alex** or **Sam**
   - watch the **Activity** panel update as you go
5. **Search / filter** — use the bar above the board to filter cards by text,
   label, assignee, or due date (e.g. "Overdue").
6. **Members** — click **Members** to add `alex@example.com` to the board.
7. **Sharing** — open a second browser (or a private window), log in as
   `alex@example.com`, and you'll see the shared board.
8. **Create your own** — go back to Boards → **New board**, add lists and cards.
9. **Persistence** — run `docker compose down` then `docker compose up` again.
   Everything is still there.

---

## 4. Architecture & technology choices

### Overview

```
Browser ──▶ web (nginx)  ──/api──▶  server (Node/Express)  ──▶  db (PostgreSQL)
            static React app         REST API                    persistent volume
```

Everything runs as three Docker containers wired together by
`docker-compose.yml`.

### Technology chosen — and why

| Layer        | Choice                              | Why |
| ------------ | ----------------------------------- | --- |
| Language     | **TypeScript** (front and back)     | One language across the stack; types catch mistakes early. |
| Frontend     | **React + Vite**                    | The most widely used UI library, huge amount of documentation and help available. Vite gives a fast, simple build. |
| UI styling   | **Tailwind CSS**                    | Utility classes make a clean, consistent, responsive layout without a separate design system. |
| Drag & drop  | **@dnd-kit**                        | Modern, accessible (keyboard + touch support), well maintained. |
| Data fetching| **TanStack Query**                  | Handles server data, caching and refetching so the UI stays in sync. |
| Backend      | **Node.js + Express**               | The most common, best-documented way to build a REST API in JavaScript. |
| Database     | **PostgreSQL**                      | Rock-solid, free, open-source relational database — a safe default for structured data like boards/lists/cards. |
| DB access    | **Prisma ORM**                      | Type-safe database queries, readable schema file, and built-in migrations + seeding. |
| Auth         | **JWT in an httpOnly cookie** + **bcrypt** password hashing | Standard, simple session handling; the cookie can't be read by JavaScript (protects against XSS token theft). |
| Validation   | **Zod**                             | Every incoming request body/params is validated before it touches the database. |
| Security     | **helmet**, **CORS**, **rate limiting** | Sensible HTTP headers, controlled cross-origin access, and protection against brute-force/abuse. |

### Repository structure

```
.
├── docker-compose.yml       # runs db + server + web together
├── .env.example             # every configuration value, documented
├── server/                  # BACK END — REST API (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma    # database schema (source of truth)
│   │   ├── migrations/      # versioned SQL migrations
│   │   └── seed.ts          # demo account + sample board
│   ├── src/
│   │   ├── index.ts         # server entry point
│   │   ├── app.ts           # Express app + middleware
│   │   ├── env.ts           # loads & validates environment variables
│   │   ├── middleware/      # auth, validation, error handling
│   │   ├── lib/             # prisma client, auth, access checks, helpers
│   │   └── routes/          # auth, users, boards, lists, cards, labels,
│   │                        #   comments, checklists, activity
│   └── Dockerfile
└── web/                     # FRONT END — React single-page app
    ├── src/
    │   ├── pages/           # login, register, boards, board, account
    │   ├── components/      # board columns, card tile, card modal, etc.
    │   └── lib/             # api client, auth context, types, formatting
    ├── nginx.conf.template  # serves the app + proxies /api to the backend
    └── Dockerfile
```

The front end and back end are **completely separate** applications that only
communicate over the REST API. In development they can run independently; in
Docker, nginx serves the front end and forwards `/api/*` calls to the backend.

### Data model

`User`, `Board`, `BoardMember`, `List`, `Card`, `Label`, `CardLabel`,
`CardAssignee`, `Comment`, `Checklist`, `ChecklistItem`, `Activity`.

See [`server/prisma/schema.prisma`](server/prisma/schema.prisma).

### REST API endpoints

Base URL: `/api`

| Area       | Endpoints |
| ---------- | --------- |
| Auth       | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/password` |
| Users      | `GET /users` |
| Boards     | `GET /boards`, `POST /boards`, `GET /boards/:id`, `PATCH /boards/:id`, `POST /boards/:id/archive`, `DELETE /boards/:id` |
| Members    | `GET /boards/:id/members`, `POST /boards/:id/members`, `DELETE /boards/:id/members/:userId` |
| Activity   | `GET /boards/:id/activity`, `GET /cards/:cardId/activity` |
| Search     | `GET /boards/:id/search?q=&labelId=&assigneeId=&due=` |
| Lists      | `POST /lists`, `PUT /lists/reorder`, `PATCH /lists/:id`, `DELETE /lists/:id` |
| Cards      | `POST /cards`, `GET /cards/:id`, `PATCH /cards/:id`, `DELETE /cards/:id`, `POST /cards/:id/move` |
| Card labels| `POST /cards/:id/labels`, `DELETE /cards/:id/labels/:labelId` |
| Assignees  | `POST /cards/:id/assignees`, `DELETE /cards/:id/assignees/:userId` |
| Labels     | `GET /labels?boardId=`, `POST /labels`, `PATCH /labels/:id`, `DELETE /labels/:id` |
| Comments   | `GET /cards/:id/comments`, `POST /cards/:id/comments`, `PATCH /comments/:id`, `DELETE /comments/:id` |
| Checklists | `POST /cards/:id/checklists`, `PATCH /checklists/:id`, `DELETE /checklists/:id`, `POST /checklists/:id/items`, `PATCH /checklist-items/:id`, `DELETE /checklist-items/:id` |
| Health     | `GET /api/health` |

Quick check from the terminal while the app is running:

```bash
curl http://localhost:8080/api/health
```

---

## 5. Configuration (environment variables)

All configuration lives in `.env` (created from `.env.example`). Nothing is
hardcoded. Key values:

| Variable | Meaning |
| -------- | ------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials. |
| `DATABASE_URL` | Full connection string the backend uses. |
| `JWT_SECRET` | Secret used to sign login sessions — **change this**. |
| `JWT_EXPIRES_IN` | How long a login lasts (e.g. `7d`). |
| `COOKIE_SECURE` | `false` for local HTTP; `true` only when served over HTTPS. |
| `PORT` | Backend API port (default `4000`). |
| `WEB_PORT` | Port you open in the browser (default `8080`). |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS. |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | The demo account created on first start. |

---

## 6. Running without Docker (optional, for developers)

You need Node.js 20+ and a local PostgreSQL database.

```bash
# Backend
cd server
npm install
cp ../.env.example .env            # edit DATABASE_URL to point at your local Postgres
npx prisma migrate deploy
npm run seed
npm run dev                        # API on http://localhost:4000

# Frontend (second terminal)
cd web
npm install
npm run dev                        # app on http://localhost:5173 (proxies /api to :4000)
```

---

## 7. Troubleshooting

| Problem | Fix |
| ------- | --- |
| `port is already allocated` | Another program uses port 8080/4000/5432. Change `WEB_PORT` / `PORT` in `.env`, or stop the other program. |
| Browser shows "Could not load" | Give the backend a few seconds on first start (it runs migrations first). Refresh. |
| Want a clean slate | `docker compose down -v` then `docker compose up --build`. |
| Login fails for the demo user | Run `docker compose logs server` and check the seed step ran. |

---

## 8. Source control

This project uses Git with small, incremental commits. To publish it to GitHub:

```bash
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<your-username>/taskboard.git
git push -u origin main
```
