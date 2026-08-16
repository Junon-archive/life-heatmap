// JSON 백업 내보내기/가져오기 — specs/02 §6
import { getData, replaceData, migrate } from './store'
import { mergeData } from './merge'
import { todayStr } from './dates'

export function exportJSON() {
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `life-heatmap-backup-${todayStr().replaceAll('-', '')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 파일 선택 → 병합 또는 전체 교체. 성공 시 true */
export function importJSON(mode: 'merge' | 'replace'): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(false)
      try {
        const parsed = migrate(JSON.parse(await file.text()))
        const next = mode === 'merge' ? mergeData(getData(), parsed) : parsed
        replaceData(next, { triggerSync: true })
        resolve(true)
      } catch {
        alert('파일을 읽을 수 없어요. 올바른 백업 JSON인지 확인해 주세요.')
        resolve(false)
      }
    }
    input.click()
  })
}
