import { useEffect, useReducer } from 'preact/hooks'
import { getData, subscribe } from './store'
import type { AppData } from './types'

/** store 구독 훅 — 변경 시 리렌더 */
export function useAppData(): AppData {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => subscribe(() => force(0)), [])
  return getData()
}
