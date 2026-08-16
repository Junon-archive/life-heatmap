# Roadmap — Life Heatmap

## 현재 상태
v1 구현 진행 중. 명세는 `specs/00~04` 확정본 기준.

## v1 체크리스트
- [x] 1단계: 스캐폴드(Vite+Preact+TS) · 데이터 모델/store/localStorage · dates/streak/merge/stats 유틸 · vitest 21개 통과
- [x] 2단계: 그리드 렌더 + 칸 상태 + 칸 편집기
- [ ] 3단계: 히트맵 관리/설정 뷰 + 유형별 로직
- [ ] 4단계: 통계·범례·백업·스와이프·연도 점프
- [ ] 5단계: 동기화 (Pages Functions + KV)
- [ ] 6단계: PWA + 마감 검증

## 변경 로그
- **2026-08-16** 명세서 v1 확정(`specs/00~04`). specs/02 §1에 `createdAt` 필드 보완(§4가 참조하는 streak 시작일 계산용).
- **2026-08-16** 1단계 완료: web_app 스캐폴드, 타입/store(LWW용 타임스탬프 포함), 날짜(일요일 시작 주·W# 규칙)/streak(실패 기준 달력일수)/병합(LWW+tombstone)/통계(월·분기) 유틸, vitest 3파일 21테스트 통과.

- **2026-08-16** 2단계 완료: Cell(빗금/단색/마크 SVG/테두리/마일스톤 glow), CellGrid(일요일 시작, 오늘 행 하단 스크롤, 위로 스크롤 과거 로드, 라벨 토글), HeatmapCard(연속일 배지·요약줄), CellEditor(바텀시트/팝오버, 즉시 저장, 실패 체크 상호배타, 숫자 키패드, 조건부 수치 미리보기), CreateFlow, App 셸(스와이프 보드+dots). vitest 3 업그레이드(Vite 6 호환). 빌드 성공.

## 다음 작업
3단계 — SettingsView(히트맵 CRUD·streak/conditional 설정·범례 편집), 유형별 설정 편집.
