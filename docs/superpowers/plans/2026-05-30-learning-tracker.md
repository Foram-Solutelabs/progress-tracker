# Learning Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a learning time tracker with face-based login, immutable browser activity logging via a Chrome MV3 extension, and weekly analytics dashboards for users and admins.

**Architecture:** Next.js 14 (App Router) serves the web UI and API routes. A Chrome MV3 extension tracks active browser tabs and uses an offscreen document + face-api.js to detect face presence every 5 seconds, batching 30-second activity windows to the API. PostgreSQL via Prisma stores users (with face descriptors as float arrays) and append-only activity logs enforced by DB-level triggers.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma 5 + PostgreSQL · face-api.js · jsonwebtoken · Chrome Extension MV3 · esbuild

---

## File Map

```
progress-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # redirect → /login
│   │   ├── login/page.tsx                    # face login (client)
│   │   ├── setup/page.tsx                    # first-run admin bootstrap
│   │   ├── dashboard/page.tsx                # user weekly analytics
│   │   ├── admin/page.tsx                    # admin dashboard
│   │   ├── admin/register/page.tsx           # register new user
│   │   └── api/
│   │       ├── auth/face-login/route.ts
│   │       ├── auth/setup/route.ts           # one-time admin bootstrap
│   │       ├── logs/batch/route.ts
│   │       ├── analytics/me/route.ts
│   │       ├── analytics/all/route.ts
│   │       └── admin/users/route.ts
│   ├── lib/
│   │   ├── prisma.ts                         # Prisma singleton
│   │   ├── auth.ts                           # JWT sign/verify + requireAuth
│   │   ├── face.ts                           # Euclidean distance + findMatch
│   │   └── analytics.ts                     # computeWeeklyAnalytics
│   ├── components/
│   │   ├── FaceCapture.tsx                   # camera + face-api.js (client)
│   │   ├── WeeklyChart.tsx                   # CSS bar chart (client)
│   │   └── WeekPicker.tsx                    # week selector input
│   └── middleware.ts                         # page-level JWT redirect guard
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── <timestamp>_immutable_trigger/    # custom SQL trigger migration
├── public/
│   └── models/                               # face-api.js model weights
├── extension/
│   ├── src/
│   │   ├── types.ts
│   │   ├── background.ts                     # service worker
│   │   ├── offscreen.ts                      # camera + face detection
│   │   ├── content-auth.ts                   # postMessage → extension JWT handoff
│   │   └── popup.ts
│   ├── offscreen.html
│   ├── popup.html
│   ├── manifest.json
│   └── build.js                              # esbuild script
├── tests/
│   ├── lib/auth.test.ts
│   ├── lib/face.test.ts
│   └── lib/analytics.test.ts
├── jest.config.js
└── .env.local
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json` (via CLI)
- Create: `jest.config.js`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd C:\Users\STL-LT-084\progress-tracker
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --no-git
```

Expected: Next.js project created in current directory.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install jsonwebtoken face-api.js @tensorflow/tfjs
npm install --save-dev @types/jsonwebtoken jest @types/jest ts-jest jest-environment-node esbuild prisma @prisma/client
```

- [ ] **Step 3: Write jest.config.js**

```js
// jest.config.js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
})
```

- [ ] **Step 4: Write .env.local**

```bash
# .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/learning_tracker"
JWT_SECRET="change-this-to-a-long-random-string-in-production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 5: Update .gitignore to exclude env and models**

Append to `.gitignore`:
```
.env.local
public/models/
extension/dist/
.superpowers/
```

- [ ] **Step 6: Create PostgreSQL database**

```bash
psql -U postgres -c "CREATE DATABASE learning_tracker;"
```

Expected: `CREATE DATABASE`

- [ ] **Step 7: Commit**

```bash
git init
git add jest.config.js package.json tsconfig.json .gitignore next.config.mjs tailwind.config.ts postcss.config.mjs
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Prisma Schema + Immutability Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: `prisma/schema.prisma` created.

- [ ] **Step 2: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

model User {
  id             String        @id @default(uuid())
  name           String
  phone          String
  role           Role          @default(USER)
  faceDescriptor Float[]
  createdAt      DateTime      @default(now())
  activityLogs   ActivityLog[]
}

model ActivityLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  url         String
  tabTitle    String
  startedAt   DateTime
  endedAt     DateTime
  facePresent Boolean
  createdAt   DateTime @default(now())

  @@index([userId, startedAt])
}
```

- [ ] **Step 3: Run initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration files created under `prisma/migrations/`, Prisma client generated.

- [ ] **Step 4: Create immutability trigger migration**

```bash
npx prisma migrate dev --name immutable_logs_trigger --create-only
```

Open the new migration file at `prisma/migrations/<timestamp>_immutable_logs_trigger/migration.sql` and replace its contents with:

```sql
CREATE OR REPLACE FUNCTION prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_activity_logs
BEFORE UPDATE ON "ActivityLog"
FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();

CREATE TRIGGER no_delete_activity_logs
BEFORE DELETE ON "ActivityLog"
FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();
```

- [ ] **Step 5: Apply the trigger migration**

```bash
npx prisma migrate dev
```

Expected: Trigger migration applied, no errors.

- [ ] **Step 6: Write src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add Prisma schema with immutable activity_logs trigger"
```

---

## Task 3: Auth Library + Tests

