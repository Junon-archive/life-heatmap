// LWW 병합 — specs/02 §5.3
// 단위: settings(u) / 히트맵 메타(id별 u) / 엔트리(id+날짜별 u) / tombstones(합집합)
// tombstone 시각이 히트맵 u보다 크면 삭제 유지
import type { AppData, Heatmap, Entry } from './types'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function mergeEntries(a: Record<string, Entry>, b: Record<string, Entry>): Record<string, Entry> {
  const out: Record<string, Entry> = clone(a)
  for (const [date, eb] of Object.entries(b)) {
    const ea = out[date]
    if (!ea || (eb.u ?? 0) > (ea.u ?? 0)) out[date] = clone(eb)
  }
  return out
}

function mergeHeatmap(a: Heatmap, b: Heatmap): Heatmap {
  const meta = (b.u ?? 0) > (a.u ?? 0) ? b : a
  return {
    ...clone(meta),
    entries: mergeEntries(a.entries, b.entries),
  }
}

export function mergeData(a: AppData, b: AppData): AppData {
  const settings = (b.settings.u ?? 0) > (a.settings.u ?? 0) ? clone(b.settings) : clone(a.settings)

  const tombstones: Record<string, number> = { ...a.tombstones }
  for (const [id, ts] of Object.entries(b.tombstones ?? {})) {
    tombstones[id] = Math.max(tombstones[id] ?? 0, ts)
  }

  const byId = new Map<string, Heatmap>()
  for (const hm of a.heatmaps) byId.set(hm.id, clone(hm))
  for (const hm of b.heatmaps) {
    const existing = byId.get(hm.id)
    byId.set(hm.id, existing ? mergeHeatmap(existing, hm) : clone(hm))
  }

  // tombstone이 히트맵의 마지막 수정보다 나중이면 삭제 유지, 아니면 부활(재추가로 간주)
  const heatmaps: Heatmap[] = []
  for (const hm of byId.values()) {
    const ts = tombstones[hm.id]
    if (ts && ts > lastTouched(hm)) continue
    if (ts && ts <= lastTouched(hm)) delete tombstones[hm.id]
    heatmaps.push(hm)
  }
  heatmaps.sort((x, y) => x.order - y.order)

  return { version: 1, settings, heatmaps, tombstones }
}

function lastTouched(hm: Heatmap): number {
  let max = hm.u ?? 0
  for (const e of Object.values(hm.entries)) max = Math.max(max, e.u ?? 0)
  return max
}
