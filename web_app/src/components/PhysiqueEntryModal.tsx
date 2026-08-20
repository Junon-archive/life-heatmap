// 측정 입력/수정 모달 — specs/05 §4. 빈 칸은 저장하지 않음(부분 입력), 미래 날짜 금지
import { useState } from 'preact/hooks'
import type { PhysiqueData, PhysiqueMetric } from '../lib/types'
import { METRICS, METRIC_INFO, RATIO_COEF } from '../lib/physique'
import { savePhysiqueEntry, deletePhysiqueEntry } from '../lib/store'

interface Props {
  ph: PhysiqueData
  date: string | null // null = 새 측정
  today: string
  onClose: () => void
}

export function PhysiqueEntryModal({ ph, date, today, onClose }: Props) {
  const editing = date != null
  const [day, setDay] = useState(date ?? today)
  const existing = ph.entries[day]
  const [values, setValues] = useState<Record<PhysiqueMetric, string>>(() => {
    const v = {} as Record<PhysiqueMetric, string>
    for (const m of METRICS) v[m] = existing?.[m] != null ? String(existing[m]) : ''
    return v
  })

  const anyValue = METRICS.some((m) => values[m].trim() !== '')

  function save() {
    const parsed: Partial<Record<PhysiqueMetric, number | null>> = {}
    for (const m of METRICS) {
      const t = values[m].trim()
      const n = t === '' ? null : Number(t)
      parsed[m] = n != null && Number.isFinite(n) ? n : null
    }
    savePhysiqueEntry(day, parsed)
    onClose()
  }

  function remove() {
    if (confirm(`${day} 측정 기록을 삭제할까요?`)) {
      deletePhysiqueEntry(day)
      onClose()
    }
  }

  return (
    <div class="panel-wrap">
      <div class="backdrop dim" onClick={onClose} />
      <div class="panel" style={{ height: 'auto', maxHeight: '92dvh' }}>
        <div class="panel-head">
          <h2>측정 기록</h2>
          <button class="icon-btn" onClick={onClose}>✕</button>
        </div>
        <section>
          <div class="pv-fields">
            <div class="pv-field full">
              <label>날짜</label>
              <input
                class="text-input"
                type="date"
                value={day}
                max={today}
                disabled={editing}
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value
                  if (v && v <= today) setDay(v)
                }}
              />
            </div>
            {METRICS.map((m) => (
              <div class="pv-field" key={m}>
                <label>{METRIC_INFO[m].label}{METRIC_INFO[m].unit ? ` (${METRIC_INFO[m].unit})` : ''}</label>
                <input
                  class="text-input"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={values[m]}
                  onInput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value
                    setValues((s) => ({ ...s, [m]: v }))
                  }}
                />
              </div>
            ))}
          </div>
          <p class="hint">어깨/허리 비율은 두 값이 모두 있을 때만 자동 계산돼요 ({RATIO_COEF} × 어깨 폭 ÷ 허리 둘레). 빈 칸은 저장하지 않아요.</p>
        </section>
        <div class="ed-row" style={{ marginBottom: 0 }}>
          {editing && <button class="btn danger" onClick={remove}>삭제</button>}
          <span style={{ flex: 1 }} />
          <button class="btn ghost" onClick={onClose}>취소</button>
          <button class="btn" disabled={!anyValue && !editing} style={{ opacity: !anyValue && !editing ? 0.4 : 1 }} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
