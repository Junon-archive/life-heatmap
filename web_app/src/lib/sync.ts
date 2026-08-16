// 동기화 엔진 — local-first, pull→merge→push, 3초 디바운스 (specs/02 §5)
import { getData, replaceData, setAfterChange, migrate } from './store'
import { mergeData } from './merge'

const CODE_LS = 'lh:syncCode'
const DEBOUNCE_MS = 3000

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

let status: SyncStatus = 'off'
let lastSync: number | null = null
const listeners = new Set<() => void>()
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let syncing = false
let pendingAgain = false

function notify() {
  for (const fn of listeners) fn()
}

function setStatus(s: SyncStatus) {
  status = s
  notify()
}

export function getSyncState(): { status: SyncStatus; lastSync: number | null } {
  return { status, lastSync }
}

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSyncCode(): string | null {
  return localStorage.getItem(CODE_LS)
}

export function setSyncCode(code: string | null) {
  if (code) {
    localStorage.setItem(CODE_LS, code)
    setStatus('idle')
    void syncNow()
  } else {
    localStorage.removeItem(CODE_LS)
    setStatus('off')
  }
}

/** 랜덤 동기화 코드 생성 (24자 영숫자) */
export function genSyncCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function keyHex(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function syncNow(): Promise<void> {
  const code = getSyncCode()
  if (!code) {
    setStatus('off')
    return
  }
  if (syncing) {
    pendingAgain = true
    return
  }
  syncing = true
  setStatus('syncing')
  try {
    const key = await keyHex(code)
    const headers = { 'X-Sync-Key': key }

    const res = await fetch('/api/data', { headers })
    let remote: ReturnType<typeof getData> | null = null
    if (res.ok) remote = migrate(await res.json())
    else if (res.status !== 404) throw new Error(`GET ${res.status}`)

    const local = getData()
    const merged = remote ? mergeData(local, remote) : local
    const mergedJson = JSON.stringify(merged)

    if (mergedJson !== JSON.stringify(local)) replaceData(merged) // triggerSync 없이 — 루프 방지
    if (!remote || mergedJson !== JSON.stringify(remote)) {
      const put = await fetch('/api/data', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: mergedJson,
      })
      if (!put.ok) throw new Error(`PUT ${put.status}`)
    }
    lastSync = Date.now()
    setStatus('idle')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  } finally {
    syncing = false
    if (pendingAgain) {
      pendingAgain = false
      scheduleSync()
    }
  }
}

/** 로컬 편집 후 3초 디바운스 push. 오프라인이면 online 복귀 시 재시도 */
export function scheduleSync() {
  if (!getSyncCode()) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void syncNow(), DEBOUNCE_MS)
}

export function initSync() {
  setAfterChange(scheduleSync)
  if (getSyncCode()) {
    status = 'idle'
    void syncNow()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
}
