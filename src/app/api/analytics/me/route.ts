import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeWeeklyAnalytics, computeTrend } from '@/lib/analytics'

const TREND_WEEKS = 8

function getMonday(d: Date): Date {
  const r = new Date(d); const day = r.getUTCDay()
  r.setUTCDate(r.getUTCDate() + (day === 0 ? -6 : 1 - day)); r.setUTCHours(0,0,0,0); return r
}

export async function GET(request: Request) {
  const auth = requireAuth(request)
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart') ? new Date(searchParams.get('weekStart')!) : getMonday(new Date())
  const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  // Trend window: the selected week plus the (TREND_WEEKS - 1) weeks before it.
  const trendStart = new Date(weekStart); trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_WEEKS - 1) * 7)

  const logs = await prisma.activityLog.findMany({
    where: { userId: auth.userId, startedAt: { gte: trendStart, lt: weekEnd } },
    select: { url: true, tabTitle: true, startedAt: true, endedAt: true, facePresent: true },
  })

  const weekLogs = logs.filter(l => l.startedAt >= weekStart && l.startedAt < weekEnd)
  const trend = computeTrend(logs, weekStart, TREND_WEEKS)

  return NextResponse.json({ ...computeWeeklyAnalytics(weekLogs, weekStart), trend })
}
