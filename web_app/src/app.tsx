import { useEffect, useRef, useState } from 'preact/hooks'
import { useAppData } from './lib/useData'
import { sortedHeatmaps, setWeekLabel } from './lib/store'
import { todayStr } from './lib/dates'
import { HeatmapCard } from './components/HeatmapCard'
import { CellEditor } from './components/CellEditor'
import { CreateFlow } from './components/CreateFlow'

interface EditorTarget {
  hmId: string
  date: string
  anchor: DOMRect | null
}

export function App() {
  const data = useAppData()
  const heatmaps = sortedHeatmaps(data)

  // 자정이 지나면 today 갱신
  const [today, setToday] = useState(todayStr())
  useEffect(() => {
    const t = setInterval(() => setToday((prev) => (prev === todayStr() ? prev : todayStr())), 30_000)
    return () => clearInterval(t)
  }, [])

  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const editorHm = editor ? heatmaps.find((h) => h.id === editor.hmId) : undefined

  function onCellClick(hmId: string, date: string, el: HTMLElement) {
    // 편집기 연 채로 다른 칸 탭 → 대상만 전환 (specs/03 §5)
    setEditor({ hmId, date, anchor: el.getBoundingClientRect() })
  }

  function onBoardScroll() {
    const el = boardRef.current
    if (el && el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  const toggleLabel = () => setWeekLabel(data.settings.weekLabel === 'range' ? 'number' : 'range')

  return (
    <>
      <header class="header">
        <h1>Life Heatmap</h1>
        <span class="spacer" />
        <button class="icon-btn" title="추가" onClick={() => setCreateOpen(true)}>＋</button>
        <button class="icon-btn" title="설정">⚙</button>
      </header>

      {heatmaps.length === 0 ? (
        <div class="empty">
          <p>아직 히트맵이 없어요.</p>
          <button class="btn" onClick={() => setCreateOpen(true)}>＋ 히트맵 만들기</button>
          <p class="types">
            일반 — 표기를 자유롭게 기록<br />
            연속일수형 — 연속일이 쌓일수록 진해짐<br />
            조건부형 — 수치에 따라 자동 채색
          </p>
        </div>
      ) : (
        <>
          <div class="board" ref={boardRef} onScroll={onBoardScroll}>
            {heatmaps.map((hm) => (
              <HeatmapCard
                key={hm.id}
                hm={hm}
                today={today}
                labelMode={data.settings.weekLabel}
                onToggleLabel={toggleLabel}
                onCellClick={onCellClick}
                onOpenStats={() => {}}
                onOpenLegend={() => {}}
                onYearJump={() => {}}
              />
            ))}
          </div>
          {heatmaps.length > 1 && (
            <div class="dots">
              {heatmaps.map((hm, i) => (
                <button
                  key={hm.id}
                  class={`dot ${i === page ? 'on' : ''}`}
                  onClick={() => boardRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center' })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editor && editorHm && (
        <CellEditor hm={editorHm} date={editor.date} anchor={editor.anchor} onClose={() => setEditor(null)} />
      )}
      {createOpen && <CreateFlow onClose={() => setCreateOpen(false)} onCreated={() => {}} />}
    </>
  )
}
