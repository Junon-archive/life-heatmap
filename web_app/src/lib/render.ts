// 칸의 시각 상태 계산 — specs/03 §3 (순수 함수, 컴포넌트에서 사용)
import type { Heatmap, Mark, PaletteKey, FillStyle } from './types'
import { matchCondRule } from './types'
import { streakOn, levelFor, isMilestone, LEVEL_ALPHA } from './streak'

export interface CellVisual {
  fill: { style: FillStyle; color: PaletteKey; alpha: number } | null
  mark: Mark | null
  markColor: PaletteKey | null // null = 기본 진회색
  border: boolean
  milestone: boolean
  milestoneColor: PaletteKey | null
  today: boolean
  future: boolean
  pastEmpty: boolean // 지난 날짜 + 시각적 내용 없음 → 회색 점
  valueText: string | null // conditional 수치 표시
}

const HATCH_ALPHA = 0.8
const SOLID_ALPHA = 0.75

export function cellVisual(hm: Heatmap, date: string, today: string): CellVisual {
  const e = hm.entries[date]
  const future = date > today
  const v: CellVisual = {
    fill: null,
    mark: null,
    markColor: null,
    border: false,
    milestone: false,
    milestoneColor: null,
    today: date === today,
    future,
    pastEmpty: false,
    valueText: null,
  }

  const isFail = !!e?.fail

  // 실패 체크는 채우기만 배타 — 마크·테두리는 함께 표기 가능 (specs R-11, D-10)
  if (e) {
    if (!isFail && e.fill) v.fill = { style: e.fill.style, color: e.fill.color, alpha: e.fill.style === 'hatch' ? HATCH_ALPHA : SOLID_ALPHA }
    v.mark = e.mark ?? null
    v.markColor = e.markColor ?? null
    v.border = !!e.border
  }

  // streak 유형: 그라데이션·마일스톤 (specs/03 §3.2)
  const sc = hm.type === 'streak' ? hm.config.streak : undefined
  if (sc && !future && !isFail) {
    const days = streakOn(hm, date)
    const level = levelFor(days, sc.levels)
    if (level > 0) {
      if (v.fill) {
        // 수동 채움도 단계 강도를 따른다 (D-11)
        v.fill = { ...v.fill, alpha: LEVEL_ALPHA[level] }
      } else if (sc.mode === 'auto') {
        // 자동 채색: 엔트리 없어도 baseStyle·baseColor 단계 채움
        v.fill = { style: sc.baseStyle ?? 'solid', color: sc.baseColor, alpha: LEVEL_ALPHA[level] }
      }
    }
    if (isMilestone(days, sc.milestones) && (sc.mode === 'auto' || v.fill)) {
      v.milestone = true
      v.milestoneColor = v.fill?.color ?? sc.baseColor
    }
  }

  // conditional 유형: 수치 → 규칙 채색 (specs/03 §3.2)
  const cc = hm.type === 'conditional' ? hm.config.conditional : undefined
  if (cc && e && e.value != null && !isFail) {
    const rule = matchCondRule(cc.rules, e.value)
    if (rule) v.fill = { style: rule.style, color: rule.color, alpha: rule.style === 'hatch' ? HATCH_ALPHA : SOLID_ALPHA }
    if (cc.showValue) {
      v.valueText = String(e.value)
      v.mark = null // 수치 표시 중엔 별도 마크 비활성 (specs/03 §3.2)
    }
  }

  v.pastEmpty = !future && !v.fill && !v.mark && !v.border && !v.valueText
  return v
}
