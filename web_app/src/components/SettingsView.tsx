// 설정 뷰 — 히트맵 관리 / 유형별 설정 / 범례 편집 / 표시 설정 (specs/03 §6)
import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { Heatmap, HeatmapType, LegendItem, CondRule, PaletteKey, FillStyle } from '../lib/types'
import { PALETTE, PALETTE_KEYS, DEFAULT_STREAK, DEFAULT_CONDITIONAL } from '../lib/types'
import { getData, updateHeatmapMeta, deleteHeatmap, setWeekLabel, update } from '../lib/store'
import { exportJSON, importJSON } from '../lib/backup'
import { SyncSection } from './SyncUI'
import { useAppData } from '../lib/useData'
import { fillBackground, MarkGlyph } from './Cell'

function Swatches({ current, onPick }: { current: PaletteKey; onPick: (c: PaletteKey) => void }) {
  return (
    <span class="swatches">
      {PALETTE_KEYS.map((k) => (
        <button key={k} class={`sw ${current === k ? 'on' : ''}`} style={{ background: PALETTE[k] }} onClick={() => onPick(k)} />
      ))}
    </span>
  )
}

export function LegendSample({ item }: { item: LegendItem }) {
  return (
    <span
      class="legend-sample"
      style={{
        background: item.fill
          ? fillBackground(item.fill.style, item.fill.color, item.fill.style === 'hatch' ? 0.8 : 0.75)
          : 'var(--line-soft)',
      }}
    >
      {item.mark && <MarkGlyph mark={item.mark} color="var(--mark-default)" />}
    </span>
  )
}

/** config를 불변 갱신 후 저장 */
function patchConfig(hm: Heatmap, fn: (cfg: Heatmap['config']) => void) {
  const cfg = JSON.parse(JSON.stringify(hm.config)) as Heatmap['config']
  fn(cfg)
  updateHeatmapMeta(hm.id, { config: cfg })
}

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="ed-row">
      <span class="ed-label" style={{ width: '64px' }}>{label}</span>
      {children}
    </div>
  )
}

function NumListInput({ value, onCommit }: { value: number[]; onCommit: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <input
      class="text-input"
      style={{ width: '180px' }}
      value={text}
      inputMode="numeric"
      onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
      onBlur={() => {
        const nums = text
          .split(/[,\s]+/)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
        const uniq = [...new Set(nums)].sort((a, b) => a - b)
        if (uniq.length) {
          onCommit(uniq)
          setText(uniq.join(', '))
        } else {
          setText(value.join(', '))
        }
      }}
    />
  )
}

function StreakSettings({ hm }: { hm: Heatmap }) {
  const sc = hm.config.streak ?? DEFAULT_STREAK
  return (
    <section>
      <h3>연속일수 설정</h3>
      <Row label="채색">
        <span class="seg">
          <button class={sc.mode === 'auto' ? 'on' : ''} onClick={() => patchConfig(hm, (c) => { c.streak = { ...sc, mode: 'auto' } })}>자동</button>
          <button class={sc.mode === 'manual' ? 'on' : ''} onClick={() => patchConfig(hm, (c) => { c.streak = { ...sc, mode: 'manual' } })}>수동</button>
        </span>
      </Row>
      <Row label="채움 양식">
        <span class="seg">
          <button class={sc.baseStyle !== 'hatch' ? 'on' : ''} onClick={() => patchConfig(hm, (c) => { c.streak = { ...sc, baseStyle: 'solid' } })}>단색</button>
          <button class={sc.baseStyle === 'hatch' ? 'on' : ''} onClick={() => patchConfig(hm, (c) => { c.streak = { ...sc, baseStyle: 'hatch' } })}>빗금</button>
        </span>
      </Row>
      <Row label="기본 색">
        <Swatches current={sc.baseColor} onPick={(k) => patchConfig(hm, (c) => { c.streak = { ...sc, baseColor: k } })} />
      </Row>
      <Row label="마일스톤">
        <NumListInput value={sc.milestones} onCommit={(v) => patchConfig(hm, (c) => { c.streak = { ...sc, milestones: v } })} />
      </Row>
      <p class="hint">마일스톤 일차의 칸에 테두리 이펙트가 표시돼요. 쉼표로 구분해 입력.</p>
      <Row label="단계 경계">
        <NumListInput value={sc.levels} onCommit={(v) => patchConfig(hm, (c) => { c.streak = { ...sc, levels: v.slice(0, 5) } })} />
      </Row>
      <p class="hint">색이 진해지는 연속일 경계(최대 5개). 기본 1, 3, 7, 14, 30.</p>
    </section>
  )
}

