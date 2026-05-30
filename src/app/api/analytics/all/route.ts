import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeWeeklyAnalytics } from '@/lib/analytics'

function getMonday(d: Date): Date {
  const r = new Date(d); const day = r.getUTCDay()
  r.setUTCDate(r.getUTCDate() + (day === 0 ? -6 : 1 - day)); r.setUTCHours(0,0,0,0); return r
}

export async function GET(request: Request) {
  const auth = requireAuth(request, 'ADMIN')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart') ? new Date(searchParams.get('weekStart')!) : getMonday(new Date())
  const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true, name: true, activityLogs: {
      where: { startedAt: { gte: weekStart, lt: weekEnd } },
      select: { url: true, tabTitle: true, startedAt: true, endedAt: true, facePresent: true },
    }},
  })
  return NextResponse.json({ weekStart: weekStart.toISOString(), users: users.map(u => ({ userId: u.id, name: u.name, analytics: computeWeeklyAnalytics(u.activityLogs, weekStart) })) })
}
