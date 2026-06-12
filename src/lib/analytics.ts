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
  /** Trailing weekly totals ending with the selected week (oldest → newest). */
  trend: { weekStart: string; seconds: number }[]
}

const secondsOf = (log: { startedAt: Date; endedAt: Date }) =>
  (log.endedAt.getTime() - log.startedAt.getTime()) / 1000

/**
 * Bucket logs into `weeks` consecutive weekly totals, the last bucket being the
 * week that starts on `latestWeekStart`. Powers the sparkline + week-over-week delta.
 */
export function computeTrend(
  logs: { startedAt: Date; endedAt: Date }[],
  latestWeekStart: Date,
  weeks = 8,
): { weekStart: string; seconds: number }[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(latestWeekStart)
    start.setUTCDate(start.getUTCDate() - (weeks - 1 - i) * 7)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
    const seconds = logs
      .filter(l => l.startedAt >= start && l.startedAt < end)
      .reduce((sum, l) => sum + secondsOf(l), 0)
    return { weekStart: start.toISOString().split('T')[0], seconds }
  })
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
      trend: [],
    }
  }

  const duration = secondsOf

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

  return { totalSeconds, activeDays, facePresencePercent, dailyBreakdown, topSites, trend: [] }
}
