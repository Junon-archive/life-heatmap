// 신체 대시보드 계산 — specs/05 §5
// 모든 계산은 지표별 독립 시계열. 부분 입력 허용, 비율은 같은 엔트리에 어깨·허리가 모두 있을 때만(D-20).
import type { PhysiqueData, PhysiqueMetric, PhysiqueGoalKey } from './types'
import { diffDays, addDays } from './dates'

export const RATIO_COEF = 2.304

export const METRICS: PhysiqueMetric[] = ['weight', 'bodyFat', 'shoulder', 'waist', 'muscle', 'arm']
export const GOAL_KEYS: PhysiqueGoalKey[] = [...METRICS, 'ratio']

export const METRIC_INFO: Record<PhysiqueGoalKey, { label: string; unit: string; decimals: number }> = {
  weight: { label: '체중', unit: 'kg', decimals: 1 },
  bodyFat: { label: '체지방률', unit: '%', decimals: 1 },
  shoulder: { label: '어깨 폭', unit: 'cm', decimals: 1 },
  waist: { label: '허리 둘레', unit: 'cm', decimals: 1 },
  muscle: { label: '골격근량', unit: 'kg', decimals: 1 },
  arm: { label: '팔 둘레', unit: 'cm', decimals: 1 },
  ratio: { label: '어깨/허리 비율', unit: '', decimals: 2 },
}

export interface Point {
  date: string
  value: number
}

export function ratioOf(shoulder: number, waist: number): number {
  return Math.round((RATIO_COEF * shoulder / waist) * 100) / 100
}

/** 지표별 시계열 (날짜순). ratio는 어깨·허리가 같은 엔트리에 모두 있는 날만 (D-20) */
export function series(ph: PhysiqueData, key: PhysiqueGoalKey): Point[] {
  const out: Point[] = []
  for (const [date, e] of Object.entries(ph.entries)) {
    if (key === 'ratio') {
      if (e.shoulder != null && e.waist != null && e.waist !== 0) out.push({ date, value: ratioOf(e.shoulder, e.waist) })
    } else {
      const v = e[key]
      if (v != null) out.push({ date, value: v })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function firstPoint(ph: PhysiqueData, key: PhysiqueGoalKey): Point | null {
  const s = series(ph, key)
  return s[0] ?? null
}

export function lastPoint(ph: PhysiqueData, key: PhysiqueGoalKey): Point | null {
  const s = series(ph, key)
  return s[s.length - 1] ?? null
}

/** 값이 하나라도 있는 엔트리 중 가장 최근 날짜 (카드의 날짜 뱃지 기준) */
export function latestEntryDate(ph: PhysiqueData): string | null {
  const dates = Object.entries(ph.entries)
    .filter(([, e]) => METRICS.some((m) => e[m] != null))
    .map(([d]) => d)
    .sort()
  return dates[dates.length - 1] ?? null
}

/** 지표 진행률 0~1. 데이터 없음/목표=시작이면 null */
export function progress(ph: PhysiqueData, key: PhysiqueGoalKey): number | null {
  const s = series(ph, key)
  if (!s.length) return null
  const start = s[0].value
  const cur = s[s.length - 1].value
  const goal = ph.goals[key]
  if (goal == null || goal === start) return null
  return Math.max(0, Math.min(1, (cur - start) / (goal - start)))
}

/** 종합 진행률 = 계산 가능한 지표(ratio 포함 7개)의 평균 (D-18) */
export function overallProgress(ph: PhysiqueData): { value: number; count: number } | null {
  const vals = GOAL_KEYS.map((k) => progress(ph, k)).filter((v): v is number => v != null)
  if (!vals.length) return null
  return { value: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }
}

/** 전 기간 최소제곱 선형 회귀 (D-19). x = 첫 점 기준 경과일. 점 2개 미만이면 null */
export function regression(points: Point[]): { slope: number; intercept: number; x0: string } | null {
  if (points.length < 2) return null
  const x0 = points[0].date
  const xs = points.map((p) => diffDays(x0, p.date))
  const ys = points.map((p) => p.value)
  const n = points.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  const slope = num / den // 하루당 변화량
  return { slope, intercept: my - slope * mx, x0 }
}

/** 주당 변화 속도 (회귀 기울기 × 7) */
export function weeklyPace(ph: PhysiqueData, key: PhysiqueGoalKey): number | null {
  const r = regression(series(ph, key))
  return r ? r.slope * 7 : null
}

export type Projection =
  | { kind: 'date'; date: string }
  | { kind: 'insufficient' } // 점 < 2
  | { kind: 'unreachable' } // 기울기 0 또는 목표 반대 방향

/** 예상 달성일 — 회귀선이 목표값에 도달하는 날짜 */
export function expectedDate(ph: PhysiqueData, key: PhysiqueGoalKey): Projection {
  const s = series(ph, key)
  const r = regression(s)
  if (!r) return { kind: 'insufficient' }
  const goal = ph.goals[key]
  const start = s[0].value
  const cur = s[s.length - 1].value
  // 이미 달성: 시작→목표 방향 기준으로 현재가 목표를 지났으면 마지막 측정일
  const dir = goal - start
  if (dir === 0 ? cur === goal : dir < 0 ? cur <= goal : cur >= goal) {
    return { kind: 'date', date: s[s.length - 1].date }
  }
  const need = goal - cur
  if (Math.abs(r.slope) < 1e-9 || need * r.slope < 0) return { kind: 'unreachable' }
  const x = (goal - r.intercept) / r.slope // x0 기준 경과일
  return { kind: 'date', date: addDays(r.x0, Math.round(x)) }
}

/** 필요 페이스 = (목표 - 현재) ÷ 남은 주수. 목표일 경과·데이터 없음이면 null */
export function requiredPace(ph: PhysiqueData, key: PhysiqueGoalKey, today: string): number | null {
  const last = lastPoint(ph, key)
  if (!last) return null
  const daysLeft = diffDays(today, ph.targetDate)
  if (daysLeft <= 0) return null
  return (ph.goals[key] - last.value) / (daysLeft / 7)
}

/** 목표일까지 남은 일수 (음수 = 경과) */
export function dday(ph: PhysiqueData, today: string): number {
  return diffDays(today, ph.targetDate)
}

/** 예측 판정 색: 목표일 이내 good / +30일 이내 close / 그 외 late (specs/05 §4) */
export function projectionTone(p: Projection, targetDate: string): 'good' | 'close' | 'late' | 'none' {
  if (p.kind !== 'date') return p.kind === 'insufficient' ? 'none' : 'late'
  const delta = diffDays(targetDate, p.date)
  if (delta <= 0) return 'good'
  if (delta <= 30) return 'close'
  return 'late'
}
