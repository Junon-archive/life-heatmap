# 04. 기술 아키텍처 & 배포

## 1. 스택 (확정)

| 영역 | 선택 | 근거 |
|---|---|---|
| 빌드 | **Vite + TypeScript** | 정적 출력, 설정 최소 |
| UI | **Preact (+ hooks)** | 칸 편집·동기화 상태 등 인터랙션이 많아 소형 런타임이 유리 (~4KB). guitar_hero의 Astro는 콘텐츠 사이트용이라 이 프로젝트엔 부적합 |
| 스타일 | 순수 CSS (CSS 변수로 토큰 관리) | 프레임워크 불필요, 03 문서 토큰 그대로 |
| 상태 | Preact signals 또는 단일 store 모듈 + localStorage 영속화 | 전역 상태가 단일 JSON 문서라 단순 |
| PWA | `vite-plugin-pwa` (manifest + service worker, 오프라인 캐시) | R-28 필수 |
| 백엔드 | **Cloudflare Pages Functions + KV** (`functions/api/data.ts` 단일 엔드포인트) | 02 문서 §5 |
| 배포 | GitHub → Cloudflare Pages 자동 배포 | guitar_hero와 동일 패턴 |

외부 라이브러리는 위 목록 외 최소화(차트/날짜 라이브러리 금지 — 날짜는 자체 유틸).

## 2. 저장소 구조

```
life_heatmap/                  (GitHub private 권장)
├── CLAUDE.md                  ← 작업 지침 (구현 세션 진입점)
├── Roadmap.md                 ← 진행 상황·변경 로그 (구현 세션이 생성·유지)
├── specs/                     ← 명세 SSOT (00~04)
├── temp/                      ← 원본 사진 (저장소 커밋 제외 권장, .gitignore)
└── web_app/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── public/                ← 아이콘, manifest 정적 파일
    ├── functions/
    │   └── api/data.ts        ← Pages Function (GET/PUT, KV 바인딩 LH_KV)
    └── src/
        ├── main.tsx
        ├── app.tsx
        ├── components/        ← HeatmapCard, CellGrid, Cell, CellEditor,
        │                        StatsView, SettingsView, LegendPopover,
        │                        SwipePager, YearJump, SyncIndicator
        ├── lib/
        │   ├── store.ts       ← 상태 + localStorage 영속화 + 마이그레이션
        │   ├── dates.ts       ← 일요일 시작 주 계산, 주 번호(W#), YYYY-MM-DD
        │   ├── streak.ts      ← streak/단계/마일스톤 계산 (02 §4)
        │   ├── stats.ts       ← 월/분기 집계
        │   ├── sync.ts        ← pull/merge/push, 디바운스, 오프라인 큐 (02 §5)
        │   └── merge.ts       ← LWW 병합 (JSON 백업 가져오기와 공용)
        └── styles/
            ├── tokens.css
            └── app.css
```

## 3. 핵심 구현 노트

- **날짜는 전부 로컬 타임존 기준** `YYYY-MM-DD` 문자열로 다룬다. `Date`↔문자열 변환 시 UTC 오염 주의(자정 경계 버그의 단골 원인).
- 주 계산: `weekStart(d)` = d에서 요일만큼 뺀 일요일. 주 번호 = 1월 1일이 포함된 주가 W1 (02 §4).
- 렌더 성능: 히트맵당 표시 주 수십~수백 행 수준이므로 가상화 불필요. 과거 로드는 위쪽에 행을 prepend하고 스크롤 위치 보정.
- 스와이프: `touchstart/move/end`로 수평 이동량 우세 시에만 페이지 전환(세로 스크롤과 충돌 금지). CSS `scroll-snap` 캐러셀도 허용.
- 편집기의 모든 변경은 store에 즉시 커밋 → localStorage 저장 → 3초 디바운스 sync push.
- service worker 업데이트 전략: 새 버전 감지 시 자동 새로고침 대신 조용히 다음 방문에 적용(개인 앱이라 충분).

## 4. Cloudflare 배포 체크리스트 (사용자 1회 수행)

1. GitHub에 **private** 저장소 생성, push.
2. Cloudflare Pages에서 저장소 연결. 빌드 설정: Root `web_app` / Build `npm run build` / Output `dist`.
3. Cloudflare 대시보드 → Workers & Pages → KV → 네임스페이스 생성 (예: `life-heatmap`).
4. Pages 프로젝트 → Settings → Functions → **KV namespace bindings**: 변수명 `LH_KV` ↔ 생성한 네임스페이스 연결 (Production/Preview 모두).
5. 배포 후 앱 설정 뷰에서 동기화 코드 생성 → 다른 기기에서 같은 코드 입력.

## 5. 테스트 (최소 기준)

유닛 테스트(vitest)는 버그가 치명적인 순수 로직에만:
- `dates.ts`: 주 시작/주 번호(연 경계 포함), 날짜 문자열 변환.
- `streak.ts`: 실패 체크·시작일·미입력 혼재 시나리오, 그라데이션 단계, 마일스톤 판정.
- `merge.ts`: LWW 병합, tombstone, 양방향 수정 충돌.
UI는 수동 확인으로 충분(개인 프로젝트).

## 6. v1 범위 밖 (백로그 후보)
- 다크 모드
- 마크의 숫자+기호 동시 표시(모서리 배지 방식)
- 클라이언트 측 암호화(동기화 코드로 E2E 암호화 — 현재는 KV 키 은닉으로 충분)
- 히트맵 데이터 CSV 내보내기
- 연간 요약 뷰(1년 한눈 보기)
