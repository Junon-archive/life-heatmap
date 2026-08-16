import { describe, it, expect } from 'vitest'
import type { Heatmap, Entry } from './types'
import { currentStreak, bestStreak, streakOn, levelFor, isMilestone, milestoneHistory, startDate } from './streak'

function hm(createdAt: string, entries: Record<string, Partial<Entry>>): Heatmap {
  const full: Record<string, Entry> = {}
  for (const [d, e] of Object.entries(entries)) full[d] = { u: 1, ...e }
  return {
    id: 'hm_test',
    name: 'T',
    type: 'streak',
    order: 0,
    archived: false,
    createdAt,
    config: {},
    u: 1,
    entries: full,
  }
}

describe('streak', () => {
  it('실패 없음: 시작일부터 센다 (시작일 = 1일차)', () => {
    const h = hm('2026-08-01', {})
    expect(currentStreak(h, '2026-08-16')).toBe(16)
    expect(streakOn(h, '2026-08-01')).toBe(1)
  })

  it('시작일: 첫 엔트리가 생성일보다 이르면 첫 엔트리 기준', () => {
    const h = hm('2026-08-10', { '2026-08-01': { fill: { style: 'hatch', color: 'blue' } } })
    expect(startDate(h)).toBe('2026-08-01')
    expect(currentStreak(h, '2026-08-16')).toBe(16)
  })

  it('실패·미입력 혼재: 미입력은 끊지 않고, 실패 다음 날이 1일차', () => {
    const h = hm('2026-08-01', {
      '2026-08-05': { fail: true },
      // 8/6~8/16 사이 대부분 미입력, 8/10만 채움 — streak는 달력일 기준
      '2026-08-10': { fill: { style: 'solid', color: 'violet' } },
    })
    expect(currentStreak(h, '2026-08-16')).toBe(11) // 8/6이 1일차 → 8/16 = 11일차
    expect(streakOn(h, '2026-08-05')).toBe(0) // 실패일 자신 = 0
    expect(streakOn(h, '2026-08-06')).toBe(1)
  })

  it('오늘 실패하면 0', () => {
    const h = hm('2026-08-01', { '2026-08-16': { fail: true } })
    expect(currentStreak(h, '2026-08-16')).toBe(0)
  })

  it('최고 기록: 과거 구간과 현재 진행 중 비교', () => {
    const h = hm('2026-07-01', {
      '2026-07-20': { fail: true }, // 7/1~7/19 = 19일
      '2026-07-25': { fail: true }, // 7/21~7/24 = 4일
    })
    // 현재: 7/26~8/16 = 22일
    expect(currentStreak(h, '2026-08-16')).toBe(22)
    expect(bestStreak(h, '2026-08-16')).toBe(22)
    expect(bestStreak(h, '2026-08-05')).toBe(19) // 그 시점 현재는 11일 → 과거 19일이 최고
  })

  it('연속 실패', () => {
    const h = hm('2026-08-01', {
      '2026-08-10': { fail: true },
      '2026-08-11': { fail: true },
    })
    expect(bestStreak(h, '2026-08-16')).toBe(9) // 8/1~8/9
    expect(currentStreak(h, '2026-08-16')).toBe(5) // 8/12~8/16
  })

  it('그라데이션 단계', () => {
    const levels = [1, 3, 7, 14, 30]
    expect(levelFor(0, levels)).toBe(0)
    expect(levelFor(1, levels)).toBe(1)
    expect(levelFor(2, levels)).toBe(1)
    expect(levelFor(3, levels)).toBe(2)
    expect(levelFor(7, levels)).toBe(3)
    expect(levelFor(14, levels)).toBe(4)
    expect(levelFor(30, levels)).toBe(5)
    expect(levelFor(400, levels)).toBe(5)
  })

  it('마일스톤 판정과 이력', () => {
    expect(isMilestone(7, [7, 30])).toBe(true)
    expect(isMilestone(8, [7, 30])).toBe(false)
    const h = hm('2026-07-01', { '2026-07-20': { fail: true } })
    const hist = milestoneHistory(h, '2026-08-16', [7, 30])
    // 1구간: 7/1이 1일차 → 7일차 = 7/7 (19일이라 30 미달)
    // 2구간: 7/21이 1일차 → 7일차 = 7/27, 27일(8/16)이라 30 미달
    expect(hist).toEqual([
      { days: 7, date: '2026-07-07' },
      { days: 7, date: '2026-07-27' },
    ])
  })
})
