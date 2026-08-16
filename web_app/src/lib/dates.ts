// 날짜 유틸 — 전부 로컬 타임존 기준 YYYY-MM-DD 문자열 (specs/04 §3)
// 주 시작 = 일요일, 주 번호 = 1월 1일이 포함된 주가 W1 (specs/02 §4)

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 로컬 자정 Date로 파싱 (new Date('YYYY-MM-DD')는 UTC로 해석되므로 금지) */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** b - a (일 단위). DST 오차 방지를 위해 반올림 */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

/** 0=일 … 6=토 */
export function dayOfWeek(s: string): number {
  return parseDate(s).getDay()
}

/** 해당 날짜가 속한 주의 일요일 */
export function weekStart(s: string): string {
  return addDays(s, -dayOfWeek(s))
}

/** 주 번호: 1월 1일이 포함된 일요일 시작 주 = W1. 주의 소속 연도는 그 주 토요일의 연도 */
export function weekNumber(s: string): number {
  const ws = weekStart(s)
  const year = parseDate(addDays(ws, 6)).getFullYear()
  const w1 = weekStart(`${year}-01-01`)
  return Math.floor(diffDays(w1, ws) / 7) + 1
}

/** 주 라벨의 연도 (weekNumber와 같은 규칙) */
export function weekYear(s: string): number {
  return parseDate(addDays(weekStart(s), 6)).getFullYear()
}

/** 행 라벨: mode='number' → "W28", mode='range' → "7/5~" (연도 바뀌면 "'27 1/3~") */
export function weekLabel(weekStartStr: string, mode: 'range' | 'number', currentYear: number): string {
  if (mode === 'number') return `W${weekNumber(weekStartStr)}`
  const d = parseDate(weekStartStr)
  const md = `${d.getMonth() + 1}/${d.getDate()}~`
  return d.getFullYear() === currentYear ? md : `'${String(d.getFullYear()).slice(2)} ${md}`
}

export function monthKey(s: string): string {
  return s.slice(0, 7) // YYYY-MM
}

export function quarterKey(s: string): string {
  const q = Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1
  return `${s.slice(0, 4)}-Q${q}`
}
