// 주 단위 그리드 — specs/03 §2, §3
// 위 = 과거, 아래 = 최신. 초기 오늘 행이 하단에 오도록 스크롤, 위로 스크롤 시 과거 로드
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Heatmap, WeekLabelMode } from '../lib/types'
import { matchCondRule } from '../lib/types'
import { addDays, weekStart, weekLabel, parseDate } from '../lib/dates'
import { cellVisual } from '../lib/render'
import { round1 } from '../lib/stats'
import { Cell } from './Cell'

const INITIAL_WEEKS = 12
const LOAD_CHUNK = 24
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  hm: Heatmap
  today: string
  labelMode: WeekLabelMode
  onToggleLabel: () => void
  onCellClick: (date: string, el: HTMLElement) => void
  /** 연도 점프 등 외부에서 특정 주로 스크롤하고 싶을 때 */
  scrollTarget?: { date: string; token: number } | null
  /** 조건부형 「주 평균 보기」(D-24): 토요일 칸의 표시 숫자만 주 평균으로 대체 */
  condAvg?: boolean
}

export function CellGrid({ hm, today, labelMode, onToggleLabel, onCellClick, scrollTarget, condAvg }: Props) {
  const [weeks, setWeeks] = useState(INITIAL_WEEKS)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingPrepend = useRef<number | null>(null) // 과거 로드 전 scrollHeight
  const didInit = useRef(false)

  const thisWeek = weekStart(today)
  const currentYear = parseDate(today).getFullYear()
  const weekStarts: string[] = []
  for (let i = weeks - 1; i >= 0; i--) weekStarts.push(addDays(thisWeek, -7 * i))

  // 초기: 오늘 행(맨 아래)이 보이도록 맨 아래로 스크롤 (R-20: 과거가 위에 함께 보임)
  useEffect(() => {
    const el = scrollRef.current
    if (el && !didInit.current) {
      didInit.current = true
      el.scrollTop = el.scrollHeight
    }
  }, [])

  // 과거 로드 후 스크롤 위치 보정
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && pendingPrepend.current != null) {
      el.scrollTop += el.scrollHeight - pendingPrepend.current
      pendingPrepend.current = null
    }
  }, [weeks])

  // 연도 점프: 대상 주가 범위 밖이면 확장 후 스크롤
  useEffect(() => {
    if (!scrollTarget) return
    const target = weekStart(scrollTarget.date)
    const diffWeeks = Math.round((parseDate(thisWeek).getTime() - parseDate(target).getTime()) / (7 * 86400000))
    if (diffWeeks >= weeks) {
      setWeeks(diffWeeks + 4)
      // 확장 렌더 후 다음 effect 사이클에서 스크롤
      requestAnimationFrame(() => scrollToWeek(target))
    } else {
      scrollToWeek(target)
    }
    function scrollToWeek(ws: string) {
      const el = scrollRef.current?.querySelector(`[data-week="${ws}"]`)
      el?.scrollIntoView({ block: 'start' })
    }
  }, [scrollTarget?.token])

  function loadPast() {
    const el = scrollRef.current
    if (el) pendingPrepend.current = el.scrollHeight
    setWeeks((w) => w + LOAD_CHUNK)
  }

  function onScroll() {
    const el = scrollRef.current
    if (el && el.scrollTop < 30 && pendingPrepend.current == null) loadPast()
  }

  return (
    <>
      <div class="hm-days hm-cols">
        <button class="label-toggle" onClick={onToggleLabel} title="라벨 전환">
          {labelMode === 'range' ? '날짜' : '주 번호'}
        </button>
        {DAY_NAMES.map((d) => (
          <span class="d" key={d}>{d}</span>
        ))}
      </div>
      <div class="hm-scroll" ref={scrollRef} onScroll={onScroll}>
        <button class="load-past" onClick={loadPast}>이전 주 보기</button>
        {weekStarts.map((ws) => {
          // 주 평균 (D-24): 값이 입력된 날들의 평균. 없으면 표시 안 함
          let avg: number | null = null
          if (condAvg && hm.type === 'conditional') {
            const vals: number[] = []
            for (let i = 0; i < 7; i++) {
              const v = hm.entries[addDays(ws, i)]?.value
              if (v != null) vals.push(v)
            }
            if (vals.length) avg = round1(vals.reduce((a, b) => a + b, 0) / vals.length)
          }
          return (
            <div class="hm-week hm-cols" key={ws} data-week={ws}>
              <span class="wk-label">{weekLabel(ws, labelMode, currentYear)}</span>
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(ws, i)
                const v = cellVisual(hm, date, today)
                if (avg != null && i === 6) {
                  // 토요일 칸: 표시 숫자만 평균으로 대체 + glow로 구분. 채우기·마크·편집은 토요일 그대로
                  v.valueText = String(avg)
                  v.mark = null
                  v.milestone = true
                  v.milestoneColor = matchCondRule(hm.config.conditional?.rules ?? [], avg)?.color ?? 'slate'
                  v.pastEmpty = false
                }
                return <Cell key={date} date={date} visual={v} onClick={onCellClick} />
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}
