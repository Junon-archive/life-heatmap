import type { CellVisual } from '../lib/render'
import type { Mark, PaletteKey } from '../lib/types'
import { PALETTE } from '../lib/types'

export function rgba(key: PaletteKey, alpha: number): string {
  const hex = PALETTE[key]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 빗금 배경 — specs/03 §4.1 (45° 스트라이프 3px/3px) */
export function fillBackground(style: 'hatch' | 'solid', color: PaletteKey, alpha: number): string {
  const c = rgba(color, alpha)
  if (style === 'solid') return c
  return `repeating-linear-gradient(45deg, ${c} 0 3px, transparent 3px 6px)`
}

export function MarkGlyph({ mark, color }: { mark: Mark; color: string }) {
  if (mark.kind === 'number') {
    // 소수 포함 3~4글자(예: 7.5, 99.9)는 칸 안에 들어가도록 축소 (D-22)
    const long = String(mark.value).length > 2
    return <span class={`mark num${long ? ' long' : ''}`} style={{ color }}>{mark.value}</span>
  }
  const stroke = { stroke: color, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' as const }
  return (
    <span class="mark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {mark.symbol === 'circle' && <circle cx="12" cy="12" r="8" {...stroke} />}
        {mark.symbol === 'x' && (
          <>
            <line x1="6" y1="6" x2="18" y2="18" {...stroke} />
            <line x1="18" y1="6" x2="6" y2="18" {...stroke} />
          </>
        )}
        {mark.symbol === 'star' && (
          <path
            d="M12 2.5l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2-5.6 3.2 1.3-6.2L3 9l6.3-.7z"
            fill={color}
            stroke="none"
          />
        )}
      </svg>
    </span>
  )
}

interface Props {
  date: string
  visual: CellVisual
  onClick: (date: string, el: HTMLElement) => void
  /** 연간 보기 등 초소형 칸: 숫자/수치 텍스트는 점으로 대체, 테두리·마일스톤 축소 (specs D-14) */
  compact?: boolean
}

export function Cell({ date, visual: v, onClick, compact }: Props) {
  const cls = [
    'cell',
    v.pastEmpty && 'past-empty',
    v.today && 'today',
    v.future && 'future',
  ]
    .filter(Boolean)
    .join(' ')

  const markColor = v.markColor ? PALETTE[v.markColor] : 'var(--mark-default)'

  return (
    <button
      class={cls}
      aria-label={date}
      onClick={(e) => onClick(date, e.currentTarget as HTMLElement)}
    >
      {/* compact(연간 보기): 채우기는 단색 통일, 숫자·수치는 표기하지 않음 (D-16) */}
      {v.fill && (
        <span class="layer" style={{ background: fillBackground(compact ? 'solid' : v.fill.style, v.fill.color, v.fill.alpha) }} />
      )}
      {v.mark && !(compact && v.mark.kind === 'number') && <MarkGlyph mark={v.mark} color={markColor} />}
      {!v.mark && v.valueText != null && !compact && (
        <span class="mark val" style={{ color: markColor }}>{v.valueText}</span>
      )}
      {v.border && <span class="border-hl" style={{ boxShadow: `inset 0 0 0 ${compact ? 1 : 2}px ${markColor}` }} />}
      {v.milestone && v.milestoneColor && (
        <span
          class="milestone-fx"
          style={{
            boxShadow: compact
              ? `0 0 0 1px ${PALETTE[v.milestoneColor]}, 0 0 3px 0 ${rgba(v.milestoneColor, 0.55)}`
              : `0 0 0 2px ${PALETTE[v.milestoneColor]}, 0 0 8px 1px ${rgba(v.milestoneColor, 0.55)}`,
          }}
        />
      )}
    </button>
  )
}
