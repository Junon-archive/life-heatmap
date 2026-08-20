// 신체 대시보드 — specs/05 §4 (목업 temp/physique_mockup.html 구성 확정본)
import { useState } from 'preact/hooks'
import type { PhysiqueData, PhysiqueGoalKey, PhysiqueMetric } from '../lib/types'
import { diffDays } from '../lib/dates'
import {
  METRICS, GOAL_KEYS, METRIC_INFO, series, firstPoint, lastPoint, latestEntryDate,
  progress, overallProgress, regression, weeklyPace, expectedDate, requiredPace, dday,
  projectionTone, ratioOf, type Point,
} from '../lib/physique'

interface Props {
  ph: PhysiqueData
  today: string
  onEdit: (date: string | null) => void
}

const fmt = (v: number, d: number) => v.toFixed(d)
const signFmt = (v: number, d: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d)

function dateShort(date: string, today: string): string {
  const y = date.slice(0, 4)
  const md = `${date.slice(5, 7)}-${date.slice(8, 10)}`
  return y === today.slice(0, 4) ? md : `'${y.slice(2)} ${md}`
}

// ---- 추세 차트 (자체 SVG, 정규화 축) ----
const CHART_COLORS: Partial<Record<PhysiqueGoalKey, string>> = {
  weight: 'var(--c-blue)', waist: 'var(--c-green)', muscle: 'var(--c-amber)', ratio: 'var(--c-violet)',
}

