// 칸 편집기 — 바텀시트(모바일)/팝오버(데스크톱), 탭 즉시 저장 (specs/03 §5)
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { Heatmap, PaletteKey, FillStyle, SymbolKind } from '../lib/types'
import { PALETTE, PALETTE_KEYS, matchCondRule } from '../lib/types'
import { patchEntry, clearEntry } from '../lib/store'
import { parseDate } from '../lib/dates'
import { streakOn, LEVEL_ALPHA } from '../lib/streak'
import { rgba } from './Cell'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  hm: Heatmap
  date: string
  anchor: DOMRect | null
  onClose: () => void
}

function Swatches({ current, onPick, withDefault }: { current: PaletteKey | null | undefined; onPick: (c: PaletteKey | null) => void; withDefault?: boolean }) {
  return (
    <span class="swatches">
      {withDefault && (
        <button
          class={`sw ${current == null ? 'on' : ''}`}
          style={{ background: 'var(--mark-default)' }}
          title="기본"
          onClick={() => onPick(null)}
        />
      )}
      {PALETTE_KEYS.map((k) => (
        <button
          key={k}
          class={`sw ${current === k ? 'on' : ''}`}
          style={{ background: PALETTE[k] }}
          title={k}
          onClick={() => onPick(k)}
        />
      ))}
    </span>
  )
}

