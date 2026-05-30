import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type LogEntry = { url: string; tabTitle: string; startedAt: string; endedAt: string; facePresent: boolean }

export async function POST(request: Request) {
  const auth = requireAuth(request)
  if (auth instanceof Response) return auth
  const { logs }: { logs: LogEntry[] } = await request.json()
  if (!Array.isArray(logs) || logs.length === 0)
    return NextResponse.json({ error: 'No logs provided' }, { status: 400 })
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