function ChartSVG({ ph, keys, today }: { ph: PhysiqueData; keys: PhysiqueGoalKey[]; today: string }) {
  const plotted = keys
    .map((k) => ({ key: k, pts: series(ph, k), color: CHART_COLORS[k] ?? 'var(--c-blue)' }))
    .filter((p) => p.pts.length > 0)
  if (!plotted.length) return <p class="hint" style={{ padding: '32px 0', textAlign: 'center' }}>표시할 기록이 아직 없어요.</p>

  const xMinD = plotted.map((p) => p.pts[0].date).sort()[0]
  const xMaxD = [ph.targetDate, today, ...plotted.map((p) => p.pts[p.pts.length - 1].date)].sort().pop()!
  const span = Math.max(1, diffDays(xMinD, xMaxD))
  const X0 = 52
  const X1 = 748
  const x = (d: string) => X0 + (diffDays(xMinD, d) / span) * (X1 - X0)

  const yOf = (k: PhysiqueGoalKey, pts: Point[], v: number) => {
    const start = pts[0].value
    const goal = ph.goals[k]
    const n = goal === start ? 0.5 : (v - start) / (goal - start)
    return 20 + Math.max(-0.08, Math.min(1.08, n)) * 180
  }

  const single = plotted.length === 1 ? plotted[0] : null

  return (
    <svg viewBox="0 0 760 240" preserveAspectRatio="none" aria-label="추세 차트">
      {[20, 65, 110, 155].map((gy) => <line key={gy} x1={X0} y1={gy} x2={X1} y2={gy} class="gridline" />)}
      <line x1={X0} y1={200} x2={X1} y2={200} class="pv-goal-line" />
      <text x={2} y={24} class="pv-axis">{single ? fmt(single.pts[0].value, METRIC_INFO[single.key].decimals) : '시작'}</text>
      <text x={2} y={204} class="pv-axis">{single ? fmt(ph.goals[single.key], METRIC_INFO[single.key].decimals) : '목표'}</text>
      {plotted.map(({ key, pts, color }) => {
        const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${yOf(key, pts, p.value).toFixed(1)}`).join(' ')
        const r = regression(pts)
        const last = pts[pts.length - 1]
        let fc = ''
        if (r && Math.abs(r.slope) > 1e-12 && xMaxD > last.date) {
          const vEnd = r.intercept + r.slope * diffDays(r.x0, xMaxD)
          fc = `M${x(last.date).toFixed(1)} ${yOf(key, pts, last.value).toFixed(1)} L${X1} ${yOf(key, pts, vEnd).toFixed(1)}`
        }
        return (
          <g key={key}>
            <path d={path} fill="none" style={{ stroke: color, strokeWidth: 2.2 }} />
            {fc && <path d={fc} fill="none" style={{ stroke: color, strokeWidth: 1.4, strokeDasharray: '5 4', opacity: 0.6 }} />}
            {pts.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={yOf(key, pts, p.value)} r={3.2} style={{ fill: 'var(--card)', stroke: color, strokeWidth: 2 }} />
            ))}
            {single && (
              <text x={Math.min(x(last.date) + 6, 700)} y={yOf(key, pts, last.value) - 6} class="pv-axis" style={{ fill: color }}>
                {fmt(last.value, METRIC_INFO[key].decimals)}
              </text>
            )}
          </g>
        )
      })}
      <text x={X0} y={226} class="pv-axis">{dateShort(xMinD, today)}</text>
      <text x={700} y={226} class="pv-axis">{dateShort(ph.targetDate, today)}</text>
    </svg>
  )
}

/** 다중 라인일 때 겹치는 라인 라벨 대신 쓰는 범례 */
function ChartLegend({ ph, keys }: { ph: PhysiqueData; keys: PhysiqueGoalKey[] }) {
  const items = keys
    .map((k) => ({ key: k, last: lastPoint(ph, k), color: CHART_COLORS[k] ?? 'var(--c-blue)' }))
    .filter((i) => i.last)
  if (items.length < 2) return null
  return (
    <div class="pv-legend">
      {items.map((i) => (
        <span key={i.key}>
          <i style={{ background: i.color }} />
          {METRIC_INFO[i.key].label} {fmt(i.last!.value, METRIC_INFO[i.key].decimals)}
        </span>
      ))}
    </div>
  )
}

// ---- 메인 뷰 ----
export function PhysiqueView({ ph, today, onEdit }: Props) {
  const [tab, setTab] = useState<'all' | 'weight' | 'waist' | 'muscle' | 'ratio'>('all')

  const hasData = latestEntryDate(ph) != null
  if (!hasData) {
    return (
      <div class="pv-wrap">
        <div class="empty" style={{ minHeight: '50vh' }}>
          <p>아직 측정 기록이 없어요.</p>
          <button class="btn" onClick={() => onEdit(null)}>＋ 첫 측정 기록하기</button>
          <p class="types">목표값과 목표 날짜는 ⚙ 설정에서 바꿀 수 있어요.</p>
        </div>
      </div>
    )
  }

  const latest = latestEntryDate(ph)!
  const rStart = firstPoint(ph, 'ratio')
  const rLast = lastPoint(ph, 'ratio')
  const rProg = progress(ph, 'ratio')
  const overall = overallProgress(ph)
  const days = dday(ph, today)

  const recent = Object.entries(ph.entries)
    .filter(([, e]) => METRICS.some((m) => e[m] != null))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 10)

  return (
    <div class="pv-wrap">
      {/* 히어로 */}
      <section class="pv-row pv-hero">
        <article class="pv-panel pv-hero-main">
          <div class="pv-eyebrow">대표 지표 · 어깨/허리 비율</div>
          <div class="pv-big">
            {rLast ? fmt(rLast.value, 2) : '–'} <span>/ 목표 {fmt(ph.goals.ratio, 2)}</span>
          </div>
          <p class="pv-copy">
            {rLast
              ? <>목표까지 <b>{signFmt(ph.goals.ratio - rLast.value, 2)}</b> — 어깨 확장과 허리 감소가 동시에 진행될수록 빨라져요.</>
              : '어깨 폭과 허리 둘레를 같은 날 기록하면 비율이 계산돼요.'}
          </p>
          <div class="pv-track-row">
            <span>시작 {rStart ? fmt(rStart.value, 2) : '–'}</span>
            <span>목표 {fmt(ph.goals.ratio, 2)}</span>
          </div>
          <div class="pv-track"><i style={{ width: `${Math.round((rProg ?? 0) * 100)}%` }} /></div>
        </article>
        <article class="pv-panel pv-dday">
          <div class="pv-eyebrow">{days >= 0 ? '목표일까지' : '목표일 지남'}</div>
          <div class="pv-big">{Math.abs(days)} <span>일{days < 0 ? ' 경과' : ''}</span></div>
          <div class="pv-foot"><span>목표 날짜</span><b>{ph.targetDate}</b></div>
        </article>
        <article class="pv-panel">
          <div class="pv-eyebrow">종합 진행률</div>
          <div class="pv-ring-wrap">
            <div class="pv-ring" style={{ background: `conic-gradient(var(--c-violet) 0 ${Math.round((overall?.value ?? 0) * 100)}%, var(--line-soft) ${Math.round((overall?.value ?? 0) * 100)}% 100%)` }}>
              <b>{overall ? Math.round(overall.value * 100) : 0}%</b>
            </div>
          </div>
          <div class="pv-ring-cap">시작값 → 목표값 기준, {overall?.count ?? 0}개 지표 평균</div>
        </article>
      </section>

      {/* 지표 카드 6장 */}
      <section class="pv-row pv-metrics">
        {METRICS.map((m: PhysiqueMetric) => {
          const info = METRIC_INFO[m]
          const first = firstPoint(ph, m)
          const last = lastPoint(ph, m)
          const prog = progress(ph, m)
          const delta = first && last ? last.value - first.value : null
          return (
            <article class="pv-panel pv-metric" key={m}>
              <div class="pv-metric-top">
                <span class="label">
                  {info.label}
                  {last && last.date !== latest && <span class="pv-stale">{dateShort(last.date, today)} 기준</span>}
                </span>
                {delta != null && (
                  <span class={`pv-delta ${delta === 0 ? 'zero' : ''}`}>{signFmt(delta, info.decimals)} {info.unit}</span>
                )}
              </div>
              <div class="val">{last ? fmt(last.value, info.decimals) : '–'} <span>{info.unit}</span></div>
              <div class="pv-bar"><i style={{ width: `${Math.round((prog ?? 0) * 100)}%` }} /></div>
              <div class="pv-metric-foot">
                <span>{first ? `${fmt(first.value, info.decimals)} 시작` : '기록 없음'}</span>
                <b>{fmt(ph.goals[m], info.decimals)} 목표</b>
              </div>
            </article>
          )
        })}
      </section>

      {/* 추세 + 예측 */}
      <section class="pv-row pv-mid">
        <article class="pv-panel">
          <div class="pv-panel-head">
            <div><h3>추세</h3><div class="sub">시작(위) → 목표(아래) 정규화 · 점선은 전 기간 회귀 연장</div></div>
            <span class="seg">
              {([['all', '종합'], ['weight', '체중'], ['waist', '허리'], ['muscle', '골격근'], ['ratio', '비율']] as const).map(([id, label]) => (
                <button key={id} class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </span>
          </div>
          <div class="pv-chart">
            <ChartSVG ph={ph} keys={tab === 'all' ? ['weight', 'waist', 'muscle', 'ratio'] : [tab]} today={today} />
            <ChartLegend ph={ph} keys={tab === 'all' ? ['weight', 'waist', 'muscle', 'ratio'] : [tab]} />
          </div>
        </article>
        <article class="pv-panel">
          <div class="pv-panel-head"><div><h3>목표 예측</h3><div class="sub">전 기간 선형 회귀 기준</div></div></div>
          {GOAL_KEYS.map((k) => {
            const info = METRIC_INFO[k]
            const proj = expectedDate(ph, k)
            const tone = projectionTone(proj, ph.targetDate)
            const pace = weeklyPace(ph, k)
            return (
              <div class="pv-proj-row" key={k}>
                <span class="name">{info.label} {fmt(ph.goals[k], info.decimals)}{info.unit}</span>
                <span style={{ textAlign: 'right' }}>
                  <span class={`date ${tone !== 'none' ? tone : ''}`}>
                    {proj.kind === 'date' ? dateShort(proj.date, today) : proj.kind === 'insufficient' ? '데이터 부족' : '현재 추세로 도달 불가'}
                  </span>
                  {pace != null && <div class="pv-proj-meta">{signFmt(pace, info.decimals)} {info.unit}/주</div>}
                </span>
              </div>
            )
          })}
        </article>
      </section>

      {/* 페이스 + 최근 기록 */}
      <section class="pv-row pv-bottom">
        <article class="pv-panel">
          <div class="pv-panel-head"><div><h3>필요 페이스 vs 현재 페이스</h3><div class="sub">회색 = 목표일까지 필요한 주당 속도, 파랑 = 전 기간 회귀 속도</div></div></div>
          {METRICS.map((m) => {
            const info = METRIC_INFO[m]
            const req = requiredPace(ph, m, today)
            const act = weeklyPace(ph, m)
            const first = firstPoint(ph, m)
            const arrow = first != null ? (ph.goals[m] < first.value ? '↓' : '↑') : ''
            const scale = Math.max(Math.abs(req ?? 0), Math.abs(act ?? 0), 1e-9)
            return (
              <div class="pv-pace-row" key={m}>
                <label>{info.label} {arrow}</label>
                <div class="pv-dual">
                  <span class="req" style={{ width: `${req != null ? Math.round((Math.abs(req) / scale) * 100) : 0}%` }} />
                  <span class="act" style={{ width: `${act != null ? Math.round((Math.abs(act) / scale) * 100) : 0}%` }} />
                </div>
                <div class="pv-pace-num">
                  <b>{act != null ? Math.abs(act).toFixed(2) : '–'} / {req != null ? Math.abs(req).toFixed(2) : '–'}</b>
                  {info.unit || '비율'}·주
                </div>
              </div>
            )
          })}
        </article>
        <article class="pv-panel">
          <div class="pv-panel-head"><div><h3>최근 기록</h3><div class="sub">행을 탭하면 수정할 수 있어요</div></div></div>
          <table class="pv-table">
            <thead><tr><th>날짜</th><th>체중</th><th>체지방</th><th>허리</th><th>비율</th><th></th></tr></thead>
            <tbody>
              {recent.map(([date, e]) => (
                <tr key={date} onClick={() => onEdit(date)}>
                  <td>{dateShort(date, today)}</td>
                  <td>{e.weight != null ? fmt(e.weight, 1) : '–'}</td>
                  <td>{e.bodyFat != null ? fmt(e.bodyFat, 1) : '–'}</td>
                  <td>{e.waist != null ? fmt(e.waist, 1) : '–'}</td>
                  <td>{e.shoulder != null && e.waist != null ? fmt(ratioOf(e.shoulder, e.waist), 2) : '–'}</td>
                  <td class="pv-edit">✎</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  )
}
