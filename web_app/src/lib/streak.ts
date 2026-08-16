// 연속일수 계산 — specs/02 §4
// streak = 마지막 실패 체크 다음 날부터의 달력일수. 미입력 빈칸은 끊지 않는다.
// 실패가 없으면 기록 시작일(첫 엔트리 날짜와 생성일 중 이른 쪽)부터 센다.
import type { Heatmap } from './types'
import { diffDays, addDays } from './dates'

/** 정렬된 실패 날짜 목록 (date 이하만) */
function failDates(hm: Heatmap, upTo: string): string[] {
  return Object.keys(hm.entries)
    .filter((d) => hm.entries[d].fail && d <= upTo)
    .sort()
}

/** 기록 시작일: 첫 엔트리 날짜 vs createdAt 중 이른 쪽 */
export function startDate(hm: Heatmap): string {
  const first = Object.keys(hm.entries).sort()[0]
  return first && first < hm.createdAt ? first : hm.createdAt
}

/**
 * 해당 날짜의 streak 일차. 실패일 자신은 0.
 * 마지막 실패 다음 날 = 1일차. 실패가 없으면 시작일 = 1일차.
 */
export function streakOn(hm: Heatmap, date: string): number {
  const fails = failDates(hm, date)
  const lastFail = fails[fails.length - 1]
  if (lastFail) return diffDays(lastFail, date)
  const start = startDate(hm)
  if (date < start) return 0
  return diffDays(start, date) + 1
}

/** 현재 연속일수 (오늘 기준) */
export function currentStreak(hm: Heatmap, today: string): number {
  return Math.max(0, streakOn(hm, today))
}

/** 최고 연속일수 (현재 진행 중인 streak 포함) */
export function bestStreak(hm: Heatmap, today: string): number {
  const fails = failDates(hm, today)
  const start = startDate(hm)
  let best = 0
  let prevFail: string | null = null
  for (const f of fails) {
    const len = prevFail ? diffDays(prevFail, f) - 1 : Math.max(0, diffDays(start, f))
    if (len > best) best = len
    prevFail = f
  }
  const current = currentStreak(hm, today)
  return Math.max(best, current)
}

/**
 * 그라데이션 단계 1~5 (0 = 채색 없음).
 * levels = [a,b,c,d,e]: days≥e→5, ≥d→4, ≥c→3, ≥b→2, ≥a→1
 */
export function levelFor(days: number, levels: number[]): number {
  let lv = 0
  for (let i = 0; i < levels.length; i++) {
    if (days >= levels[i]) lv = i + 1
  }
  return Math.min(lv, 5)
}

/** 단계별 채우기 투명도 — specs/03 §3.2 */
export const LEVEL_ALPHA = [0, 0.25, 0.4, 0.55, 0.75, 0.95]

export function isMilestone(days: number, milestones: number[]): boolean {
  return days > 0 && milestones.includes(days)
}

/** 월별 실패 횟수 { 'YYYY-MM': n } */
export function failsByMonth(hm: Heatmap, upTo: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of failDates(hm, upTo)) {
    const k = d.slice(0, 7)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** 달성한 마일스톤 이력 [{days, date}] — 통계용. 각 구간의 1일차 = 시작일 또는 실패 다음 날 */
export function milestoneHistory(hm: Heatmap, today: string, milestones: number[]): { days: number; date: string }[] {
  const fails = failDates(hm, today)
  const start = startDate(hm)
  const segments: { dayOne: string; length: number }[] = []
  for (let i = 0; i <= fails.length; i++) {
    const dayOne = i === 0 ? start : addDays(fails[i - 1], 1)
    const end = i < fails.length ? addDays(fails[i], -1) : today
    const length = diffDays(dayOne, end) + 1
    if (length > 0) segments.push({ dayOne, length })
  }
  const out: { days: number; date: string }[] = []
  for (const seg of segments) {
    for (const m of milestones) {
      if (m > 0 && seg.length >= m) out.push({ days: m, date: addDays(seg.dayOne, m - 1) })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}
