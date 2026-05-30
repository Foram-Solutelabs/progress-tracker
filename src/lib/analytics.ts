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
