# Learning Tracker — Design Spec
**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

A learning time tracker for a single organization (10–100 users). An admin registers users and captures their faces. Users log in with face recognition. A Chrome browser extension silently monitors all browser activity and verifies the user is physically present via camera. All activity is logged immutably. Admins and users can view weekly analytics dashboards.

**Core constraint:** Logs are immutable. No record can be edited or deleted — enforced at both the API and database levels.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web App + API | Next.js (TypeScript) |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Face Recognition | face-api.js (runs in browser — no 3rd party) |
| Browser Extension | Chrome Extension Manifest V3 |
| Auth | JWT (custom face-based login) |
| Deployment | Single server or Vercel + managed Postgres |

---

## System Architecture

Four pieces that work together:

1. **Browser Extension** — Chrome MV3. Runs as a background service worker. Tracks the active tab (URL + title). Checks camera every 5 seconds for face presence using face-api.js in a content script. Batches activity logs and POSTs to the API every 30 seconds. Pauses if face is absent for 15+ consecutive seconds.

2. **Web App** — Next.js. Four pages: face login, user dashboard, admin dashboard, user registration. Hosts the API routes used by both the UI and the extension.

3. **API** — Next.js API routes (co-located with the web app). Handles face login, log ingestion from the extension, and analytics queries. Log ingestion is INSERT-only — no update or delete routes exist.

4. **Database** — PostgreSQL. Two tables: `users` and `activity_logs`. Row-level security on `activity_logs` blocks UPDATE and DELETE at the database level.

### Data Flow

```
Admin (web)     → registers user + captures face → stores face_descriptor in DB
User (web)      → face login → API matches descriptor → returns JWT
Extension       → stores JWT → monitors tabs + camera → POST logs every 30s
API             → validates JWT → INSERT log rows → DB
Dashboards      → query analytics → display weekly reports
```

### JWT Handoff (Web → Extension)

After face login, the web app pushes the JWT to the extension via `chrome.runtime.sendMessage`. The extension stores it in `chrome.storage.local` and includes it as a Bearer token in all log POSTs. This means the user only authenticates once — on the web login page.

---

## Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Full name |
| phone | TEXT | Contact number |
| role | ENUM | `ADMIN` or `USER` |
| face_descriptor | JSONB | 128-float array from face-api.js |
| created_at | TIMESTAMP | Auto |

### `activity_logs`

INSERT-only. No `updated_at`. Row-level security blocks UPDATE and DELETE.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key → users.id |
| url | TEXT | Full active tab URL |
| tab_title | TEXT | Browser tab title |
| started_at | TIMESTAMP | Window start |
| ended_at | TIMESTAMP | Window end (always started_at + 30s) |
| face_present | BOOLEAN | Was face detected during this window? |
| created_at | TIMESTAMP | Server-side timestamp |

### The 30-Second Window Pattern

Instead of open-ended records, the extension writes one completed row every 30 seconds for the current active tab. This makes every row inherently immutable — there is nothing to update. Analytics sum `ended_at - started_at` across all rows. Maximum data loss on browser crash is 30 seconds.

---

## Face Recognition Flow

### 1. Registration (Admin Panel — `/admin/register`)

1. Admin fills in user's name and phone number
2. Admin opens camera and positions user's face in frame
3. face-api.js detects the face and generates a 128-float descriptor in the browser
4. Descriptor + form data POSTed to `POST /api/admin/users`
5. Face image is discarded immediately — only the descriptor is stored

### 2. Login (Web App — `/login`)

1. User opens `/login` — camera activates automatically
2. face-api.js generates a descriptor from the live video feed in the browser
3. Descriptor POSTed to `POST /api/auth/face-login`
4. Server loads all user descriptors, computes Euclidean distance against each
5. Match if distance < 0.6 → server returns a signed JWT
6. Web app stores JWT in localStorage and pushes it to the extension

### 3. Presence Detection (Extension)

- face-api.js models loaded once at extension startup and cached
- Camera checked every 5 seconds
- If a face is detected → `face_present: true` on the next log batch
- If no face detected for 15 consecutive seconds → logging pauses
- Logging resumes immediately when a face reappears
- Presence check is binary ("is someone there?") — no identity re-verification

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/face-login` | None | Match descriptor, return JWT |
| POST | `/api/logs/batch` | JWT (user) | Ingest activity log batch from extension |
| GET | `/api/analytics/me` | JWT (user) | User's own weekly analytics |
| GET | `/api/analytics/all` | JWT (admin) | All users' weekly analytics |
| POST | `/api/admin/users` | JWT (admin) | Register new user with face descriptor |
| GET | `/api/admin/users` | JWT (admin) | List all users |

All routes validate JWT on every request. Admin routes reject non-admin JWTs with 403. The log batch route accepts an array of log entries and performs bulk INSERT — no updates.

---

## Pages

### `/login`
- Camera activates on load
- face-api.js runs continuously until a match is found
- On match: redirect to `/dashboard` (user) or `/admin` (admin)
- No username/password field — face only

### `/dashboard` (User)
- Weekly summary: total hours, active days, face presence %
- Daily bar chart (Mon–Sun)
- Top sites table by time spent
- Week selector to browse past weeks
- All data read-only — no edit controls

### `/admin` (Admin)
- Org-wide stats: active users, total org hours this week
- User table with hours and face presence % per user
- Click user row → drill into their weekly breakdown
- "Register User" button → `/admin/register`
- Week selector
- All data read-only

### `/admin/register`
- Form: name, phone
- Camera feed for face capture
- Submit → POST to `/api/admin/users`

---

## Browser Extension

### Structure (MV3)

- **Background service worker** — manages the 30-second timer, batches log entries, POSTs to API
- **Content script** — accesses camera via `getUserMedia`, runs face-api.js presence check every 5 seconds, sends result to service worker via `chrome.runtime.sendMessage`
- **Popup** (minimal) — shows current status: logged in / monitoring / paused

### Tab Monitoring

- Listens to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to track the active tab
- When the active tab changes, the current window is closed and queued for the next batch
- New window starts for the new tab

### Distribution

For an internal org, the extension is distributed as a `.crx` file or unpacked folder. Users install it via Chrome's developer mode (`chrome://extensions` → Load unpacked). No Chrome Web Store submission required.

### Permissions Required

- `tabs` — read tab URL and title
- `storage` — store JWT
- `camera` — face presence detection
- Host permission for the web app origin — POST logs to API

---

## Key Constraints

1. **Immutability** — enforced at two levels: no UPDATE/DELETE API routes, and PostgreSQL row-level security on `activity_logs`
2. **Privacy** — face images never stored or transmitted; only 128-float descriptors
3. **No 3rd party biometrics** — all face processing runs in the user's browser via face-api.js
4. **Accuracy** — 15-second grace period before pausing prevents false negatives from brief glances away
5. **Single org** — no multi-tenancy; one admin, one user pool, one database
