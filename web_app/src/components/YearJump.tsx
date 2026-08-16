// 연도 점프 — 연/월 선택 → 해당 주로 스크롤 (specs/03 §2)
import { useMemo, useState } from 'preact/hooks'
import type { Heatmap } from '../lib/types'
import { startDate } from '../lib/streak'
import { parseDate } from '../lib/dates'

interface Props {
  hm: Heatmap
  anchor: DOMRect
  today: string
  onJump: (date: string) => void
  onClose: () => void
}

export function YearJump({ hm, anchor, today, onJump, onClose }: Props) {
  const currentYear = parseDate(today).getFullYear()
  const firstYear = parseDate(startDate(hm)).getFullYear()
  const years: number[] = []
  for (let y = currentYear; y >= Math.min(firstYear, currentYear); y--) years.push(y)
  const [year, setYear] = useState(currentYear)

  const style = useMemo(() => {
    const W = 232
    let left = anchor.left - W + anchor.width
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    return { left: `${left}px`, top: `${anchor.bottom + 8}px`, width: `${W}px` }
  }, [anchor])

  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class="legend-pop" style={style}>
        <div class="seg" style={{ marginBottom: '8px', flexWrap: 'wrap' as const }}>
          {years.map((y) => (
            <button key={y} class={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const date = `${year}-${String(m).padStart(2, '0')}-01`
            const disabled = date > today
            return (
              <button
                key={m}
                class="btn ghost small"
                style={{ opacity: disabled ? 0.35 : 1 }}
                disabled={disabled}
                onClick={() => {
                  onJump(date)
                  onClose()
                }}
              >
                {m}월
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