function RuleEditor({ hm }: { hm: Heatmap }) {
  const cc = hm.config.conditional ?? DEFAULT_CONDITIONAL
  const setRules = (rules: CondRule[]) => patchConfig(hm, (c) => { c.conditional = { ...cc, rules } })
  const patchRule = (i: number, p: Partial<CondRule>) => setRules(cc.rules.map((r, j) => (j === i ? { ...r, ...p } : r)))

  return (
    <section>
      <h3>조건부 규칙 (위에서부터 첫 매칭)</h3>
      <Row label="단위">
        <input
          class="text-input"
          style={{ width: '90px' }}
          value={cc.unit ?? ''}
          placeholder="예: 시간"
          onInput={(e) => patchConfig(hm, (c) => { c.conditional = { ...cc, unit: (e.currentTarget as HTMLInputElement).value || undefined } })}
        />
        <button class={`toggle ${cc.showValue ? 'on' : ''}`} onClick={() => patchConfig(hm, (c) => { c.conditional = { ...cc, showValue: !cc.showValue } })}>
          칸에 수치 표시
        </button>
      </Row>
      {cc.rules.map((r, i) => (
        <div class="row-card" key={i}>
          <div class="ed-row" style={{ marginBottom: '6px' }}>
            <input
              class="val-input" style={{ width: '64px' }} type="number" step="0.1" placeholder="이상"
              value={r.min ?? ''}
              onInput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value
                patchRule(i, { min: v === '' ? null : Number(v) })
              }}
            />
            <span class="val-unit">이상 ~</span>
            <input
              class="val-input" style={{ width: '64px' }} type="number" step="0.1" placeholder="미만"
              value={r.max ?? ''}
              onInput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value
                patchRule(i, { max: v === '' ? null : Number(v) })
              }}
            />
            <span class="val-unit">미만</span>
            <span class="spacer" style={{ flex: 1 }} />
            <button class="btn danger small" onClick={() => setRules(cc.rules.filter((_, j) => j !== i))}>삭제</button>
          </div>
          <div class="ed-row" style={{ marginBottom: 0 }}>
            <span class="seg">
              <button class={r.style === 'hatch' ? 'on' : ''} onClick={() => patchRule(i, { style: 'hatch' })}>빗금</button>
              <button class={r.style === 'solid' ? 'on' : ''} onClick={() => patchRule(i, { style: 'solid' })}>단색</button>
            </span>
            <Swatches current={r.color} onPick={(k) => patchRule(i, { color: k })} />
          </div>
        </div>
      ))}
      <button class="btn ghost small" onClick={() => setRules([...cc.rules, { min: null, max: null, style: 'solid', color: 'slate' }])}>
        ＋ 규칙 추가
      </button>
    </section>
  )
}

