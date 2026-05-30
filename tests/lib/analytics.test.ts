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