**Files:**
- Create: `src/lib/auth.ts`
- Create: `tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/auth.test.ts
import { signToken, verifyToken, requireAuth } from '@/lib/auth'

describe('auth', () => {
  const payload = { userId: 'abc-123', role: 'USER' as const }

  test('signToken returns a string', () => {
    const token = signToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)
  })

  test('verifyToken returns original payload', () => {
    const token = signToken(payload)
    const result = verifyToken(token)
    expect(result.userId).toBe(payload.userId)
    expect(result.role).toBe(payload.role)
  })

  test('verifyToken throws on invalid token', () => {
    expect(() => verifyToken('bad.token.here')).toThrow()
  })

  test('requireAuth returns payload for valid Bearer token', () => {
    const token = signToken(payload)
    const req = new Request('http://localhost', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = requireAuth(req)
    expect(result).not.toBeInstanceOf(Response)
    if (!(result instanceof Response)) {
      expect(result.userId).toBe(payload.userId)
    }
  })

  test('requireAuth returns payload from middleware-set headers (browser fetch path)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-user-id': 'abc-123', 'x-user-role': 'USER' }
    })
    const result = requireAuth(req)
    expect(result).not.toBeInstanceOf(Response)
    if (!(result instanceof Response)) {
      expect(result.userId).toBe('abc-123')
      expect(result.role).toBe('USER')
    }
  })

  test('requireAuth returns 401 Response for missing token', () => {
    const req = new Request('http://localhost')
    const result = requireAuth(req)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(401)
    }
  })

  test('requireAuth returns 403 for non-admin accessing admin route', () => {
    const token = signToken({ userId: 'abc', role: 'USER' })
    const req = new Request('http://localhost', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = requireAuth(req, 'ADMIN')
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(403)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/lib/auth.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Write src/lib/auth.ts**

```typescript
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

export type JWTPayload = {
  userId: string
  role: 'ADMIN' | 'USER'
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload
}

