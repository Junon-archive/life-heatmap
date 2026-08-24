// 데이터 스키마 — specs/02_data_model.md §1~3
export type PaletteKey = 'blue' | 'rose' | 'green' | 'amber' | 'violet' | 'slate'
export type FillStyle = 'hatch' | 'solid'
export type SymbolKind = 'circle' | 'x' | 'star'
export type HeatmapType = 'basic' | 'streak' | 'conditional'
export type WeekLabelMode = 'range' | 'number'

export interface Fill {
  style: FillStyle
  color: PaletteKey
}

export type Mark =
  | { kind: 'number'; value: number }
  | { kind: 'symbol'; symbol: SymbolKind }

export interface Entry {
  fill?: Fill | null
  mark?: Mark | null
  markColor?: PaletteKey | null
  border?: boolean
  fail?: boolean
  value?: number | null
  u: number
}

export interface LegendItem {
  fill?: Fill | null
  mark?: Mark | null
  label: string
}

export interface StreakConfig {
  mode: 'auto' | 'manual'
  baseColor: PaletteKey
  baseStyle: FillStyle // 자동 채색의 채움 양식 (D-11)
  milestones: number[]
  levels: number[]
}

export interface CondRule {
  min: number | null // null = 하한 없음. min ≤ value < max
  max: number | null // null = 상한 없음
  style: FillStyle
  color: PaletteKey
  level?: number // 강도 1~5 (LEVEL_ALPHA 단계, D-23). 생략 = 4 (기존 룩)
}

export interface ConditionalConfig {
  unit?: string
  showValue: boolean
  rules: CondRule[]
}

export interface HeatmapConfig {
  legend?: LegendItem[]
  streak?: StreakConfig
  conditional?: ConditionalConfig
  condAvg?: boolean // 조건부형 「주 평균 보기」 상태 (D-24, 영속·동기화)
}

export interface Heatmap {
  id: string
  name: string
  type: HeatmapType
  order: number
  archived: boolean
  createdAt: string // YYYY-MM-DD — streak 시작일 계산에 사용
  config: HeatmapConfig
  u: number // 메타(name/type/order/archived/config) 수정 시각
  entries: Record<string, Entry> // key: YYYY-MM-DD
}

export interface Settings {
  weekLabel: WeekLabelMode
  u: number
}

// ---- 신체 대시보드 (specs/05) ----
export type PhysiqueMetric = 'weight' | 'bodyFat' | 'shoulder' | 'muscle' | 'waist' | 'arm'
export type PhysiqueGoalKey = PhysiqueMetric | 'ratio'

export type PhysiqueEntry = { [K in PhysiqueMetric]?: number | null } & { u: number }

export interface PhysiqueData {
  u: number // goals/targetDate 수정 시각 (LWW)
  targetDate: string // YYYY-MM-DD
  goals: Record<PhysiqueGoalKey, number>
  entries: Record<string, PhysiqueEntry> // key: YYYY-MM-DD, 하루 1기록
}

export function defaultPhysique(now: number): PhysiqueData {
  return {
    u: now,
    targetDate: '2026-11-30',
    goals: { weight: 68, bodyFat: 12, shoulder: 51, muscle: 37, waist: 75, arm: 37.5, ratio: 1.6 },
    entries: {},
  }
}

export interface AppData {
  version: 1
  settings: Settings
  heatmaps: Heatmap[]
  tombstones: Record<string, number> // 삭제된 히트맵 id → 삭제 시각
  physique: PhysiqueData
}

export const PALETTE: Record<PaletteKey, string> = {
  blue: '#3B82F6',
  rose: '#F43F5E',
  green: '#22C55E',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  slate: '#64748B',
}

export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[]

export const DEFAULT_STREAK: StreakConfig = {
  mode: 'auto',
  baseColor: 'violet',
  baseStyle: 'solid',
  milestones: [7, 30, 50, 100, 365],
  levels: [1, 3, 7, 14, 30],
}

export const DEFAULT_CONDITIONAL: ConditionalConfig = {
  showValue: true,
  rules: [
    { min: null, max: 6, style: 'solid', color: 'rose' },
    { min: 6, max: 9, style: 'solid', color: 'blue' },
    { min: 9, max: null, style: 'solid', color: 'violet' },
  ],
}

export function emptyData(now: number): AppData {
  return {
    version: 1,
    settings: { weekLabel: 'range', u: now },
    heatmaps: [],
    tombstones: {},
    physique: defaultPhysique(now),
  }
}

/** 엔트리에 시각적 내용이 전혀 없는가 (u 갱신용 "지움" 엔트리 판단) */
export function entryIsEmpty(e: Entry): boolean {
  return !e.fill && !e.mark && !e.border && !e.fail && e.value == null
}

/** 조건부 규칙 매칭: 위에서부터 첫 매칭 (min ≤ value < max, null=무한) */
export function matchCondRule(rules: CondRule[], value: number): CondRule | null {
  for (const r of rules) {
    if ((r.min == null || value >= r.min) && (r.max == null || value < r.max)) return r
  }
  return null
}
