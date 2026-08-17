// 월/분기 집계 — specs/03 §7
// 의미 라벨 없이 표기(채움/기호/숫자/수치) 기준으로만 집계한다.
import type { Heatmap, SymbolKind } from './types'
import { entryIsEmpty } from './types'
import { monthKey, quarterKey, parseDate, toDateStr, diffDays } from './dates'

export interface PeriodStats {
  period: string // 'YYYY-MM' 또는 'YYYY-Q#'
  elapsedDays: number // 기간 중 오늘까지 지난 일수 (% 분모)
  filled: number // 채우기 있는 날
  symbols: Record<SymbolKind, number>
  numberSum: number // 숫자 마크 합계
  numberDays: number
  borders: number
  fails: number
  valueSum: number // conditional 수치 합
  valueDays: number
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function elapsedInMonth(ym: string, today: string): number {
  const first = `${ym}-01`
  const last = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`
  if (today < first) return 0
  if (today >= last) return daysInMonth(ym)
  return diffDays(first, today) + 1
}

function blank(period: string): PeriodStats {
  return {
    period,
    elapsedDays: 0,
    filled: 0,
    symbols: { circle: 0, x: 0, star: 0 },
    numberSum: 0,
    numberDays: 0,
    borders: 0,
    fails: 0,
    valueSum: 0,
    valueDays: 0,
  }
}

/** 월별 집계, 최신 우선 정렬. 엔트리가 있는 첫 달부터 이번 달까지 빈 달 포함 */
export function monthlyStats(hm: Heatmap, today: string): PeriodStats[] {
  const dates = Object.keys(hm.entries)
    .filter((d) => d <= today && !entryIsEmpty(hm.entries[d]))
    .sort()
  const byPeriod = new Map<string, PeriodStats>()

  // 첫 기록 달 ~ 이번 달까지 기간 생성
  const firstYm = dates.length ? monthKey(dates[0]) : monthKey(today)
  const cursor = parseDate(`${firstYm}-01`)
  const endYm = monthKey(today)
  while (true) {
    const ym = monthKey(toDateStr(cursor))
    const s = blank(ym)
    s.elapsedDays = elapsedInMonth(ym, today)
    byPeriod.set(ym, s)
    if (ym === endYm) break
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const d of dates) {
    const s = byPeriod.get(monthKey(d))
    if (!s) continue
    const e = hm.entries[d]
    if (e.fill) s.filled++
    if (e.mark?.kind === 'symbol') s.symbols[e.mark.symbol]++
    if (e.mark?.kind === 'number') {
      s.numberSum += e.mark.value
      s.numberDays++
    }
    if (e.border) s.borders++
    if (e.fail) s.fails++
    if (e.value != null) {
      s.valueSum += e.value
      s.valueDays++
    }
  }
  return [...byPeriod.values()].reverse()
}

/** 분기별 집계 = 월별 집계를 분기로 합산, 최신 우선 */
export function quarterlyStats(hm: Heatmap, today: string): PeriodStats[] {
  const monthly = monthlyStats(hm, today)
  const byQ = new Map<string, PeriodStats>()
  for (const m of monthly) {
    const q = quarterKey(`${m.period}-01`)
    const s = byQ.get(q) ?? blank(q)
    s.elapsedDays += m.elapsedDays
    s.filled += m.filled
    s.symbols.circle += m.symbols.circle
    s.symbols.x += m.symbols.x
    s.symbols.star += m.symbols.star
    s.numberSum += m.numberSum
    s.numberDays += m.numberDays
    s.borders += m.borders
    s.fails += m.fails
    s.valueSum += m.valueSum
    s.valueDays += m.valueDays
    byQ.set(q, s)
  }
  return [...byQ.values()]
}

/** 임의 날짜 범위 집계 — 연간 보기 한 줄 요약용 (specs/03 §9). 분모는 범위 중 오늘까지 지난 일수 */
export function rangeStats(hm: Heatmap, start: string, end: string, today: string): PeriodStats {
  const s = blank(`${start}~${end}`)
  const effEnd = end < today ? end : today
  s.elapsedDays = start > effEnd ? 0 : diffDays(start, effEnd) + 1
  for (const [d, e] of Object.entries(hm.entries)) {
    if (d < start || d > end || d > today || entryIsEmpty(e)) continue
    if (e.fill) s.filled++
    if (e.mark?.kind === 'symbol') s.symbols[e.mark.symbol]++
    if (e.mark?.kind === 'number') {
      s.numberSum += e.mark.value
      s.numberDays++
    }
    if (e.border) s.borders++
    if (e.fail) s.fails++
    if (e.value != null) {
      s.valueSum += e.value
      s.valueDays++
    }
  }
  return s
}

/** 이 히트맵에서 실제 사용된 표기 종류 (요약줄·통계 열 구성용) */
export function usedFeatures(hm: Heatmap): { fill: boolean; circle: boolean; x: boolean; star: boolean; number: boolean; border: boolean; value: boolean } {
  const f = { fill: false, circle: false, x: false, star: false, number: false, border: false, value: false }
  for (const e of Object.values(hm.entries)) {
    if (e.fill) f.fill = true
    if (e.mark?.kind === 'symbol') f[e.mark.symbol] = true
    if (e.mark?.kind === 'number') f.number = true
    if (e.border) f.border = true
    if (e.value != null) f.value = true
  }
  return f
}
