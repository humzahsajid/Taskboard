# TaskBoard — a Trello-style task board

A full-stack task board app: boards → lists → cards, with drag-and-drop,
labels, due dates, checklists, comments, assignees, activity history,
search/filter, and user accounts.

This repository covers all three delivery levels:

- **Level 1** — runs locally with Docker (sections 1–3)
- **Level 2** — deployed to a cloud server via an automated GitHub → server pipeline (section 9)
- **Level 3** — reachable only through a Cloudflare Tunnel, behind an authentication gate (section 10)

**Live app:** https://ran-stanford-field-sole.trycloudflare.com — see section 10 for
the access password and a note about the URL.

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

This project uses Git with small, incremental commits, hosted at
<https://github.com/humzahsajid/Taskboard>.

---

## 9. Level 2 — Cloud deployment & CI/CD

### The live app

Reached through the Cloudflare Tunnel — see **section 10** for the URL and the
access gate. (Before Level 3 it was served directly at `http://209.38.88.46`;
that is now closed.)

Application login (once past the gate): `demo@example.com` / `demo1234`.

### Infrastructure

| Piece | What it is |
| ----- | ---------- |
| Server | A DigitalOcean Droplet (Ubuntu 24.04, 1 vCPU / 1 GB RAM + 2 GB swap) at `209.38.88.46` |
| Registry | GitHub Container Registry (`ghcr.io`) holds the built `taskboard-server` and `taskboard-web` images |
| Runtime | Docker + `docker-compose.prod.yml` on the Droplet — same three containers as local (db + server + web) |
| Ingress | Cloudflare Tunnel only (section 10). `ufw` allows just port 22; the web container is bound to `127.0.0.1` |
| Config | `/opt/taskboard/.env` on the Droplet (generated on first setup, never in Git) |

The Droplet **does not build anything** — it only pulls pre-built images, so the
1 GB box stays responsive.

### The pipeline (`.github/workflows/deploy.yml`)

Every push to `main` runs:

1. **build** — builds the `server` and `web` Docker images and pushes them to
   `ghcr.io` tagged with both `latest` and `sha-<commit>`.
2. **deploy** — SSHes into the Droplet using a dedicated deploy key, runs
   `git reset --hard origin/main`, then
   [`deploy/remote-update.sh`](deploy/remote-update.sh): `docker compose pull`
   the new images, `up -d`, wait for `/api/health`, prune old images.
3. **verify** — the workflow curls `http://209.38.88.46/api/health` from GitHub
   and fails the run if it isn't `200`.

Database migrations run automatically inside the server container on startup
(`prisma migrate deploy`), so schema changes ship with the code.

A separate lightweight **CI** workflow (`.github/workflows/ci.yml`) type-checks
the backend and builds the frontend on pull requests.

### GitHub repository secrets used

| Secret | Value |
| ------ | ----- |
| `DEPLOY_SSH_KEY` | Private half of the passphrase-free deploy key |
| `DEPLOY_HOST` | `209.38.88.46` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_KNOWN_HOSTS` | The Droplet's SSH host keys (pins the host, prevents MITM) |

`GITHUB_TOKEN` (built in) is what pushes/pulls the container images — no
long-lived registry token is stored.

### Deploy a change

Just push to `main` (or edit a file on github.com). Watch it at
**Actions → Build & Deploy**. Or trigger a redeploy of the current commit with
**Actions → Build & Deploy → Run workflow**.

### One-time server setup (for reference / rebuilding)

Performed once on a fresh Droplet:

```bash
# 2 GB swap, Docker CE + compose plugin, ufw (22/80/443)
# git clone https://github.com/humzahsajid/Taskboard.git /opt/taskboard
# create /opt/taskboard/.env  (copy .env.example, set strong JWT_SECRET +
#   DB password, CLIENT_ORIGIN=http://209.38.88.46, WEB_PORT=80)
# add the deploy key's PUBLIC half to ~/.ssh/authorized_keys
```

After that the pipeline owns all further deploys.

### Manual redeploy from the server

```bash
ssh root@209.38.88.46
cd /opt/taskboard && git pull
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d
```

---

## 10. Level 3 — Secure access tunnel

### How to reach the app

**URL:** https://ran-stanford-field-sole.trycloudflare.com

**Access gate (HTTP Basic Auth — a browser prompt appears first):**

| | |
| --- | --- |
| Username | `taskboard` |
| Password | *(sent separately — not committed to the repo)* |

Then the app's own login: `demo@example.com` / `demo1234`.

> **About the URL:** there's no custom domain, so the tunnel uses a free
> Cloudflare `*.trycloudflare.com` address. It's stable while the connector
> keeps running but **changes if `cloudflared` restarts** (reboot, update).
> To get the current one: `journalctl -u cloudflared | grep -oE 'https://[a-z-]+\.trycloudflare\.com' | tail -1` on the Droplet. A permanent URL needs a domain on a Cloudflare zone (then a named tunnel + Cloudflare Access replaces the pieces below).

### How access is secured

```
Browser ──HTTPS──▶ Cloudflare edge ──outbound tunnel──▶ cloudflared (Droplet)
                                                          │
                                                          ▼
                                             nginx :80 (127.0.0.1 only)
                                             │  HTTP Basic Auth gate
                                             ▼
                                     app  (its own login on top)
```

| Layer | What it does |
| ----- | ------------ |
| **Cloudflare Tunnel** (`cloudflared` systemd service) | Holds an **outbound** QUIC connection to Cloudflare. No inbound port is opened for the app. |
| **`ufw` on the Droplet** | Allows **only port 22** (SSH). Ports 80/443 are closed — the public IP serves nothing. |
| **`127.0.0.1:80` bind** | The web container is published only on the Droplet's loopback, so even locally nothing but `cloudflared` can reach it. |
| **HTTP Basic Auth** (nginx, `web/docker-entrypoint.d/40-edge-auth.sh`) | Username/password prompt in front of the **entire** app — you can't even see the login page without it. `/api/health` is the only exception (monitoring). |
| **App login** | The existing account system — a second, independent factor. |

Credentials live in `/opt/taskboard/.env` as `EDGE_AUTH_USER` / `EDGE_AUTH_PASSWORD`;
the nginx entrypoint hashes the password into `/etc/nginx/.htpasswd` at start-up.
Set neither and the gate is off (local dev default).

### Proof that unauthorised users can't get in

```bash
# Direct IP — nothing listening any more
curl -m 5 http://209.38.88.46/            # → connection refused / timeout

# Tunnel URL without credentials
curl -o /dev/null -w '%{http_code}\n' https://ran-stanford-field-sole.trycloudflare.com/
# → 401 Unauthorized

# Tunnel URL with credentials
curl -o /dev/null -w '%{http_code}\n' -u taskboard:<password> https://ran-stanford-field-sole.trycloudflare.com/
# → 200
```

### cloudflared setup on the Droplet

Installed from Cloudflare's apt repo; runs as a systemd service:

```
# /etc/systemd/system/cloudflared.service
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel --url http://localhost:80
Restart=always
```

`systemctl status cloudflared` shows connection health;
`journalctl -u cloudflared` shows the current public URL.

### Rotating the access password

```bash
ssh root@209.38.88.46
cd /opt/taskboard
sed -i 's/^EDGE_AUTH_PASSWORD=.*/EDGE_AUTH_PASSWORD=<new-value>/' .env
docker compose -f docker-compose.prod.yml up -d web
```
