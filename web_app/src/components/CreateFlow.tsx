// 새 히트맵 생성 — 이름 → 유형 → (streak면 auto/manual) (specs/03 §9)
import { useState } from 'preact/hooks'
import type { HeatmapType } from '../lib/types'
import { createHeatmap } from '../lib/store'

const TYPE_DESC: { type: HeatmapType; title: string; desc: string }[] = [
  { type: 'basic', title: '일반', desc: '표기(채우기·숫자·기호)를 자유롭게 기록' },
  { type: 'streak', title: '연속일수형', desc: '연속일수를 세고 색이 점점 진해짐 · 마일스톤 테두리' },
  { type: 'conditional', title: '조건부형', desc: '수치를 입력하면 구간 규칙에 따라 자동 채색' },
]

export function CreateFlow({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<HeatmapType>('basic')
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')

  function submit() {
    const id = createHeatmap(name.trim() || '새 히트맵', type, mode)
    onCreated(id)
    onClose()
  }

  return (
    <div class="panel-wrap">
      <div class="backdrop dim" onClick={onClose} />
      <div class="panel" style={{ height: 'auto', maxHeight: '90dvh' }}>
        <div class="panel-head">
          <h2>새 히트맵</h2>
          <button class="icon-btn" onClick={onClose}>✕</button>
        </div>
        <section>
          <h3>이름</h3>
          <input
            class="text-input"
            value={name}
            placeholder="예: 기상/출근"
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
          <p class="hint">이름은 언제든 설정에서 바꿀 수 있어요.</p>
        </section>
        <section>
          <h3>유형</h3>
          {TYPE_DESC.map((t) => (
            <button
              key={t.type}
              class="row-card"
              style={{ display: 'block', width: '100%', textAlign: 'left', borderColor: type === t.type ? 'var(--text)' : undefined }}
              onClick={() => setType(t.type)}
            >
              <strong style={{ fontSize: '14px' }}>{t.title}</strong>
              <div class="hint">{t.desc}</div>
            </button>
          ))}
        </section>
        {type === 'streak' && (
          <section>
            <h3>채색 방식</h3>
            <span class="seg">
              <button class={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>자동 — 실패만 체크하면 자동 채색</button>
              <button class={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>수동 — 매일 직접 채움</button>
            </span>
          </section>
        )}
        <button class="btn" style={{ width: '100%' }} onClick={submit}>만들기</button>
      </div>
    </div>
  )
}
