// 조건부형 추세 팝업 — specs D-25
// 세로축: 데이터 min/max 자동 + nice tick. 가로축: 날짜 라벨 4~5개 자동 솎음.
// 규칙 경계값은 옅은 점선으로 표시해 "지금 어느 구간인가"를 직관적으로.
import { useMemo, useState } from 'preact/hooks'
import type { Heatmap } from '../lib/types'
import { PALETTE } from '../lib/types'
import { addDays, diffDays } from '../lib/dates'
import { round1 } from '../lib/stats'

// viewBox를 모바일 폭 기준으로 잡아 축 라벨이 과도하게 축소되지 않게 한다
const W = 380
const H = 230
const M = { l: 34, r: 10, t: 12, b: 24 }

type Period = 'all' | 90 | 30

/** 사람이 읽기 좋은 눈금 간격 (1/2/2.5/5 × 10^n) */
function niceStep(span: number, targetTicks: number): number {
  const raw = span / targetTicks
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return m * pow
  }
  return 10 * pow
}

export function CondTrendPopup({ hm, today, onClose }: { hm: Heatmap; today: string; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('all')
  const cc = hm.config.conditional
  const unit = cc?.unit ?? ''

  const all = useMemo(
    () =>
      Object.entries(hm.entries)
        .filter(([, e]) => e.value != null)
        .map(([date, e]) => ({ date, value: e.value! }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [hm],
  )
  const points = period === 'all' ? all : all.filter((p) => p.date >= addDays(today, -(period - 1)))

  if (!all.length) {
    return (
      <div class="panel-wrap">
        <div class="backdrop dim" onClick={onClose} />
        <div class="panel" style={{ height: 'auto' }}>
          <div class="panel-head"><h2>{hm.name} — 추세</h2><button class="icon-btn" onClick={onClose}>✕</button></div>
          <p class="hint" style={{ padding: '24px 0', textAlign: 'center' }}>아직 입력된 수치가 없어요.</p>
        </div>
      </div>
    )
  }

  const vals = points.map((p) => p.value)
  const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  const dataMin = Math.min(...vals)
  const dataMax = Math.max(...vals)

  // 세로축 자동 범위: 데이터 ±8% 패딩 후 nice tick으로 확장 (min=max면 ±1)
  const pad = dataMax === dataMin ? 1 : (dataMax - dataMin) * 0.08
  const step = niceStep(dataMax - dataMin + pad * 2 || 2, 4)
  const yMin = Math.floor((dataMin - pad) / step) * step
  const yMax = Math.ceil((dataMax + pad) / step) * step
  const ticks: number[] = []
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(round1(t * 10) / 10)

  const x0 = points[0].date
  const xSpan = Math.max(1, diffDays(x0, points[points.length - 1].date))
  const x = (d: string) => M.l + (diffDays(x0, d) / xSpan) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * (H - M.t - M.b)

  // 가로축 라벨: 최대 5개 균등 (같은 날짜 중복 제거)
  const labelCount = Math.min(5, points.length)
  const xLabels = [...new Set(Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / Math.max(1, labelCount - 1)) * (points.length - 1))
    return points[idx].date
  }))]
  const fmtDate = (d: string) =>
    d.slice(0, 4) === today.slice(0, 4) ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : `'${d.slice(2, 4)} ${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

  // 규칙 경계값 (범위 안에 있는 것만, 중복 제거)
  const bounds = [...new Set((cc?.rules ?? []).flatMap((r) => [r.min, r.max]).filter((b): b is number => b != null && b > yMin && b < yMax))]

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const showDots = points.length <= 40
  const line = 'var(--c-blue)'

  return (
    <div class="panel-wrap">
      <div class="backdrop dim" onClick={onClose} />
      <div class="panel" style={{ height: 'auto', maxHeight: '92dvh' }}>
        <div class="panel-head">
          <h2>{hm.name} — 추세{unit ? ` (${unit})` : ''}</h2>
          <span class="seg">
            {([['all', '전체'], [90, '90일'], [30, '30일']] as const).map(([id, label]) => (
              <button key={String(id)} class={period === id ? 'on' : ''} onClick={() => setPeriod(id as Period)}>{label}</button>
            ))}
          </span>
          <button class="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div class="trend-chips">
          <span>평균 <b>{avg}</b></span>
          <span>최소 <b>{dataMin}</b></span>
          <span>최대 <b>{dataMax}</b></span>
          <span>기록 <b>{points.length}</b>회</span>
        </div>
        {points.length === 0 ? (
          <p class="hint" style={{ padding: '24px 0', textAlign: 'center' }}>이 기간에는 기록이 없어요.</p>
        ) : (
          <div class="trend-chart">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="추세 그래프">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.l} y1={y(t)} x2={W - M.r} y2={y(t)} class="gridline" />
                  <text x={M.l - 6} y={y(t) + 3} class="pv-axis" text-anchor="end">{t}</text>
                </g>
              ))}
              {bounds.map((b) => {
                const rule = (cc?.rules ?? []).find((r) => r.min === b || r.max === b)
                return (
                  <line
                    key={b} x1={M.l} y1={y(b)} x2={W - M.r} y2={y(b)}
                    style={{ stroke: rule ? PALETTE[rule.color] : 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '3 4', opacity: 0.4 }}
                  />
                )
              })}
              <path d={path} fill="none" style={{ stroke: line, strokeWidth: points.length > 40 ? 1.2 : 1.8, strokeLinejoin: 'round' }} />
              {showDots && points.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.4} style={{ fill: 'var(--card)', stroke: line, strokeWidth: 1.6 }} />
              ))}
              {xLabels.map((d) => (
                <text key={d} x={x(d)} y={H - 7} class="pv-axis" text-anchor="middle">{fmtDate(d)}</text>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
