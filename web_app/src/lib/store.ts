// 단일 store — localStorage 영속화 + 구독 + 마이그레이션 (specs/02 §1, §7)
import type { AppData, Entry, Heatmap, HeatmapType, PhysiqueMetric, PhysiqueGoalKey } from './types'
import { emptyData, DEFAULT_STREAK, DEFAULT_CONDITIONAL, defaultPhysique } from './types'
import { todayStr } from './dates'

const LS_KEY = 'lh:data'

type Listener = () => void
const listeners = new Set<Listener>()
/** 변경 후 훅 (sync 디바운스 등록용 — 순환 import 방지) */
let afterChange: (() => void) | null = null

let data: AppData = load()

function load(): AppData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return emptyData(Date.now())
    return migrate(JSON.parse(raw))
  } catch {
    return emptyData(Date.now())
  }
}

/** version 필드 기준 순차 마이그레이션. 최초 버전 1 */
export function migrate(d: unknown): AppData {
  const obj = d as AppData
  if (!obj || typeof obj !== 'object' || obj.version !== 1) return emptyData(Date.now())
  obj.tombstones ??= {}
  obj.heatmaps ??= []
  obj.settings ??= { weekLabel: 'range', u: 0 }
  for (const hm of obj.heatmaps) {
    hm.entries ??= {}
    hm.config ??= {}
    hm.createdAt ??= todayStr()
    if (hm.config.streak) hm.config.streak.baseStyle ??= 'solid' // D-11 이전 데이터 보강
  }
  // 신체 대시보드(specs/05) 이전 데이터 보강
  obj.physique ??= defaultPhysique(Date.now())
  obj.physique.entries ??= {}
  obj.physique.goals ??= defaultPhysique(Date.now()).goals
  obj.physique.targetDate ??= defaultPhysique(Date.now()).targetDate
  obj.physique.u ??= 0
  return obj
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    // 저장 실패(용량 등)는 조용히 무시 — 다음 변경에서 재시도
  }
}

export function getData(): AppData {
  return data
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) fn()
}

export function setAfterChange(fn: () => void) {
  afterChange = fn
}

/** 모든 변경은 이 함수를 통한다: 변이 → 저장 → 구독자 알림 → 동기화 훅 */
export function update(mutator: (d: AppData) => void) {
  mutator(data)
  persist()
  notify()
  afterChange?.()
}

/** 동기화 병합 결과 등 문서 전체 교체 (afterChange 호출 여부 선택) */
export function replaceData(next: AppData, opts: { triggerSync?: boolean } = {}) {
  data = migrate(next)
  persist()
  notify()
  if (opts.triggerSync) afterChange?.()
}

// ---- 헬퍼 ----

export function genId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'hm_' + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
}

export function createHeatmap(name: string, type: HeatmapType, streakMode: 'auto' | 'manual' = 'auto'): string {
  const id = genId()
  update((d) => {
    const now = Date.now()
    const hm: Heatmap = {
      id,
      name,
      type,
      order: d.heatmaps.length ? Math.max(...d.heatmaps.map((h) => h.order)) + 1 : 0,
      archived: false,
      createdAt: todayStr(),
      config: {},
      u: now,
      entries: {},
    }
    if (type === 'streak') hm.config.streak = { ...DEFAULT_STREAK, mode: streakMode, milestones: [...DEFAULT_STREAK.milestones], levels: [...DEFAULT_STREAK.levels] }
    if (type === 'conditional') hm.config.conditional = JSON.parse(JSON.stringify(DEFAULT_CONDITIONAL))
    d.heatmaps.push(hm)
  })
  return id
}

export function updateHeatmapMeta(id: string, patch: Partial<Pick<Heatmap, 'name' | 'type' | 'order' | 'archived' | 'config'>>) {
  update((d) => {
    const hm = d.heatmaps.find((h) => h.id === id)
    if (!hm) return
    Object.assign(hm, patch)
    // 유형 변경 시 기본 config 보강 (데이터는 보존 — R-03)
    if (hm.type === 'streak' && !hm.config.streak) hm.config.streak = JSON.parse(JSON.stringify(DEFAULT_STREAK))
    if (hm.type === 'conditional' && !hm.config.conditional) hm.config.conditional = JSON.parse(JSON.stringify(DEFAULT_CONDITIONAL))
    hm.u = Date.now()
  })
}

export function deleteHeatmap(id: string) {
  update((d) => {
    d.heatmaps = d.heatmaps.filter((h) => h.id !== id)
    d.tombstones[id] = Date.now()
  })
}

/** 엔트리 갱신. patch가 모두 빈 값이어도 u를 갱신한 "지움" 엔트리로 남긴다 (specs/02 §3) */
export function patchEntry(hmId: string, date: string, patch: Partial<Omit<Entry, 'u'>>) {
  update((d) => {
    const hm = d.heatmaps.find((h) => h.id === hmId)
    if (!hm) return
    const prev = hm.entries[date] ?? { u: 0 }
    hm.entries[date] = { ...prev, ...patch, u: Date.now() }
  })
}

export function clearEntry(hmId: string, date: string) {
  patchEntry(hmId, date, { fill: null, mark: null, markColor: null, border: false, fail: false, value: null })
}

export function setWeekLabel(mode: 'range' | 'number') {
  update((d) => {
    d.settings.weekLabel = mode
    d.settings.u = Date.now()
  })
}

// ---- 신체 대시보드 (specs/05 §3) ----

/** 해당 날짜의 측정을 통째로 저장(하루 1기록 — 덮어쓰기). null/undefined 지표는 저장하지 않음 */
export function savePhysiqueEntry(date: string, values: Partial<Record<PhysiqueMetric, number | null>>) {
  update((d) => {
    const entry: Record<string, number> & { u: number } = { u: Date.now() } as never
    for (const [k, v] of Object.entries(values)) {
      if (v != null && Number.isFinite(v)) (entry as Record<string, number>)[k] = v
    }
    d.physique.entries[date] = entry
  })
}

/** 측정 삭제 — 동기화 전파를 위해 u만 남긴 "지움" 엔트리 유지 */
export function deletePhysiqueEntry(date: string) {
  update((d) => {
    d.physique.entries[date] = { u: Date.now() }
  })
}

export function updatePhysiqueGoals(patch: { goals?: Partial<Record<PhysiqueGoalKey, number>>; targetDate?: string }) {
  update((d) => {
    if (patch.goals) Object.assign(d.physique.goals, patch.goals)
    if (patch.targetDate) d.physique.targetDate = patch.targetDate
    d.physique.u = Date.now()
  })
}

export function sortedHeatmaps(d: AppData, includeArchived = false): Heatmap[] {
  return d.heatmaps
    .filter((h) => includeArchived || !h.archived)
    .sort((a, b) => a.order - b.order)
}
