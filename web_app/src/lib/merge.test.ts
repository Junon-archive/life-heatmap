import { describe, it, expect } from 'vitest'
import type { AppData, Heatmap } from './types'
import { defaultPhysique } from './types'
import { mergeData } from './merge'

function base(u = 1): AppData {
  return { version: 1, settings: { weekLabel: 'range', u }, heatmaps: [], tombstones: {}, physique: defaultPhysique(0) }
}

function hm(id: string, u: number, extra: Partial<Heatmap> = {}): Heatmap {
  return {
    id,
    name: 'A',
    type: 'basic',
    order: 0,
    archived: false,
    createdAt: '2026-08-01',
    config: {},
    u,
    entries: {},
    ...extra,
  }
}

describe('mergeData (LWW)', () => {
  it('settings: u가 큰 쪽', () => {
    const a = base(10)
    const b = base(20)
    b.settings.weekLabel = 'number'
    expect(mergeData(a, b).settings.weekLabel).toBe('number')
    expect(mergeData(b, a).settings.weekLabel).toBe('number')
  })

  it('히트맵 메타: id별 u가 큰 쪽, 한쪽에만 있으면 추가', () => {
    const a = base()
    const b = base()
    a.heatmaps = [hm('x', 10, { name: '이전' }), hm('y', 5)]
    b.heatmaps = [hm('x', 20, { name: '최신' })]
    const m = mergeData(a, b)
    expect(m.heatmaps.find((h) => h.id === 'x')!.name).toBe('최신')
    expect(m.heatmaps.map((h) => h.id).sort()).toEqual(['x', 'y'])
  })

  it('엔트리: (id, 날짜)별 u가 큰 쪽 — 양방향 수정 충돌', () => {
    const a = base()
    const b = base()
    a.heatmaps = [
      hm('x', 10, {
        entries: {
          '2026-08-01': { fill: { style: 'hatch', color: 'blue' }, u: 100 },
          '2026-08-02': { fill: { style: 'solid', color: 'rose' }, u: 50 },
        },
      }),
    ]
    b.heatmaps = [
      hm('x', 5, {
        entries: {
          '2026-08-01': { fill: null, mark: { kind: 'symbol', symbol: 'x' }, u: 60 },
          '2026-08-02': { fill: null, u: 70 },
          '2026-08-03': { border: true, u: 30 },
        },
      }),
    ]
    const e = mergeData(a, b).heatmaps[0].entries
    expect(e['2026-08-01'].fill).toEqual({ style: 'hatch', color: 'blue' }) // a가 최신
    expect(e['2026-08-02'].fill).toBeNull() // b의 "지움"이 최신 → 지움 전파
    expect(e['2026-08-03'].border).toBe(true) // b에만 존재
  })

  it('tombstone: 삭제가 마지막 수정보다 나중이면 삭제 유지', () => {
    const a = base()
    const b = base()
    a.heatmaps = [hm('x', 10, { entries: { '2026-08-01': { fill: null, u: 40 } } })]
    b.tombstones = { x: 100 }
    const m = mergeData(a, b)
    expect(m.heatmaps).toHaveLength(0)
    expect(m.tombstones.x).toBe(100)
  })

  it('tombstone 이후 다시 수정된 히트맵은 부활', () => {
    const a = base()
    const b = base()
    a.heatmaps = [hm('x', 200)] // 삭제(100) 이후 수정(200)
    b.tombstones = { x: 100 }
    const m = mergeData(a, b)
    expect(m.heatmaps.map((h) => h.id)).toEqual(['x'])
    expect(m.tombstones.x).toBeUndefined()
  })

  it('입력을 변이하지 않는다', () => {
    const a = base()
    const b = base()
    a.heatmaps = [hm('x', 10, { entries: { '2026-08-01': { fill: null, u: 1 } } })]
    b.heatmaps = [hm('x', 20, { entries: { '2026-08-01': { border: true, u: 2 } } })]
    const aJson = JSON.stringify(a)
    const bJson = JSON.stringify(b)
    mergeData(a, b)
    expect(JSON.stringify(a)).toBe(aJson)
    expect(JSON.stringify(b)).toBe(bJson)
  })

  it('physique: 목표는 u가 큰 쪽, 엔트리는 날짜별 LWW', () => {
    const a = base()
    const b = base()
    a.physique.u = 10
    a.physique.goals.weight = 70
    a.physique.entries = {
      '2026-08-19': { weight: 75.3, u: 100 },
      '2026-08-12': { weight: 76.0, u: 50 },
    }
    b.physique.u = 20
    b.physique.goals.weight = 65
    b.physique.entries = {
      '2026-08-19': { weight: 75.0, u: 60 }, // a가 최신
      '2026-08-12': { u: 70 }, // b의 "지움"이 최신
      '2026-08-20': { waist: 91, u: 30 }, // b에만 존재
    }
    const m = mergeData(a, b).physique
    expect(m.goals.weight).toBe(65) // b.u가 큼
    expect(m.entries['2026-08-19'].weight).toBe(75.3)
    expect(m.entries['2026-08-12'].weight).toBeUndefined()
    expect(m.entries['2026-08-20'].waist).toBe(91)
  })

  it('한쪽에만 physique가 있으면(구버전 백업) 있는 쪽 사용', () => {
    const a = base()
    a.physique.entries = { '2026-08-19': { weight: 75.3, u: 1 } }
    const b = base()
    ;(b as Partial<AppData>).physique = undefined
    const m = mergeData(a, b as AppData)
    expect(m.physique.entries['2026-08-19'].weight).toBe(75.3)
  })

  it('order 순 정렬 유지', () => {
    const a = base()
    const b = base()
    a.heatmaps = [hm('x', 10, { order: 2 })]
    b.heatmaps = [hm('y', 10, { order: 1 })]
    expect(mergeData(a, b).heatmaps.map((h) => h.id)).toEqual(['y', 'x'])
  })
})