function LegendEditor({ hm }: { hm: Heatmap }) {
  const legend = hm.config.legend ?? []
  const setLegend = (l: LegendItem[]) => patchConfig(hm, (c) => { c.legend = l })
  const patchItem = (i: number, p: Partial<LegendItem>) => setLegend(legend.map((it, j) => (j === i ? { ...it, ...p } : it)))

  const fillOf = (it: LegendItem): FillStyle | null => it.fill?.style ?? null
  const markOf = (it: LegendItem) => (it.mark?.kind === 'number' ? 'number' : it.mark?.kind === 'symbol' ? it.mark.symbol : null)

  return (
    <section>
      <h3>범례 (기본 숨김 — 카드의 ⓘ에서만 보여요)</h3>
      {legend.map((it, i) => (
        <div class="row-card" key={i}>
          <div class="ed-row" style={{ marginBottom: '6px' }}>
            <LegendSample item={it} />
            <input
              class="text-input" style={{ flex: 1 }}
              value={it.label} placeholder="의미 메모"
              onInput={(e) => patchItem(i, { label: (e.currentTarget as HTMLInputElement).value })}
            />
            <button class="btn danger small" onClick={() => setLegend(legend.filter((_, j) => j !== i))}>삭제</button>
          </div>
          <div class="ed-row" style={{ marginBottom: '6px' }}>
            <span class="seg">
              <button class={fillOf(it) === null ? 'on' : ''} onClick={() => patchItem(i, { fill: null })}>없음</button>
              <button class={fillOf(it) === 'hatch' ? 'on' : ''} onClick={() => patchItem(i, { fill: { style: 'hatch', color: it.fill?.color ?? 'blue' } })}>빗금</button>
              <button class={fillOf(it) === 'solid' ? 'on' : ''} onClick={() => patchItem(i, { fill: { style: 'solid', color: it.fill?.color ?? 'blue' } })}>단색</button>
            </span>
            {it.fill && <Swatches current={it.fill.color} onPick={(k) => patchItem(i, { fill: { style: it.fill!.style, color: k } })} />}
          </div>
          <div class="ed-row" style={{ marginBottom: 0 }}>
            <span class="seg">
              <button class={markOf(it) === null ? 'on' : ''} onClick={() => patchItem(i, { mark: null })}>없음</button>
              <button class={markOf(it) === 'number' ? 'on' : ''} onClick={() => patchItem(i, { mark: { kind: 'number', value: 1 } })}>123</button>
              <button class={markOf(it) === 'circle' ? 'on' : ''} onClick={() => patchItem(i, { mark: { kind: 'symbol', symbol: 'circle' } })}>◯</button>
              <button class={markOf(it) === 'x' ? 'on' : ''} onClick={() => patchItem(i, { mark: { kind: 'symbol', symbol: 'x' } })}>✕</button>
              <button class={markOf(it) === 'star' ? 'on' : ''} onClick={() => patchItem(i, { mark: { kind: 'symbol', symbol: 'star' } })}>★</button>
            </span>
          </div>
        </div>
      ))}
      <button class="btn ghost small" onClick={() => setLegend([...legend, { fill: { style: 'hatch', color: 'blue' }, mark: null, label: '' }])}>
        ＋ 범례 추가
      </button>
    </section>
  )
}

function HeatmapSettings({ hm, onBack }: { hm: Heatmap; onBack: () => void }) {
  return (
    <>
      <div class="panel-head">
        <button class="icon-btn" onClick={onBack}>←</button>
        <h2>{hm.name}</h2>
      </div>
      <section>
        <h3>이름</h3>
        <input
          class="text-input"
          value={hm.name}
          onInput={(e) => updateHeatmapMeta(hm.id, { name: (e.currentTarget as HTMLInputElement).value })}
        />
      </section>
      <section>
        <h3>유형 (변경해도 기록은 보존돼요)</h3>
        <span class="seg">
          {(['basic', 'streak', 'conditional'] as HeatmapType[]).map((t) => (
            <button key={t} class={hm.type === t ? 'on' : ''} onClick={() => updateHeatmapMeta(hm.id, { type: t })}>
              {t === 'basic' ? '일반' : t === 'streak' ? '연속일수형' : '조건부형'}
            </button>
          ))}
        </span>
      </section>
      {hm.type === 'streak' && <StreakSettings hm={hm} />}
      {hm.type === 'conditional' && <RuleEditor hm={hm} />}
      <LegendEditor hm={hm} />
      <section>
        <h3>관리</h3>
        <div class="ed-row">
          <button class="btn ghost" onClick={() => updateHeatmapMeta(hm.id, { archived: !hm.archived })}>
            {hm.archived ? '보관 해제' : '보관 (목록에서 숨김)'}
          </button>
          <button
            class="btn danger"
            onClick={() => {
              if (confirm(`"${hm.name}" 히트맵을 삭제할까요?\n삭제하면 복구할 수 없어요 — 먼저 JSON 내보내기를 권장해요.`)) {
                deleteHeatmap(hm.id)
                onBack()
              }
            }}
          >
            삭제
          </button>
        </div>
      </section>
    </>
  )
}

