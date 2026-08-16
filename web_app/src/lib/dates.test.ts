import { describe, it, expect } from 'vitest'
import { addDays, diffDays, dayOfWeek, weekStart, weekNumber, weekYear, weekLabel, quarterKey } from './dates'

describe('dates', () => {
  it('기본 변환과 연산', () => {
    expect(addDays('2026-07-05', 7)).toBe('2026-07-12')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(diffDays('2026-07-05', '2026-08-16')).toBe(42)
    expect(dayOfWeek('2026-07-05')).toBe(0) // 일요일
  })

  it('일요일 시작 주', () => {
    expect(weekStart('2026-07-05')).toBe('2026-07-05') // 일요일 자신
    expect(weekStart('2026-07-11')).toBe('2026-07-05') // 토요일 → 그 주 일요일
    expect(weekStart('2026-08-16')).toBe('2026-08-16')
  })

  it('주 번호: 종이 기록과 일치 (2026-07-05 주 = W28)', () => {
    expect(weekNumber('2026-07-05')).toBe(28)
    expect(weekNumber('2026-07-11')).toBe(28)
    expect(weekNumber('2026-08-16')).toBe(34)
  })

  it('연 경계: 1월 1일이 포함된 주 = 새해 W1', () => {
    // 2026-01-01(목)이 포함된 주는 2025-12-28(일)~2026-01-03(토) → 2026년 W1
    expect(weekNumber('2025-12-28')).toBe(1)
    expect(weekYear('2025-12-28')).toBe(2026)
    expect(weekNumber('2026-01-03')).toBe(1)
    expect(weekNumber('2026-01-04')).toBe(2)
    // 2025-12-27(토)은 이전 주 → 2025년의 마지막 주
    expect(weekYear('2025-12-27')).toBe(2025)
    // 1월 1일이 일요일인 해 (2023): 그 주가 W1
    expect(weekNumber('2023-01-01')).toBe(1)
    expect(weekNumber('2023-01-08')).toBe(2)
  })

  it('행 라벨', () => {
    expect(weekLabel('2026-07-05', 'number', 2026)).toBe('W28')
    expect(weekLabel('2026-07-05', 'range', 2026)).toBe('7/5~')
    expect(weekLabel('2025-12-28', 'range', 2026)).toBe("'25 12/28~")
  })

  it('분기 키', () => {
    expect(quarterKey('2026-01-15')).toBe('2026-Q1')
    expect(quarterKey('2026-07-05')).toBe('2026-Q3')
    expect(quarterKey('2026-12-31')).toBe('2026-Q4')
  })
})
