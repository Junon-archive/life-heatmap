# Roadmap — Life Heatmap

## 현재 상태
**v1 배포 완료 · 운영 중.** GitHub `Junon-archive/life-heatmap`(private) → Cloudflare Pages 자동 배포, KV(`LH_KV`) 동기화 확인 완료(2026-08-16). 명세는 `specs/00~04` 확정본 기준.

## v1 체크리스트
- [x] 1단계: 스캐폴드(Vite+Preact+TS) · 데이터 모델/store/localStorage · dates/streak/merge/stats 유틸 · vitest 21개 통과
- [x] 2단계: 그리드 렌더 + 칸 상태 + 칸 편집기
- [x] 3단계: 히트맵 관리/설정 뷰 + 유형별 로직
- [x] 4단계: 통계·범례·백업·스와이프·연도 점프
- [x] 5단계: 동기화 (Pages Functions + KV)
- [x] 6단계: PWA(아이콘·오프라인) + E2E 검증(헤드리스 Chrome)

## 배포 (완료 — 2026-08-16)
1. ✅ GitHub **private** 저장소 push (`Junon-archive/life-heatmap`)
2. ✅ Cloudflare Pages 연결: Root `web_app` / Build `npm run build` / Output `dist`
3. ✅ Workers KV 네임스페이스 생성 → Pages 바인딩 `LH_KV` 연결 → 재배포
4. ✅ 동기화 코드 생성, 초록 점 확인 (다른 기기는 설정 → 동기화에 코드 입력)

## 변경 로그
- **2026-08-16** 명세서 v1 확정(`specs/00~04`). specs/02 §1에 `createdAt` 필드 보완(§4가 참조하는 streak 시작일 계산용).
- **2026-08-16** 1단계 완료: web_app 스캐폴드, 타입/store(LWW용 타임스탬프 포함), 날짜(일요일 시작 주·W# 규칙)/streak(실패 기준 달력일수)/병합(LWW+tombstone)/통계(월·분기) 유틸, vitest 3파일 21테스트 통과.

- **2026-08-16** 2단계 완료: Cell(빗금/단색/마크 SVG/테두리/마일스톤 glow), CellGrid(일요일 시작, 오늘 행 하단 스크롤, 위로 스크롤 과거 로드, 라벨 토글), HeatmapCard(연속일 배지·요약줄), CellEditor(바텀시트/팝오버, 즉시 저장, 실패 체크 상호배타, 숫자 키패드, 조건부 수치 미리보기), CreateFlow, App 셸(스와이프 보드+dots). vitest 3 업그레이드(Vite 6 호환). 빌드 성공.

- **2026-08-16** 3단계 완료: SettingsView(목록/순서/이름/유형/보관/삭제), streak·conditional·범례 편집기.
- **2026-08-16** 4단계 완료: StatsView(월/분기, 사용 표기만 열 구성, CSS 바, 마일스톤 이력), LegendPopover, YearJump, JSON 백업.
- **2026-08-16** 5단계 완료: KV 동기화(pull→merge→push, 디바운스, 재시도), SyncIndicator/SyncSection.
- **2026-08-16** 6단계 완료: PWA 아이콘(무의존성 PNG 생성 스크립트), E2E 검증 — 3개 히트맵 생성→유형별 입력→새로고침 유지→백업 다운로드→KV push 확인→두 번째 브라우저 컨텍스트에서 pull 수신→375px/1280px 스크린샷. 검증 중 발견한 편집기 backdrop이 칸 클릭을 가로채는 버그(연속 입력 불가)를 외부 클릭 감지 방식으로 수정. 미래 칸 옅은 바탕, 숫자 마크 초기값 0 조정.

## 다음 작업
없음 (v1 완료). 개선 아이디어는 specs/04 §6 백로그 참고.
