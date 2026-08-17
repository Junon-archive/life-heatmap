// 연간 보기 — GitHub contribution graph 스타일 1년 한눈 보기 (specs/03 §9, R-30, D-12)
// 편집 없음. 칸 탭 → 기본 보기의 해당 주로 점프.
import { useState } from 'preact/hooks'
import type { Heatmap } from '../lib/types'
import { addDays, weekStart, diffDays, parseDate } from '../lib/dates'
import { cellVisual } from '../lib/render'
import { currentStreak, bestStreak, startDate } from '../lib/streak'
import { rangeStats, usedFeatures } from '../lib/stats'
import { Cell } from './Cell'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const RECENT_WEEKS = 53

type Range = 'recent' | number // number = 연도(1/1~12/31)

interface Props {
  heatmaps: Heatmap[]
  today: string
  onJump: (hmId: string, date: string) => void
}

/** 범위의 주 시작일 목록과 유효 날짜 구간 */
function weeksOf(range: Range, today: string): { weeks: string[]; from: string; to: string } {
  if (range === 'recent') {
    const last = weekStart(today)
    const first = addDays(last, -7 * (RECENT_WEEKS - 1))
    const weeks = Array.from({ length: RECENT_WEEKS }, (_, i) => addDays(first, i * 7))
    return { weeks, from: first, to: addDays(last, 6) }
  }
  const from = `${range}-01-01`
  const to = `${range}-12-31`
  const first = weekStart(from)
  const n = Math.floor(diffDays(first, weekStart(to)) / 7) + 1
  const weeks = Array.from({ length: n }, (_, i) => addDays(first, i * 7))
  return { weeks, from, to }
}

function yearSummary(hm: Heatmap, from: string, to: string, today: string): string {
  if (hm.type === 'streak') {
    const s = rangeStats(hm, from, to, today)
    return `🔥 현재 ${currentStreak(hm, today)}일 · 최고 ${bestStreak(hm, today)}일 · 실패 ${s.fails}회`
  }
  const s = rangeStats(hm, from, to, today)
  const used = usedFeatures(hm)
  const parts: string[] = []
  if (used.fill && s.elapsedDays > 0) parts.push(`▨ ${s.filled}일 (${Math.round((s.filled / s.elapsedDays) * 100)}%)`)
  if (used.circle) parts.push(`◯ ${s.symbols.circle}`)
  if (used.x) parts.push(`✕ ${s.symbols.x}`)
  if (used.star) parts.push(`★ ${s.symbols.star}`)
  if (used.number) parts.push(`№ ${s.numberSum}`)
  if (used.value && s.valueDays > 0) parts.push(`평균 ${(s.valueSum / s.valueDays).toFixed(1)}`)
  return parts.length ? parts.join(' · ') : '기록 없음'
}

function YearGrid({ hm, range, today, onJump }: { hm: Heatmap; range: Range; today: string; onJump: (date: string) => void }) {
  const { weeks, from, to } = weeksOf(range, today)

  // 월 라벨: 달이 바뀌는 열 위에 표시 (첫 열 포함)
  const monthLabels: { col: number; label: string }[] = []
  let prevMonth = -1
  weeks.forEach((ws, i) => {
    const m = parseDate(ws).getMonth()
    if (m !== prevMonth) {
      monthLabels.push({ col: i, label: MONTHS_EN[m] })
      prevMonth = m
    }
  })
  // 첫 라벨이 다음 라벨과 너무 붙으면(부분 주) 생략
  if (monthLabels.length >= 2 && monthLabels[1].col - monthLabels[0].col < 3) monthLabels.shift()

  const gridStyle = { gridTemplateColumns: `auto repeat(${weeks.length}, 1fr)` }

  return (
    <div class="yv-block">
      <div class="yv-head">
        <span class="name">{hm.name}</span>
        {hm.type === 'streak' && <span class="streak-badge">🔥 {currentStreak(hm, today)}일</span>}
      </div>
      <div class="yv-grid" style={gridStyle}>
        {monthLabels.map((m) => (
          <span key={m.col} class="yv-month" style={{ gridColumn: m.col + 2, gridRow: 1 }}>{m.label}</span>
        ))}
        {[1, 3, 5].map((d) => (
          <span key={d} class="yv-day" style={{ gridColumn: 1, gridRow: d + 2 }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}</span>
        ))}
        {weeks.map((ws, w) =>
          Array.from({ length: 7 }, (_, d) => {
            const date = addDays(ws, d)
            if (date < from || date > to) {
              return <span key={date} style={{ gridColumn: w + 2, gridRow: d + 2 }} />
            }
            return (
              <span key={date} style={{ gridColumn: w + 2, gridRow: d + 2 }}>
                <Cell date={date} visual={cellVisual(hm, date, today)} onClick={() => onJump(date)} />
              </span>
            )
          })
        )}
      </div>
      <p class="yv-summary">{yearSummary(hm, from, to, today)}</p>
    </div>
  )
}

export function YearView({ heatmaps, today, onJump }: Props) {
  const [range, setRange] = useState<Range>('recent')

  const currentYear = parseDate(today).getFullYear()
  const firstYear = heatmaps.length
    ? Math.min(...heatmaps.map((h) => parseDate(startDate(h)).getFullYear()))
    : currentYear
  const years: number[] = []
  for (let y = currentYear; y >= firstYear; y--) years.push(y)

  return (
    <div class="yv-wrap">
      <div class="yv-ranges seg">
        <button class={range === 'recent' ? 'on' : ''} onClick={() => setRange('recent')}>최근 1년</button>
        {years.map((y) => (
          <button key={y} class={range === y ? 'on' : ''} onClick={() => setRange(y)}>{y}</button>
        ))}
      </div>
      {heatmaps.map((hm) => (
        <YearGrid key={hm.id} hm={hm} range={range} today={today} onJump={(date) => onJump(hm.id, date)} />
      ))}
      {heatmaps.length === 0 && <p class="hint" style={{ textAlign: 'center', padding: '32px 0' }}>히트맵이 없어요.</p>}
    </div>
  )
}
