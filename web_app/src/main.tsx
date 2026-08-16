import { render } from 'preact'
import { App } from './app'
import { initSync } from './lib/sync'
import './styles/app.css'

initSync()

// PWA 서비스워커 — 새 버전은 조용히 다음 방문에 적용 (specs/04 §3)
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

render(<App />, document.getElementById('app')!)
