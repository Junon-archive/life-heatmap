# Roadmap — Life Heatmap

## 현재 상태
v1 구현 진행 중. 명세는 `specs/00~04` 확정본 기준.

## v1 체크리스트
- [x] 1단계: 스캐폴드(Vite+Preact+TS) · 데이터 모델/store/localStorage · dates/streak/merge/stats 유틸 · vitest 21개 통과
- [ ] 2단계: 그리드 렌더 + 칸 상태 + 칸 편집기
- [ ] 3단계: 히트맵 관리/설정 뷰 + 유형별 로직
- [ ] 4단계: 통계·범례·백업·스와이프·연도 점프
- [ ] 5단계: 동기화 (Pages Functions + KV)
- [ ] 6단계: PWA + 마감 검증

## 변경 로그
- **2026-08-16** 명세서 v1 확정(`specs/00~04`). specs/02 §1에 `createdAt` 필드 보완(§4가 참조하는 streak 시작일 계산용).
- **2026-08-16** 1단계 완료: web_app 스캐폴드, 타입/store(LWW용 타임스탬프 포함), 날짜(일요일 시작 주·W# 규칙)/streak(실패 기준 달력일수)/병합(LWW+tombstone)/통계(월·분기) 유틸, vitest 3파일 21테스트 통과.

## 다음 작업
2단계 — HeatmapCard/CellGrid/Cell/CellEditor 컴포넌트와 상태별 렌더링.