export function SettingsView({ onClose, extraSections }: { onClose: () => void; extraSections?: ComponentChildren }) {
  const data = useAppData()
  const [editing, setEditing] = useState<string | null>(null)
  const all = [...data.heatmaps].sort((a, b) => a.order - b.order)
  const editingHm = editing ? data.heatmaps.find((h) => h.id === editing) : undefined

  function move(id: string, dir: -1 | 1) {
    const idx = all.findIndex((h) => h.id === id)
    const other = all[idx + dir]
    if (!other) return
    const hm = all[idx]
    update((d) => {
      const a = d.heatmaps.find((h) => h.id === hm.id)!
      const b = d.heatmaps.find((h) => h.id === other.id)!
      const tmp = a.order
      a.order = b.order
      b.order = tmp
      a.u = Date.now()
      b.u = Date.now()
    })
  }

  return (
    <div class="panel-wrap">
      <div class="backdrop dim" onClick={onClose} />
      <div class="panel">
        {editingHm ? (
          <HeatmapSettings hm={editingHm} onBack={() => setEditing(null)} />
        ) : (
          <>
            <div class="panel-head">
              <h2>설정</h2>
              <button class="icon-btn" onClick={onClose}>✕</button>
            </div>
            <section>
              <h3>히트맵</h3>
              {all.map((hm, i) => (
                <div class="row-card" key={hm.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button style={{ flex: 1, textAlign: 'left', fontWeight: 600 }} onClick={() => setEditing(hm.id)}>
                    {hm.name}
                    <span class="hint" style={{ display: 'inline', marginLeft: '8px' }}>
                      {hm.type === 'basic' ? '일반' : hm.type === 'streak' ? '연속일수형' : '조건부형'}
                      {hm.archived ? ' · 보관됨' : ''}
                    </span>
                  </button>
                  <button class="icon-btn" disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }} onClick={() => move(hm.id, -1)}>↑</button>
                  <button class="icon-btn" disabled={i === all.length - 1} style={{ opacity: i === all.length - 1 ? 0.3 : 1 }} onClick={() => move(hm.id, 1)}>↓</button>
                </div>
              ))}
              {all.length === 0 && <p class="hint">아직 히트맵이 없어요. 메인 화면의 ＋로 만들 수 있어요.</p>}
            </section>
            <section>
              <h3>표시</h3>
              <div class="ed-row">
                <span class="ed-label" style={{ width: '64px' }}>행 라벨</span>
                <span class="seg">
                  <button class={getData().settings.weekLabel === 'range' ? 'on' : ''} onClick={() => setWeekLabel('range')}>날짜 범위</button>
                  <button class={getData().settings.weekLabel === 'number' ? 'on' : ''} onClick={() => setWeekLabel('number')}>주 번호</button>
                </span>
              </div>
            </section>
            <SyncSection />
            <section>
              <h3>백업</h3>
              <div class="ed-row">
                <button class="btn ghost" onClick={exportJSON}>JSON 내보내기</button>
                <button class="btn ghost" onClick={() => importJSON('merge')}>가져오기 (병합)</button>
                <button
                  class="btn danger"
                  onClick={() => {
                    if (confirm('현재 기기의 모든 기록을 파일 내용으로 교체할까요?\n기존 기록은 사라져요.')) importJSON('replace')
                  }}
                >
                  가져오기 (전체 교체)
                </button>
              </div>
              <p class="hint">병합은 날짜별로 더 최근에 수정된 기록을 남겨요.</p>
            </section>
            {extraSections}
          </>
        )}
      </div>
    </div>
  )
}
