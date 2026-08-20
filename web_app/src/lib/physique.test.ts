import { describe, it, expect } from 'vitest'
import type { PhysiqueData } from './types'
import { defaultPhysique } from './types'
import { series, progress, overallProgress, regression, expectedDate, requiredPace, latestEntryDate, ratioOf, weeklyPace, projectionTone } from './physique'

function ph(entries: PhysiqueData['entries'], goals?: Partial<PhysiqueData['goals']>): PhysiqueData {
  const p = defaultPhysique(1)
  p.entries = entries
  if (goals) p.goals = { ...p.goals, ...goals }
  return p
}

describe('physique — 부분 입력 시계열 (D-20)', () => {
  it('지표별로 값이 있는 엔트리만 시계열에 포함', () => {
    const p = ph({
      '2026-07-08': { weight: 77.9, u: 1 },
      '2026-07-22': { waist: 93, u: 1 }, // 체중 없음
      '2026-08-05': { weight: 76.4, u: 1 },
    })
    expect(series(p, 'weight').map((x) => x.value)).toEqual([77.9, 76.4])
    expect(series(p, 'waist').map((x) => x.value)).toEqual([93])
  })

  it('ratio는 어깨·허리가 같은 엔트리에 모두 있는 날만', () => {
    const p = ph({
      '2026-07-08': { shoulder: 45, waist: 95, u: 1 },
      '2026-07-22': { shoulder: 45.5, u: 1 }, // 허리 없음 → 제외
      '2026-08-05': { waist: 92, u: 1 }, // 어깨 없음 → 제외
      '2026-08-19': { shoulder: 46, waist: 92, u: 1 },
    })
    const s = series(p, 'ratio')
    expect(s).toHaveLength(2)
    expect(s[0].value).toBe(ratioOf(45, 95)) // 1.09
    expect(s[1].value).toBe(ratioOf(46, 92)) // 1.15
    expect(s[0].value).toBe(1.09)
    expect(s[1].value).toBe(1.15)
  })

  it('latestEntryDate는 값이 있는 엔트리만 인정 (지움 엔트리 무시)', () => {
    const p = ph({
      '2026-08-19': { weight: 75.3, u: 1 },
      '2026-08-20': { u: 2 }, // 지움 엔트리
    })
    expect(latestEntryDate(p)).toBe('2026-08-19')
  })
})

describe('physique — 진행률', () => {
  it('진행률 클램프와 종합 평균 (ratio 포함, 계산 가능한 것만)', () => {
    const p = ph(
      {
        '2026-07-08': { weight: 78, waist: 95, shoulder: 45, u: 1 },
        '2026-08-19': { weight: 73, waist: 90, shoulder: 46, u: 1 },
      },
      { weight: 68, waist: 75, shoulder: 51 },
    )
    expect(progress(p, 'weight')).toBeCloseTo(0.5) // (73-78)/(68-78)
    expect(progress(p, 'bodyFat')).toBeNull() // 데이터 없음
    const o = overallProgress(p)!
    expect(o.count).toBe(4) // weight, waist, shoulder, ratio
    // ratio: 1.09 → 1.18, 목표 1.6 → (1.18-1.09)/(0.51)
    expect(o.value).toBeGreaterThan(0)
  })

  it('목표를 초과 달성해도 1로 클램프', () => {
    const p = ph({
      '2026-07-08': { weight: 78, u: 1 },
      '2026-08-19': { weight: 60, u: 1 },
    })
    expect(progress(p, 'weight')).toBe(1)
  })
})

describe('physique — 회귀와 예측 (D-19)', () => {
  it('완벽한 선형 데이터의 기울기·예상일', () => {
    // 7일마다 -0.7kg → 하루 -0.1
    const p = ph({
      '2026-07-01': { weight: 80, u: 1 },
      '2026-07-08': { weight: 79.3, u: 1 },
      '2026-07-15': { weight: 78.6, u: 1 },
    })
    const r = regression(series(p, 'weight'))!
    expect(r.slope).toBeCloseTo(-0.1)
    expect(weeklyPace(p, 'weight')).toBeCloseTo(-0.7)
    // 목표 68까지: 80에서 120일 → 2026-10-29
    const e = expectedDate(p, 'weight')
    expect(e).toEqual({ kind: 'date', date: '2026-10-29' })
  })

  it('점 1개 → insufficient, 반대 방향 → unreachable', () => {
    const p1 = ph({ '2026-07-01': { weight: 80, u: 1 } })
    expect(expectedDate(p1, 'weight')).toEqual({ kind: 'insufficient' })
    const p2 = ph({
      '2026-07-01': { weight: 70, u: 1 },
      '2026-08-01': { weight: 75, u: 1 }, // 증가 중인데 목표 68
    })
    expect(expectedDate(p2, 'weight')).toEqual({ kind: 'unreachable' })
  })

  it('이미 목표 도달 시 마지막 측정일 반환', () => {
    const p = ph({
      '2026-07-01': { weight: 70, u: 1 },
      '2026-08-01': { weight: 67, u: 1 },
    })
    const e = expectedDate(p, 'weight')
    expect(e.kind).toBe('date')
  })

  it('판정 색: 목표일 이내 good / +30일 close / 이후 late', () => {
    const target = '2026-11-30'
    expect(projectionTone({ kind: 'date', date: '2026-11-20' }, target)).toBe('good')
    expect(projectionTone({ kind: 'date', date: '2026-12-20' }, target)).toBe('close')
    expect(projectionTone({ kind: 'date', date: '2027-02-01' }, target)).toBe('late')
    expect(projectionTone({ kind: 'unreachable' }, target)).toBe('late')
    expect(projectionTone({ kind: 'insufficient' }, target)).toBe('none')
  })
})

describe('physique — 필요 페이스', () => {
  it('(목표-현재) ÷ 남은 주수', () => {
    const p = ph({ '2026-08-01': { weight: 75, u: 1 } })
    p.targetDate = '2026-11-30'
    // 8/20 기준 102일 남음 → 주 14.571
    const r = requiredPace(p, 'weight', '2026-08-20')!
    expect(r).toBeCloseTo((68 - 75) / (102 / 7), 3)
  })

  it('목표일 경과 시 null', () => {
    const p = ph({ '2026-08-01': { weight: 75, u: 1 } })
    p.targetDate = '2026-08-10'
    expect(requiredPace(p, 'weight', '2026-08-20')).toBeNull()
  })
})
