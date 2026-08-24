// 히트맵 카드 — 헤더(이름·연속일·범례) + 그리드 + 하단 요약줄 (specs/03 §2, §7)
import type { Heatmap, WeekLabelMode } from '../lib/types'
import { currentStreak, bestStreak } from '../lib/streak'
import { monthlyStats, usedFeatures, round1 } from '../lib/stats'
import { CellGrid } from './CellGrid'

interface Props {
  hm: Heatmap
  today: string
  labelMode: WeekLabelMode
  onToggleLabel: () => void
  onCellClick: (hmId: string, date: string, el: HTMLElement) => void
  onOpenStats: (hmId: string) => void
  onOpenLegend: (hmId: string, el: HTMLElement) => void
  onYearJump: (hmId: string, el: HTMLElement) => void
  scrollTarget?: { date: string; token: number } | null
}

export function summaryLine(hm: Heatmap, today: string): string {
  if (hm.type === 'streak') {
    return `🔥 현재 ${currentStreak(hm, today)}일 · 최고 ${bestStreak(hm, today)}일`
  }
  const m = monthlyStats(hm, today)[0]
  const used = usedFeatures(hm)
  if (!m) return '이번 달: 기록 없음'
  const parts: string[] = []
  if (used.fill && m.elapsedDays > 0) parts.push(`▨ ${Math.round((m.filled / m.elapsedDays) * 100)}%`)
  if (used.circle) parts.push(`◯ ${m.symbols.circle}`)
  if (used.x) parts.push(`✕ ${m.symbols.x}`)
  if (used.star) parts.push(`★ ${m.symbols.star}`)
  if (used.number) parts.push(`№ ${round1(m.numberSum)}`)
  if (used.value && m.valueDays > 0) parts.push(`평균 ${(m.valueSum / m.valueDays).toFixed(1)}`)
  return parts.length ? `이번 달: ${parts.join(' · ')}` : '이번 달: 기록 없음'
}

export function HeatmapCard(props: Props) {
  const { hm, today, labelMode } = props
  const hasLegend = (hm.config.legend?.length ?? 0) > 0

  return (
    <div class="hm-card">
      <div class="hm-head">
        <span class="name">{hm.name}</span>
        {hm.type === 'streak' && <span class="streak-badge">🔥 {currentStreak(hm, today)}일</span>}
        <span class="spacer" />
        {hasLegend && (
          <button class="icon-btn" title="범례" onClick={(e) => props.onOpenLegend(hm.id, e.currentTarget as HTMLElement)}>
            ⓘ
          </button>
        )}
        <button class="icon-btn" title="이동" onClick={(e) => props.onYearJump(hm.id, e.currentTarget as HTMLElement)}>
          ↥
        </button>
      </div>
      <CellGrid
        hm={hm}
        today={today}
        labelMode={labelMode}
        onToggleLabel={props.onToggleLabel}
        onCellClick={(date, el) => props.onCellClick(hm.id, date, el)}
        scrollTarget={props.scrollTarget}
      />
      <button class="hm-summary" onClick={() => props.onOpenStats(hm.id)} title="통계 보기">
        <span class="item">{summaryLine(hm, today)}</span>
      </button>
    </div>
  )
}