// requireAuth handles two paths:
// 1. Browser fetch from client components — middleware injects x-user-id/x-user-role headers
// 2. Extension API calls — sends Authorization: Bearer <token>
export function requireAuth(
  request: Request,
  requiredRole?: 'ADMIN' | 'USER'
): JWTPayload | Response {
  // Path 1: middleware-authenticated (browser fetch, cookie already validated)
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as 'ADMIN' | 'USER' | null
  if (userId && role) {
    if (requiredRole === 'ADMIN' && role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return { userId, role }
  }

  // Path 2: direct Bearer token (extension)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (requiredRole === 'ADMIN' && payload.role !== 'ADMIN') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return payload
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/lib/auth.test.ts --no-coverage
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat: add JWT auth lib with sign, verify, requireAuth"
```

---

## Task 4: Face Matching Library + Tests

**Files:**
- Create: `src/lib/face.ts`
- Create: `tests/lib/face.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/face.test.ts
import { euclideanDistance, findMatch } from '@/lib/face'

const makeDescriptor = (base: number, length = 128) =>
  Array.from({ length }, (_, i) => base + i * 0.001)

describe('euclideanDistance', () => {
  test('returns 0 for identical descriptors', () => {
    const a = makeDescriptor(0)
    expect(euclideanDistance(a, a)).toBeCloseTo(0)
  })

  test('returns positive value for different descriptors', () => {
    const a = makeDescriptor(0)
    const b = makeDescriptor(1)
    expect(euclideanDistance(a, b)).toBeGreaterThan(0)
  })
})

describe('findMatch', () => {
  const desc = makeDescriptor(0)

  test('returns userId for close match', () => {
    const users = [
      { id: 'user-1', faceDescriptor: makeDescriptor(0.001) },
      { id: 'user-2', faceDescriptor: makeDescriptor(5) },
    ]
    const result = findMatch(desc, users)
    expect(result).toBe('user-1')
  })

  test('returns null when no descriptor is within threshold', () => {
    const users = [
      { id: 'user-1', faceDescriptor: makeDescriptor(5) },
    ]
    expect(findMatch(desc, users)).toBeNull()
  })

  test('returns null for empty user list', () => {
    expect(findMatch(desc, [])).toBeNull()
  })

  test('returns closest match when multiple are within threshold', () => {
    const users = [
      { id: 'user-far', faceDescriptor: makeDescriptor(0.3) },
      { id: 'user-close', faceDescriptor: makeDescriptor(0.001) },
    ]
    expect(findMatch(desc, users)).toBe('user-close')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/lib/face.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/face'`

- [ ] **Step 3: Write src/lib/face.ts**

```typescript
const MATCH_THRESHOLD = 0.6

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0))
}

export function findMatch(
  descriptor: number[],
  users: { id: string; faceDescriptor: number[] }[]
): string | null {
  let bestId: string | null = null
  let bestDistance = Infinity

  for (const user of users) {
    const distance = euclideanDistance(descriptor, user.faceDescriptor)
    if (distance < MATCH_THRESHOLD && distance < bestDistance) {
      bestDistance = distance
      bestId = user.id
    }
  }

  return bestId
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/lib/face.test.ts --no-coverage
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/face.ts tests/lib/face.test.ts
git commit -m "feat: add face descriptor matching with Euclidean distance"
```

---

## Task 5: Analytics Library + Tests

**Files:**
- Create: `src/lib/analytics.ts`
- Create: `tests/lib/analytics.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/analytics.test.ts
import { computeWeeklyAnalytics } from '@/lib/analytics'

const monday = new Date('2026-05-25T00:00:00.000Z')

function makeLog(offsetDays: number, durationSecs: number, facePresent = true, url = 'https://youtube.com/watch') {
  const startedAt = new Date(monday.getTime() + offsetDays * 86400_000)
  const endedAt = new Date(startedAt.getTime() + durationSecs * 1000)
  return { url, tabTitle: 'Video', startedAt, endedAt, facePresent }
}

describe('computeWeeklyAnalytics', () => {
  test('returns zeros for empty logs', () => {
    const result = computeWeeklyAnalytics([], monday)
    expect(result.totalSeconds).toBe(0)
    expect(result.activeDays).toBe(0)
    expect(result.facePresencePercent).toBe(0)
    expect(result.dailyBreakdown).toHaveLength(7)
    expect(result.topSites).toHaveLength(0)
  })

  test('totals seconds correctly', () => {
    const logs = [makeLog(0, 30), makeLog(0, 30)]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.totalSeconds).toBe(60)
  })

  test('counts active days', () => {
    const logs = [makeLog(0, 30), makeLog(0, 30), makeLog(2, 30)]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.activeDays).toBe(2)
  })

  test('computes face presence percent', () => {
    const logs = [makeLog(0, 30, true), makeLog(0, 30, false), makeLog(0, 30, false)]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.facePresencePercent).toBe(33)
  })

  test('produces 7 days in dailyBreakdown', () => {
    const logs = [makeLog(1, 120)]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.dailyBreakdown).toHaveLength(7)
    expect(result.dailyBreakdown[1].seconds).toBe(120)
    expect(result.dailyBreakdown[0].seconds).toBe(0)
  })

  test('groups top sites by domain', () => {
    const logs = [
      makeLog(0, 300, true, 'https://youtube.com/watch?v=1'),
      makeLog(0, 200, true, 'https://youtube.com/watch?v=2'),
      makeLog(0, 100, true, 'https://coursera.org/learn/x'),
    ]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.topSites[0].domain).toBe('youtube.com')
    expect(result.topSites[0].seconds).toBe(500)
    expect(result.topSites[1].domain).toBe('coursera.org')
  })

  test('strips www. from domains', () => {
    const logs = [makeLog(0, 30, true, 'https://www.youtube.com/watch')]
    const result = computeWeeklyAnalytics(logs, monday)
    expect(result.topSites[0].domain).toBe('youtube.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/lib/analytics.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/analytics'`

- [ ] **Step 3: Write src/lib/analytics.ts**

```typescript
type LogEntry = {
  url: string
  tabTitle: string
  startedAt: Date
  endedAt: Date
  facePresent: boolean
}

export type WeeklyAnalytics = {
  totalSeconds: number
  activeDays: number
  facePresencePercent: number
  dailyBreakdown: { date: string; seconds: number }[]
  topSites: { domain: string; seconds: number }[]
}

export function computeWeeklyAnalytics(logs: LogEntry[], weekStart: Date): WeeklyAnalytics {
  if (logs.length === 0) {
    return {
      totalSeconds: 0,
      activeDays: 0,
      facePresencePercent: 0,
      dailyBreakdown: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setUTCDate(d.getUTCDate() + i)
        return { date: d.toISOString().split('T')[0], seconds: 0 }
      }),
      topSites: [],
    }
  }

  const duration = (log: LogEntry) =>
    (log.endedAt.getTime() - log.startedAt.getTime()) / 1000

  const totalSeconds = logs.reduce((sum, l) => sum + duration(l), 0)

  const activeDays = new Set(
    logs.map(l => l.startedAt.toISOString().split('T')[0])
  ).size

  const facePresencePercent = Math.round(
    (logs.filter(l => l.facePresent).length / logs.length) * 100
  )

  const dailyMap = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setUTCDate(d.getUTCDate() + i)
    dailyMap.set(d.toISOString().split('T')[0], 0)
  }
  logs.forEach(l => {
    const day = l.startedAt.toISOString().split('T')[0]
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + duration(l))
    }
  })
  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, seconds]) => ({ date, seconds }))

  const siteMap = new Map<string, number>()
  logs.forEach(l => {
    try {
      const domain = new URL(l.url).hostname.replace(/^www\./, '')
      siteMap.set(domain, (siteMap.get(domain) ?? 0) + duration(l))
    } catch { /* skip malformed URLs */ }
  })
  const topSites = Array.from(siteMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, seconds]) => ({ domain, seconds }))

  return { totalSeconds, activeDays, facePresencePercent, dailyBreakdown, topSites }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/lib/analytics.test.ts --no-coverage
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 19 tests passing across 3 suites.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts tests/lib/analytics.test.ts
git commit -m "feat: add weekly analytics computation"
```

---

## Task 6: API — Face Login + Setup

**Files:**
- Create: `src/app/api/auth/face-login/route.ts`
- Create: `src/app/api/auth/setup/route.ts`

- [ ] **Step 1: Write src/app/api/auth/face-login/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { findMatch } from '@/lib/face'

export async function POST(request: Request) {
  const body = await request.json()
  const descriptor: number[] = body.descriptor

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json({ error: 'Invalid descriptor' }, { status: 400 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, faceDescriptor: true },
  })

  const matchId = findMatch(descriptor, users)

  if (!matchId) {
    return NextResponse.json({ error: 'Face not recognised' }, { status: 401 })
  }

  const user = users.find(u => u.id === matchId)!
  const token = signToken({ userId: user.id, role: user.role as 'ADMIN' | 'USER' })

  const response = NextResponse.json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
  })

  response.cookies.set('lt_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return response
}
```

- [ ] **Step 2: Write src/app/api/auth/setup/route.ts**

This route creates the first admin. Only works when no users exist.

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(request: Request) {
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 403 })
  }

  const { name, phone, descriptor } = await request.json()

  if (!name || !phone || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json({ error: 'Invalid setup data' }, { status: 400 })
  }

  const admin = await prisma.user.create({
    data: { name, phone, role: 'ADMIN', faceDescriptor: descriptor },
  })

  const token = signToken({ userId: admin.id, role: 'ADMIN' })

  const response = NextResponse.json({
    token,
    user: { id: admin.id, name: admin.name, role: admin.role },
  })

  response.cookies.set('lt_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return response
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: add face-login and first-run setup API routes"
```

---

## Task 7: Middleware (Route Guard)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write src/middleware.ts**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC = ['/login', '/setup', '/api/auth/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('lt_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const payload = verifyToken(token)

    if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const headers = new Headers(request.headers)
    headers.set('x-user-id', payload.userId)
    headers.set('x-user-role', payload.role)

    return NextResponse.next({ request: { headers } })
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware JWT route guard"
```

---

## Task 8: API — Admin Users

**Files:**
- Create: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: Write src/app/api/admin/users/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth

  const { name, phone, descriptor } = await request.json()

  if (!name || !phone || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const user = await prisma.user.create({
    data: { name, phone, role: 'USER', faceDescriptor: descriptor },
    select: { id: true, name: true, phone: true, role: true, createdAt: true },
  })

  return NextResponse.json({ user }, { status: 201 })
}

export async function GET(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth

  const users = await prisma.user.findMany({
    select: { id: true, name: true, phone: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ users })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/users/route.ts
git commit -m "feat: add admin user registration and listing API"
```

---

## Task 9: API — Log Batch Ingestion

**Files:**
- Create: `src/app/api/logs/batch/route.ts`

- [ ] **Step 1: Write src/app/api/logs/batch/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type LogEntry = {
  url: string
  tabTitle: string
  startedAt: string
  endedAt: string
  facePresent: boolean
}

export async function POST(request: Request) {
  const auth = requireAuth(request)
  if (auth instanceof Response) return auth

  const { logs }: { logs: LogEntry[] } = await request.json()

  if (!Array.isArray(logs) || logs.length === 0) {
    return NextResponse.json({ error: 'No logs provided' }, { status: 400 })
  }

  await prisma.activityLog.createMany({
    data: logs.map(log => ({
      userId: auth.userId,
      url: log.url,
      tabTitle: log.tabTitle,
      startedAt: new Date(log.startedAt),
      endedAt: new Date(log.endedAt),
      facePresent: log.facePresent,
    })),
  })

  return NextResponse.json({ ok: true, count: logs.length })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/logs/batch/route.ts
git commit -m "feat: add activity log batch ingestion endpoint"
```

---

## Task 10: API — Analytics

**Files:**
- Create: `src/app/api/analytics/me/route.ts`
- Create: `src/app/api/analytics/all/route.ts`

- [ ] **Step 1: Write src/app/api/analytics/me/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeWeeklyAnalytics } from '@/lib/analytics'

export async function GET(request: Request) {
  const auth = requireAuth(request)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart')
    ? new Date(searchParams.get('weekStart')!)
    : getMonday(new Date())

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const logs = await prisma.activityLog.findMany({
    where: {
      userId: auth.userId,
      startedAt: { gte: weekStart, lt: weekEnd },
    },
    select: { url: true, tabTitle: true, startedAt: true, endedAt: true, facePresent: true },
  })

  return NextResponse.json(computeWeeklyAnalytics(logs, weekStart))
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

- [ ] **Step 2: Write src/app/api/analytics/all/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeWeeklyAnalytics } from '@/lib/analytics'

export async function GET(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart')
    ? new Date(searchParams.get('weekStart')!)
    : getMonday(new Date())

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: {
      id: true,
      name: true,
      activityLogs: {
        where: { startedAt: { gte: weekStart, lt: weekEnd } },
        select: { url: true, tabTitle: true, startedAt: true, endedAt: true, facePresent: true },
      },
    },
  })

  const result = users.map(user => ({
    userId: user.id,
    name: user.name,
    analytics: computeWeeklyAnalytics(user.activityLogs, weekStart),
  }))

  return NextResponse.json({ weekStart: weekStart.toISOString(), users: result })
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analytics/
git commit -m "feat: add per-user and org-wide weekly analytics API"
```

---

## Task 11: Face-api.js Models + FaceCapture Component

**Files:**
- Create: `scripts/download-models.sh`
- Create: `public/models/` (populated by script)
- Create: `src/components/FaceCapture.tsx`

- [ ] **Step 1: Download face-api.js model weights**

```bash
mkdir -p public/models

# Download the 3 required model manifests + shard weights from face-api.js CDN
$models = @(
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "face_landmark_68_model-weights_manifest.json", 
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2"
)
$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
foreach ($m in $models) {
  Invoke-WebRequest "$base/$m" -OutFile "public/models/$m"
}
```

Run this in PowerShell. Expected: 7 files downloaded to `public/models/`.

- [ ] **Step 2: Write src/components/FaceCapture.tsx**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'

interface FaceCaptureProps {
  onDescriptor: (descriptor: number[]) => void
  autoCapture?: boolean
  label?: string
}

export function FaceCapture({ onDescriptor, autoCapture = false, label }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'detecting' | 'captured' | 'error'>('loading')
  const [faceapi, setFaceapi] = useState<typeof import('face-api.js') | null>(null)

  useEffect(() => {
    async function init() {
      const api = await import('face-api.js')
      await api.nets.ssdMobilenetv1.loadFromUri('/models')
      await api.nets.faceLandmark68Net.loadFromUri('/models')
      await api.nets.faceRecognitionNet.loadFromUri('/models')
      setFaceapi(api)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStatus('ready')
        }
      } catch {
        setStatus('error')
      }
    }
    init()
    return () => {
      const video = videoRef.current
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  async function detect() {
    if (!faceapi || !videoRef.current) return null
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    return detection ? Array.from(detection.descriptor) : null
  }

  async function handleCapture() {
    setStatus('detecting')
    const descriptor = await detect()
    if (!descriptor) { setStatus('ready'); return }
    setStatus('captured')
    onDescriptor(descriptor)
  }

  useEffect(() => {
    if (!autoCapture || status !== 'ready') return
    const interval = setInterval(async () => {
      const descriptor = await detect()
      if (descriptor) {
        clearInterval(interval)
        onDescriptor(descriptor)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [status, autoCapture])

  const statusText = {
    loading: 'Loading face models…',
    ready: autoCapture ? 'Position your face in the camera' : 'Camera ready',
    detecting: 'Detecting face…',
    captured: 'Face captured',
    error: 'Camera access denied',
  }[status]

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-sm text-gray-400">{label}</p>}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={320}
        height={240}
        className="rounded-xl border border-gray-700 bg-black"
      />
      <p className="text-sm text-gray-400">{statusText}</p>
      {!autoCapture && status === 'ready' && (
        <button
          onClick={handleCapture}
          className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
        >
          Capture Face
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add public/models/ src/components/FaceCapture.tsx
git commit -m "feat: add FaceCapture component with face-api.js"
```

---

## Task 12: Shared Layout + Root Redirect

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write src/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Learning Tracker',
  description: 'Track your learning time',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Write src/app/page.tsx**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add root layout and redirect to login"
```

---

## Task 13: Setup Page (First-Run Admin Bootstrap)

**Files:**
- Create: `src/app/setup/page.tsx`

- [ ] **Step 1: Write src/app/setup/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaceCapture } from '@/components/FaceCapture'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [descriptor, setDescriptor] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!name || !phone || !descriptor) {
      setError('Please fill all fields and capture your face.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, descriptor }),
    })
    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Setup failed')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">First-Time Setup</h1>
          <p className="text-gray-400 text-sm mt-1">Create the admin account to get started.</p>
        </div>

        <input
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          placeholder="Full name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          placeholder="Phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />

        <FaceCapture
          onDescriptor={d => setDescriptor(d)}
          label={descriptor ? '✓ Face captured' : 'Capture admin face'}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {loading ? 'Creating admin…' : 'Create Admin Account'}
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: add first-run admin setup page"
```

---

## Task 14: Login Page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Write src/app/login/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FaceCapture } from '@/components/FaceCapture'

export default function LoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'matching' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDescriptor(descriptor: number[]) {
    setStatus('matching')
    const res = await fetch('/api/auth/face-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor }),
    })

    if (!res.ok) {
      setStatus('error')
      setErrorMsg('Face not recognised. Try again.')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    const { token, user } = await res.json()

    // Send JWT + user name to the extension via postMessage (picked up by content-auth.ts)
    window.postMessage({ type: 'LT_SET_TOKEN', token, userName: user.name }, window.location.origin)

    router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm w-full px-4">
        <div>
          <h1 className="text-3xl font-bold">Learning Tracker</h1>
          <p className="text-gray-400 mt-2">Look at the camera to sign in</p>
        </div>

        {status !== 'matching' && (
          <FaceCapture onDescriptor={handleDescriptor} autoCapture label="" />
        )}

        {status === 'matching' && (
          <div className="py-10 text-indigo-400">Matching face…</div>
        )}

        {status === 'error' && (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add face login page with extension JWT handoff"
```

---

## Task 15: Dashboard Components + User Dashboard

**Files:**
- Create: `src/components/WeeklyChart.tsx`
- Create: `src/components/WeekPicker.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write src/components/WeeklyChart.tsx**

```typescript
'use client'

type Day = { date: string; seconds: number }

export function WeeklyChart({ days }: { days: Day[] }) {
  const maxSeconds = Math.max(...days.map(d => d.seconds), 1)

  return (
    <div className="flex items-end gap-2 h-32">
      {days.map(day => {
        const heightPct = (day.seconds / maxSeconds) * 100
        const label = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short' })
        const hours = (day.seconds / 3600).toFixed(1)
        return (
          <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-gray-500">{day.seconds > 0 ? `${hours}h` : ''}</span>
            <div
              className="w-full rounded-t-md bg-indigo-600 transition-all"
              style={{ height: `${Math.max(heightPct, day.seconds > 0 ? 4 : 0)}%` }}
            />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Write src/components/WeekPicker.tsx**

```typescript
'use client'

export function WeekPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (iso: string) => void
}) {
  return (
    <input
      type="week"
      value={toWeekInput(value)}
      onChange={e => onChange(fromWeekInput(e.target.value))}
      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
    />
  )
}

function toWeekInput(isoMonday: string): string {
  const d = new Date(isoMonday)
  const year = d.getUTCFullYear()
  const week = getISOWeekNumber(d)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function fromWeekInput(weekStr: string): string {
  const [yearStr, weekPart] = weekStr.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekPart)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const startOfWeek1 = new Date(jan4.getTime() - (jan4.getUTCDay() || 7 - 1) * 86400_000)
  const monday = new Date(startOfWeek1.getTime() + (week - 1) * 7 * 86400_000)
  return monday.toISOString().split('T')[0]
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7)
}
```

- [ ] **Step 3: Write src/app/dashboard/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { WeeklyChart } from '@/components/WeeklyChart'
import { WeekPicker } from '@/components/WeekPicker'
import type { WeeklyAnalytics } from '@/lib/analytics'

function getThisMonday(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [data, setData] = useState<WeeklyAnalytics | null>(null)

  useEffect(() => {
    fetch(`/api/analytics/me?weekStart=${weekStart}`)
      .then(r => r.json())
      .then(setData)
  }, [weekStart])

  const totalHours = data ? (data.totalSeconds / 3600).toFixed(1) : '—'

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Learning</h1>
        <WeekPicker value={weekStart} onChange={setWeekStart} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total this week', value: `${totalHours}h`, color: 'text-indigo-400' },
          { label: 'Active days', value: data?.activeDays ?? '—', color: 'text-green-400' },
          { label: 'Face present', value: data ? `${data.facePresencePercent}%` : '—', color: 'text-orange-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {data && (
        <div className="bg-gray-900 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Daily Hours</h2>
          <WeeklyChart days={data.dailyBreakdown} />
        </div>
      )}

      {data && data.topSites.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Sites</h2>
          <div className="space-y-2">
            {data.topSites.map(site => (
              <div key={site.domain} className="flex justify-between text-sm">
                <span className="text-gray-300">{site.domain}</span>
                <span className="text-gray-500">{(site.seconds / 3600).toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <a
          href="/api/auth/logout"
          className="text-sm text-gray-500 hover:text-gray-300"
          onClick={async e => {
            e.preventDefault()
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
        >
          Sign out
        </a>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Add logout route**

Create `src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('lt_token')
  return response
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/dashboard/ src/app/api/auth/logout/
git commit -m "feat: add user dashboard with weekly chart and top sites"
```

---

## Task 16: Admin Register + Admin Dashboard Pages

**Files:**
- Create: `src/app/admin/register/page.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Write src/app/admin/register/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaceCapture } from '@/components/FaceCapture'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [descriptor, setDescriptor] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    if (!name || !phone || !descriptor) {
      setError('Fill all fields and capture the user face.')
      return
    }
    setLoading(true)
    const token = document.cookie.match(/lt_token=([^;]+)/)?.[1] ?? ''
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, phone, descriptor }),
    })
    if (res.ok) {
      setSuccess(`${name} registered successfully.`)
      setName('')
      setPhone('')
      setDescriptor(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white">← Back</button>
        <h1 className="text-2xl font-bold">Register User</h1>
      </div>

      <input
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
        placeholder="Full name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
        placeholder="Phone number"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />

      <FaceCapture
        onDescriptor={d => setDescriptor(d)}
        label={descriptor ? '✓ Face captured — capture again to replace' : 'Capture user face'}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
      >
        {loading ? 'Registering…' : 'Register User'}
      </button>
    </main>
  )
}
```

- [ ] **Step 2: Write src/app/admin/page.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekPicker } from '@/components/WeekPicker'

type UserRow = {
  userId: string
  name: string
  analytics: {
    totalSeconds: number
    facePresencePercent: number
  }
}

function getThisMonday(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export default function AdminPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [users, setUsers] = useState<UserRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/analytics/all?weekStart=${weekStart}`)
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
  }, [weekStart])

  const totalOrgHours = users
    .reduce((sum, u) => sum + u.analytics.totalSeconds, 0)
  const activeUsers = users.filter(u => u.analytics.totalSeconds > 0).length

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-3">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <button
            onClick={() => router.push('/admin/register')}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            + Register User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-indigo-400">{activeUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Active users</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{(totalOrgHours / 3600).toFixed(1)}h</p>
          <p className="text-xs text-gray-500 mt-1">Total org hours</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-3 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
          <span>Name</span>
          <span className="text-right">Hours</span>
          <span className="text-right">Face %</span>
        </div>
        {users.map(u => (
          <div
            key={u.userId}
            onClick={() => setSelected(selected === u.userId ? null : u.userId)}
            className="grid grid-cols-3 px-4 py-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <span className="font-medium">{u.name}</span>
            <span className="text-right text-indigo-400">
              {(u.analytics.totalSeconds / 3600).toFixed(1)}h
            </span>
            <span className="text-right text-green-400">
              {u.analytics.facePresencePercent}%
            </span>
          </div>
        ))}
      </div>

      <div className="text-center pt-4">
        <button
          className="text-sm text-gray-500 hover:text-gray-300"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/
git commit -m "feat: add admin register and dashboard pages"
```

---

## Task 17: Start Dev Server + Smoke Test Web App

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Server running on `http://localhost:3000`.

- [ ] **Step 2: Verify setup flow**

Navigate to `http://localhost:3000/setup`. Fill name, phone, capture face, submit. Expected: Redirect to `/admin`.

- [ ] **Step 3: Verify login flow**

Sign out, navigate to `http://localhost:3000/login`. Look at camera. Expected: Face detected → redirect to `/admin` (since you created an admin).

- [ ] **Step 4: Register a test user**

On `/admin`, click `+ Register User`. Fill name, phone, capture face, submit. Expected: Success message.

- [ ] **Step 5: Verify user dashboard**

Sign out, log in as the test user. Expected: Redirect to `/dashboard`. All stats show 0 (no logs yet). Week picker works.

- [ ] **Step 6: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

## Task 18: Extension Scaffold

**Files:**
- Create: `extension/src/types.ts`
- Create: `extension/manifest.json`
- Create: `extension/offscreen.html`
- Create: `extension/popup.html`
- Create: `extension/build.js`
- Create: `extension/package.json`

- [ ] **Step 1: Create extension/src/types.ts**

```typescript
export type LogEntry = {
  url: string
  tabTitle: string
  startedAt: string  // ISO string
  endedAt: string    // ISO string
  facePresent: boolean
}

export type MessageToBackground =
  | { type: 'FACE_RESULT'; present: boolean }
  | { type: 'SET_TOKEN'; token: string; userName: string }

export type MessageToOffscreen =
  | { type: 'START_DETECTION' }
  | { type: 'STOP_DETECTION' }
```

- [ ] **Step 2: Create extension/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Learning Tracker",
  "version": "1.0.0",
  "description": "Tracks your learning time and verifies your presence.",
  "permissions": ["tabs", "storage", "offscreen"],
  "host_permissions": [
    "http://localhost:3000/*"
  ],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["http://localhost:3000/*"],
      "js": ["dist/content-auth.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Learning Tracker"
  }
}
```

- [ ] **Step 3: Create extension/offscreen.html**

```html
<!DOCTYPE html>
<html>
  <head><title>LT Offscreen</title></head>
  <body>
    <video id="video" autoplay muted playsinline style="display:none;width:160px;height:120px"></video>
    <canvas id="canvas" style="display:none;width:160px;height:120px"></canvas>
    <script src="dist/offscreen.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create extension/popup.html**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { width: 220px; padding: 16px; font-family: system-ui, sans-serif; background: #0f0f14; color: #e5e7eb; margin: 0; }
      .status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .dot.green { background: #22c55e; }
      .dot.yellow { background: #eab308; }
      .dot.gray { background: #6b7280; }
      p { margin: 4px 0; font-size: 13px; color: #9ca3af; }
      strong { color: #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="status">
      <div class="dot" id="dot"></div>
      <strong id="status-text">Loading…</strong>
    </div>
    <p id="user-name"></p>
    <p id="today-hours"></p>
    <script src="dist/popup.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create extension/build.js**

```javascript
const esbuild = require('esbuild')
const path = require('path')

const entries = [
  'src/background.ts',
  'src/offscreen.ts',
  'src/content-auth.ts',
  'src/popup.ts',
]

for (const entry of entries) {
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, entry)],
    bundle: true,
    outdir: path.join(__dirname, 'dist'),
    format: 'esm',
    platform: 'browser',
    target: ['chrome112'],
    external: [],
    define: { 'process.env.NODE_ENV': '"production"' },
  })
}

console.log('Extension built to extension/dist/')
```

- [ ] **Step 6: Create extension/package.json**

```json
{
  "name": "learning-tracker-extension",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "watch": "node -e \"const e=require('esbuild'); const entries=['src/background.ts','src/offscreen.ts','src/content-auth.ts','src/popup.ts']; entries.forEach(entry => e.context({entryPoints:[entry],bundle:true,outdir:'dist',format:'esm',platform:'browser'}).then(ctx => ctx.watch()))\""
  },
  "devDependencies": {
    "esbuild": "^0.21.0",
    "@types/chrome": "^0.0.268",
    "typescript": "^5.4.0",
    "face-api.js": "^0.22.2",
    "@tensorflow/tfjs": "^4.0.0"
  }
}
```

- [ ] **Step 7: Install extension dependencies**

```bash
cd extension && npm install && cd ..
```

- [ ] **Step 8: Commit**

```bash
git add extension/
git commit -m "feat: add Chrome extension scaffold (manifest, html, build)"
```

---

## Task 19: Extension Background Service Worker

**Files:**
- Create: `extension/src/background.ts`

- [ ] **Step 1: Write extension/src/background.ts**

```typescript
import type { LogEntry, MessageToBackground } from './types'

const API_BASE = 'http://localhost:3000'
const BATCH_INTERVAL_MS = 30_000
const FACE_CHECK_INTERVAL_MS = 5_000
const FACE_PAUSE_THRESHOLD_MS = 15_000

let token: string | null = null
let currentTab: { url: string; title: string; startedAt: number } | null = null
let faceLastSeen = Date.now()
let facePresent = true
let pendingLogs: LogEntry[] = []
let offscreenCreated = false

// --- Startup ---

chrome.runtime.onStartup.addListener(init)
chrome.runtime.onInstalled.addListener(init)

async function init() {
  const stored = await chrome.storage.local.get('token')
  if (stored.token) {
    token = stored.token
    await ensureOffscreen()
  }
}

// --- Token management (from content-auth.ts) ---

chrome.runtime.onMessage.addListener((msg: MessageToBackground) => {
  if (msg.type === 'SET_TOKEN') {
    token = msg.token
    chrome.storage.local.set({ token: msg.token })
    ensureOffscreen()
  }

  if (msg.type === 'FACE_RESULT') {
    if (msg.present) {
      faceLastSeen = Date.now()
      facePresent = true
    } else {
      facePresent = Date.now() - faceLastSeen < FACE_PAUSE_THRESHOLD_MS
    }
  }
})

// --- Offscreen document ---

async function ensureOffscreen() {
  if (offscreenCreated) return
  const existing = await chrome.offscreen.hasDocument?.()
  if (existing) { offscreenCreated = true; return }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
    justification: 'Face presence detection via camera',
  })
  offscreenCreated = true
}

// --- Tab tracking ---

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  closeCurrentWindow()
  const tab = await chrome.tabs.get(tabId)
  if (tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = { url: tab.url, title: tab.title ?? '', startedAt: Date.now() }
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (!tab.active) return
  closeCurrentWindow()
  if (tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = { url: tab.url, title: tab.title ?? '', startedAt: Date.now() }
  }
})

chrome.tabs.onRemoved.addListener(() => closeCurrentWindow())

function closeCurrentWindow() {
  if (!currentTab || !facePresent) { currentTab = null; return }
  const now = Date.now()
  const startedAt = new Date(currentTab.startedAt).toISOString()
  const endedAt = new Date(now).toISOString()
  pendingLogs.push({
    url: currentTab.url,
    tabTitle: currentTab.title,
    startedAt,
    endedAt,
    facePresent: true,
  })
  currentTab = null
}

// --- 30-second batch flush ---

setInterval(async () => {
  if (!token || !facePresent) return

  // snapshot current tab window
  if (currentTab) {
    const now = Date.now()
    const startedAt = new Date(currentTab.startedAt).toISOString()
    const endedAt = new Date(now).toISOString()
    pendingLogs.push({
      url: currentTab.url,
      tabTitle: currentTab.title,
      startedAt,
      endedAt,
      facePresent: true,
    })
    currentTab = { ...currentTab, startedAt: now }
  }

  if (pendingLogs.length === 0) return

  const batch = [...pendingLogs]
  pendingLogs = []

  try {
    await fetch(`${API_BASE}/api/logs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logs: batch }),
    })
  } catch {
    // Re-queue on network failure
    pendingLogs = [...batch, ...pendingLogs]
  }
}, BATCH_INTERVAL_MS)
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/background.ts
git commit -m "feat: add extension background service worker (tab tracking + log batching)"
```

---

## Task 20: Extension Offscreen + Content Auth + Popup + Build

**Files:**
- Create: `extension/src/offscreen.ts`
- Create: `extension/src/content-auth.ts`
- Create: `extension/src/popup.ts`

- [ ] **Step 1: Write extension/src/offscreen.ts**

This runs inside the offscreen document (has DOM + camera access).

```typescript
import * as faceapi from 'face-api.js'

const VIDEO_ID = 'video'
const MODELS_URL = 'http://localhost:3000/models'
const CHECK_INTERVAL_MS = 5_000

let ready = false

async function init() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL)
  ready = true

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } })
  } catch {
    // Camera denied — report absent indefinitely
    setInterval(() => chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: false }), CHECK_INTERVAL_MS)
    return
  }

  const video = document.getElementById(VIDEO_ID) as HTMLVideoElement
  video.srcObject = stream

  setInterval(async () => {
    if (!ready) return
    try {
      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      )
      chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: !!detection })
    } catch {
      chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: false })
    }
  }, CHECK_INTERVAL_MS)
}

init()
```

- [ ] **Step 2: Write extension/src/content-auth.ts**

Injected only on the web app origin. Bridges `window.postMessage` → extension background.

```typescript
window.addEventListener('message', event => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (event.data?.type !== 'LT_SET_TOKEN') return
  chrome.runtime.sendMessage({
    type: 'SET_TOKEN',
    token: event.data.token,
    userName: event.data.userName ?? '',
  })
})
```

- [ ] **Step 3: Write extension/src/popup.ts**

```typescript
async function render() {
  const stored = await chrome.storage.local.get(['token', 'userName'])
  const dot = document.getElementById('dot')!
  const statusText = document.getElementById('status-text')!
  const userName = document.getElementById('user-name')!

  if (!stored.token) {
    dot.className = 'dot gray'
    statusText.textContent = 'Not logged in'
    userName.textContent = 'Open the web app to sign in'
    return
  }

  dot.className = 'dot green'
  statusText.textContent = 'Monitoring'
  userName.textContent = stored.userName ?? ''
}

render()
```

Update `background.ts` — in the `SET_TOKEN` handler (`userName` is passed separately in the message from the login page, not decoded from the JWT):
```typescript
if (msg.type === 'SET_TOKEN') {
  token = msg.token
  chrome.storage.local.set({ token: msg.token, userName: msg.userName ?? '' })
  ensureOffscreen()
}
```

- [ ] **Step 4: Build the extension**

```bash
cd extension && npm run build && cd ..
```

Expected: `extension/dist/background.js`, `offscreen.js`, `content-auth.js`, `popup.js` created.

- [ ] **Step 5: Load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder (the one containing `manifest.json`)

Expected: "Learning Tracker" extension appears, no errors.

- [ ] **Step 6: End-to-end test**

1. Open `http://localhost:3000/login` in Chrome with the extension installed
2. Log in with face — extension popup should show "Monitoring"
3. Browse a few websites for 2 minutes
4. Check `/dashboard` — logs should appear
5. Check extension popup — should show your name and "Monitoring"

- [ ] **Step 7: Commit**

```bash
git add extension/src/ src/lib/auth.ts src/app/api/auth/face-login/ src/app/api/auth/setup/
git commit -m "feat: complete Chrome extension (offscreen face detection, popup, auth bridge)"
```

---

## Task 21: Final Polish + README

- [ ] **Step 1: Add npm scripts to package.json for extension**

Add to root `package.json` scripts:
```json
"extension:build": "cd extension && npm run build",
"extension:watch": "cd extension && npm run watch"
```

- [ ] **Step 2: Verify all tests still pass**

```bash
npx jest --no-coverage
```

Expected: 19 tests passing.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete learning tracker — web app + Chrome extension"
```

---

## Manual Testing Checklist

After completing all tasks, verify this full flow:

- [ ] Navigate to `/setup` on a fresh DB → admin creation works
- [ ] `/login` recognises admin face → redirects to `/admin`
- [ ] Admin can register a new user at `/admin/register`
- [ ] New user logs in at `/login` → redirects to `/dashboard`
- [ ] Extension popup shows "Monitoring" after login
- [ ] Browse 5 sites for 3 minutes → check `/dashboard` shows hours + top sites
- [ ] Cover/leave camera for 20 seconds → extension pauses (logs stop)
- [ ] Return to camera → extension resumes
- [ ] Admin at `/admin` sees both users' weekly stats
- [ ] Week picker works on both `/dashboard` and `/admin`
- [ ] `activity_logs` records cannot be deleted: run `DELETE FROM "ActivityLog" LIMIT 1;` → expect trigger error
