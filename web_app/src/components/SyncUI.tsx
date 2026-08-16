// 동기화 UI — 헤더 인디케이터 + 설정 섹션 (specs/02 §5.4, 03 §6)
import { useEffect, useReducer, useState } from 'preact/hooks'
import { getSyncState, subscribeSync, getSyncCode, setSyncCode, genSyncCode, syncNow, type SyncStatus } from '../lib/sync'

function useSyncState() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => subscribeSync(() => force(0)), [])
  return getSyncState()
}

const STATUS_DOT: Record<SyncStatus, string> = {
  off: 'var(--line)',
  idle: 'var(--c-green)',
  syncing: 'var(--c-amber)',
  offline: 'var(--text-faint)',
  error: 'var(--c-rose)',
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 헤더 인디케이터 — 동기화 미설정이면 렌더하지 않음 (로컬 전용 모드) */
export function SyncIndicator() {
  const { status, lastSync } = useSyncState()
  if (status === 'off') return null
  const label =
    status === 'syncing' ? '동기화 중…' : status === 'offline' ? '오프라인' : status === 'error' ? '오류' : lastSync ? fmtTime(lastSync) : ''
  return (
    <button class="sync-ind" title="지금 동기화" onClick={() => void syncNow()}>
      <span class="sync-dot" style={{ background: STATUS_DOT[status] }} />
      {label}
    </button>
  )
}

/** 설정 뷰의 동기화 섹션 */
export function SyncSection() {
  const { status, lastSync } = useSyncState()
  const code = getSyncCode()
  const [input, setInput] = useState('')
  const [reveal, setReveal] = useState(false)

  return (
    <section>
      <h3>동기화</h3>
      {code ? (
        <>
          <div class="row-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all' }}>
              {reveal ? code : `${code.slice(0, 4)}${'•'.repeat(8)}`}
            </span>
            <button class="btn ghost small" onClick={() => setReveal((r) => !r)}>{reveal ? '숨기기' : '보기'}</button>
            <button
              class="btn ghost small"
              onClick={() => navigator.clipboard?.writeText(code).then(() => alert('코드를 복사했어요. 다른 기기의 설정 → 동기화에 붙여넣으세요.'))}
            >
              복사
            </button>
          </div>
          <div class="ed-row">
            <button class="btn ghost" onClick={() => void syncNow()}>지금 동기화</button>
            <span class="hint" style={{ margin: 0 }}>
              {status === 'syncing' ? '동기화 중…' : status === 'offline' ? '오프라인' : status === 'error' ? '동기화 오류' : lastSync ? `마지막 동기화 ${fmtTime(lastSync)}` : ''}
            </span>
          </div>
          <button
            class="btn danger small"
            onClick={() => {
              if (confirm('이 기기에서 동기화를 해제할까요?\n기기에 저장된 기록은 그대로 남아요.')) setSyncCode(null)
            }}
          >
            동기화 해제
          </button>
        </>
      ) : (
        <>
          <div class="ed-row">
            <input
              class="text-input"
              style={{ flex: 1 }}
              value={input}
              placeholder="동기화 코드 입력"
              onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
            />
            <button class="btn" onClick={() => input.trim() && setSyncCode(input.trim())}>연결</button>
          </div>
          <button class="btn ghost small" onClick={() => setSyncCode(genSyncCode())}>새 코드 생성</button>
          <p class="hint">이 코드를 아는 기기만 데이터를 공유해요. 안전한 곳에 보관하세요.</p>
        </>
      )}
    </section>
  )
}