export function CellEditor({ hm, date, anchor, onClose }: Props) {
  // backdrop 없이 외부 클릭으로 닫기 — 칸 클릭은 통과시켜 편집기 연 채 대상 전환 (specs/03 §5)
  useEffect(() => {
    const h = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null
      if (t?.closest('.editor') || t?.closest('.cell')) return
      onClose()
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [onClose])

  const e = hm.entries[date]
  const isFail = !!e?.fail
  const d = parseDate(date)
  const isDesktop = useMemo(() => window.matchMedia('(min-width: 768px)').matches, [])

  const cc = hm.type === 'conditional' ? hm.config.conditional : undefined
  const markSuppressed = !!cc?.showValue && e?.value != null

  // 데스크톱 팝오버 위치: 칸 오른쪽 우선, 화면 밖이면 왼쪽·상하 클램프
  const popStyle = useMemo(() => {
    if (!isDesktop || !anchor) return undefined
    const W = 320
    const H = 330
    let left = anchor.right + 10
    if (left + W > window.innerWidth - 8) left = anchor.left - W - 10
    if (left < 8) left = 8
    let top = anchor.top - 8
    if (top + H > window.innerHeight - 8) top = window.innerHeight - H - 8
    if (top < 8) top = 8
    return { left: `${left}px`, top: `${top}px` }
  }, [isDesktop, anchor])

  const patch = (p: Parameters<typeof patchEntry>[2]) => patchEntry(hm.id, date, p)

  const fillStyle: FillStyle | null = e?.fill?.style ?? null
  const setFillStyle = (s: FillStyle | null) => {
    if (s === null) patch({ fill: null })
    else patch({ fill: { style: s, color: e?.fill?.color ?? 'blue' } })
  }
  const setFillColor = (c: PaletteKey | null) => {
    if (c) patch({ fill: { style: fillStyle ?? 'hatch', color: c } })
  }

  const markKind = e?.mark?.kind === 'number' ? 'number' : e?.mark?.kind === 'symbol' ? e.mark.symbol : null
  const numValue = e?.mark?.kind === 'number' ? e.mark.value : null
  const setSymbol = (s: SymbolKind) => patch({ mark: { kind: 'symbol', symbol: s } })

  // 숫자 키패드 — 0~99.9, 소수 한 자리 (D-22). "7." 같은 중간 상태를 위해 문자열로 편집
  const [numText, setNumText] = useState<string | null>(null)
  useEffect(() => setNumText(null), [hm.id, date])
  const numShown = numText ?? (numValue != null ? String(numValue) : '')
  const commitNum = (t: string) => {
    setNumText(t)
    if (t === '' || t === '.') patch({ mark: null })
    else patch({ mark: { kind: 'number', value: Math.round(parseFloat(t) * 10) / 10 } })
  }
  const pressDigit = (dgt: number) => {
    const t = numShown
    if (t.includes('.')) {
      if (t.split('.')[1].length >= 1) return // 소수 한 자리까지만
      commitNum(t + dgt)
    } else if (t.replace('-', '').length >= 2) {
      commitNum(String(dgt)) // 정수부 2자리 초과 → 새로 입력 (기존 동작 유지)
    } else {
      commitNum(t === '0' ? String(dgt) : t + dgt)
    }
  }
  const pressDot = () => {
    const t = numShown
    if (t.includes('.')) return
    commitNum(t === '' ? '0.' : t + '.')
  }
  const backspace = () => {
    commitNum(numShown.slice(0, -1))
  }

  // 실패 체크는 채우기와만 배타 — 마크·테두리는 유지 (specs D-10)
  const setFail = (on: boolean) => {
    if (on) patch({ fail: true, fill: null })
    else patch({ fail: false })
  }

  const setValue = (raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw)
    patch({ value: n != null && Number.isFinite(n) ? n : null })
  }
  const matchedRule = cc && e?.value != null ? matchCondRule(cc.rules, e.value) : null

  const streakDays = hm.type === 'streak' && !isFail ? streakOn(hm, date) : null

  return (
    <>
      <div class="editor" style={popStyle}>
        <div class="ed-date">
          {d.getMonth() + 1}월 {d.getDate()}일 ({DAY_NAMES[d.getDay()]})
          {streakDays != null && streakDays > 0 && <span class="sub">{streakDays}일차</span>}
          {isFail && <span class="sub" style={{ color: 'var(--danger)' }}>실패 체크됨</span>}
          <span class="spacer" style={{ flex: 1 }} />
          <button class="icon-btn" title="닫기" onClick={onClose}>✕</button>
        </div>

        <div class={`ed-row ${isFail ? 'disabled' : ''}`}>
          <span class="ed-label">채우기</span>
          <span class="seg">
            <button class={fillStyle === null ? 'on' : ''} onClick={() => setFillStyle(null)}>없음</button>
            <button class={fillStyle === 'hatch' ? 'on' : ''} onClick={() => setFillStyle('hatch')}>빗금</button>
            <button class={fillStyle === 'solid' ? 'on' : ''} onClick={() => setFillStyle('solid')}>단색</button>
          </span>
        </div>
        {fillStyle && !isFail && (
          <div class="ed-row">
            <span class="ed-label" />
            <Swatches current={e?.fill?.color} onPick={setFillColor} />
          </div>
        )}

        <div class={`ed-row ${markSuppressed ? 'disabled' : ''}`}>
          <span class="ed-label">마크</span>
          <span class="seg">
            <button class={markKind === null ? 'on' : ''} onClick={() => patch({ mark: null })}>없음</button>
            <button class={markKind === 'number' ? 'on' : ''} onClick={() => { if (markKind !== 'number') patch({ mark: { kind: 'number', value: 0 } }) }}>123</button>
            <button class={markKind === 'circle' ? 'on' : ''} onClick={() => setSymbol('circle')}>◯</button>
            <button class={markKind === 'x' ? 'on' : ''} onClick={() => setSymbol('x')}>✕</button>
            <button class={markKind === 'star' ? 'on' : ''} onClick={() => setSymbol('star')}>★</button>
          </span>
        </div>
        {markKind === 'number' && !markSuppressed && (
          <div class="ed-row">
            <span class="ed-label num-preview">{numShown}</span>
            <span class="keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button key={n} onClick={() => pressDigit(n)}>{n}</button>
              ))}
              <button onClick={pressDot}>.</button>
              <button onClick={backspace}>⌫</button>
            </span>
          </div>
        )}
        {markKind != null && !markSuppressed && (
          <div class="ed-row">
            <span class="ed-label">마크 색</span>
            <Swatches current={e?.markColor} onPick={(c) => patch({ markColor: c })} withDefault />
          </div>
        )}

        <div class="ed-row">
          <span class="ed-label">테두리</span>
          <button class={`toggle ${e?.border ? 'on' : ''}`} onClick={() => patch({ border: !e?.border })}>
            테두리 강조
          </button>
        </div>

        {hm.type === 'streak' && (
          <div class="ed-row">
            <span class="ed-label">기록</span>
            <button class={`toggle fail-toggle ${isFail ? 'on' : ''}`} onClick={() => setFail(!isFail)}>
              실패 체크
            </button>
          </div>
        )}

        {cc && (
          <div class={`ed-row ${isFail ? 'disabled' : ''}`}>
            <span class="ed-label">수치</span>
            <input
              class="val-input"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={e?.value ?? ''}
              onInput={(ev) => setValue((ev.currentTarget as HTMLInputElement).value)}
            />
            {cc.unit && <span class="val-unit">{cc.unit}</span>}
            {matchedRule && (
              <span class="rule-chip" style={{ background: rgba(matchedRule.color, matchedRule.level != null ? LEVEL_ALPHA[Math.max(1, Math.min(5, matchedRule.level))] : 0.75) }} />
            )}
          </div>
        )}

        <div class="ed-actions">
          <button class="btn-clear" onClick={() => clearEntry(hm.id, date)}>이 날짜 지우기</button>
        </div>
      </div>
    </>
  )
}
