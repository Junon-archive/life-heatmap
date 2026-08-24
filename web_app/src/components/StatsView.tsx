// 통계 뷰 — 월/분기 집계 오버레이 (specs/03 §7)
import { useState } from 'preact/hooks'
import type { Heatmap } from '../lib/types'
import { PALETTE } from '../lib/types'
import { monthlyStats, quarterlyStats, usedFeatures, round1, type PeriodStats } from '../lib/stats'
import { currentStreak, bestStreak, milestoneHistory } from '../lib/streak'
import { LegendSample } from './SettingsView'

function fmtPeriod(p: string): string {
  if (p.includes('Q')) return `${p.slice(2, 4)}년 ${p.slice(5)}`
  return `${p.slice(2, 4)}년 ${Number(p.slice(5, 7))}월`
}

export function StatsView({ hm, today, onClose }: { hm: Heatmap; today: string; onClose: () => void }) {
  const [unit, setUnit] = useState<'month' | 'quarter'>('month')
  const [showLegend, setShowLegend] = useState(false)
  const rows: PeriodStats[] = unit === 'month' ? monthlyStats(hm, today) : quarterlyStats(hm, today)
  const used = usedFeatures(hm)
  const isStreak = hm.type === 'streak'
  const fillColor = hm.config.streak?.baseColor ?? 'blue'
  const legend = hm.config.legend ?? []

  return (
    <div class="panel-wrap">
      <div class="backdrop dim" onClick={onClose} />
      <div class="panel">
        <div class="panel-head">
          <h2>{hm.name} — 통계</h2>
          <span class="seg">
            <button class={unit === 'month' ? 'on' : ''} onClick={() => setUnit('month')}>월별</button>
            <button class={unit === 'quarter' ? 'on' : ''} onClick={() => setUnit('quarter')}>분기별</button>
          </span>
          <button class="icon-btn" onClick={onClose}>✕</button>
        </div>

        {isStreak && (
          <section>
            <div class="row-card" style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
              <span>🔥 현재 <strong>{currentStreak(hm, today)}일</strong></span>
              <span>최고 <strong>{bestStreak(hm, today)}일</strong></span>
            </div>
          </section>
        )}

        <section style={{ overflowX: 'auto' }}>
          <table class="stat-table">
            <thead>
              <tr>
                <th>기간</th>
                {used.fill && <th>▨ 채움</th>}
                {used.circle && <th>◯</th>}
                {used.x && <th>✕</th>}
                {used.star && <th>★</th>}
                {used.number && <th>№ 합</th>}
                {used.value && <th>평균</th>}
                {isStreak && <th>실패</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.elapsedDays > 0 ? Math.round((r.filled / r.elapsedDays) * 100) : 0
                return (
                  <tr key={r.period}>
                    <td>{fmtPeriod(r.period)}</td>
                    {used.fill && (
                      <td>
                        {pct}%
                        <span class="bar-wrap">
                          <span class="bar" style={{ width: `${pct}%`, background: PALETTE[fillColor] }} />
                        </span>
                      </td>
                    )}
                    {used.circle && <td>{r.symbols.circle}</td>}
                    {used.x && <td>{r.symbols.x}</td>}
                    {used.star && <td>{r.symbols.star}</td>}
                    {used.number && <td>{round1(r.numberSum)}</td>}
                    {used.value && <td>{r.valueDays ? (r.valueSum / r.valueDays).toFixed(1) : '–'}</td>}
                    {isStreak && <td>{r.fails}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p class="hint">아직 기록이 없어요.</p>}
        </section>

        {isStreak && (
          <section>
            <h3>마일스톤 달성</h3>
            {milestoneHistory(hm, today, hm.config.streak?.milestones ?? []).map((m) => (
              <div class="row-card" key={`${m.date}-${m.days}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>🏅 {m.days}일</span>
                <span class="hint">{m.date}</span>
              </div>
            ))}
            {milestoneHistory(hm, today, hm.config.streak?.milestones ?? []).length === 0 && (
              <p class="hint">아직 달성한 마일스톤이 없어요.</p>
            )}
          </section>
        )}

        {legend.length > 0 && (
          <section>
            <button class="btn ghost small" onClick={() => setShowLegend((s) => !s)}>
              {showLegend ? '범례 숨기기' : '범례 보기'}
            </button>
            {showLegend && (
              <div style={{ marginTop: '8px' }}>
                {legend.map((it, i) => (
                  <div class="li" key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px' }}>
                    <LegendSample item={it} />
                    <span>{it.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
