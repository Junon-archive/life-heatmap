// 범례 팝오버 — 카드 ⓘ에서만 노출, 기본 숨김 (specs/03 §8)
import { useMemo } from 'preact/hooks'
import type { Heatmap } from '../lib/types'
import { LegendSample } from './SettingsView'

export function LegendPopover({ hm, anchor, onClose }: { hm: Heatmap; anchor: DOMRect; onClose: () => void }) {
  const style = useMemo(() => {
    const W = 240
    let left = anchor.left - W / 2 + anchor.width / 2
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    return { left: `${left}px`, top: `${anchor.bottom + 8}px`, width: `${W}px` }
  }, [anchor])

  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class="legend-pop" style={style}>
        {(hm.config.legend ?? []).map((it, i) => (
          <div class="li" key={i}>
            <LegendSample item={it} />
            <span>{it.label || '—'}</span>
          </div>
        ))}
      </div>
    </>
  )
}
