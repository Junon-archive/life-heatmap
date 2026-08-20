# CLAUDE.md — Life Heatmap 작업 지침

## 프로젝트 한 줄
개인용 일일 루틴 히트맵 웹앱. 일반화된 히트맵을 사용자가 여러 개 만들어 관리. 정적 사이트(Vite+Preact+TS) + Cloudflare Pages/KV 동기화 + PWA. 비용 0, 모바일 우선, 칸 탭 즉시 입력.

## 📌 고정 규칙 (반드시 준수)
1. **명세 SSOT**: `specs/00~05`가 유일한 명세다. 구현은 명세를 따르고, 명세와 다르게 구현해야 할 사정이 생기면 **먼저 specs를 수정**하고 그 이유를 결정 로그(`specs/01_requirements.md`)에 남긴다.
2. **Roadmap 자동 갱신**: 작업(마일스톤·기능·수정)이 하나 끝날 때마다 `Roadmap.md`를 갱신한다 — 완료 체크, 날짜·요약을 변경 로그에 추가. 사용자가 요청하지 않아도 매 작업 종료 시 수행. (파일이 없으면 최초 구현 시작 시 생성.)
3. **어휘 규칙**: 문서·코드·주석·커밋 메시지 어디에도 개인 기록의 민감한 용도를 유추할 수 있는 단어를 쓰지 않는다. 해당 히트맵은 사용자의 위장 이름("퇴근/취침") 그대로만 지칭한다.
4. **의미 비강제**: 색/기호의 의미를 코드·UI 문구에 하드코딩하지 않는다. 앱은 표기 도구만 제공한다.
5. **의존성 최소화**: `specs/04_architecture.md` §1 목록 외 라이브러리 추가 금지(특히 차트·날짜 라이브러리).

## 핵심 문서
- `specs/00_overview.md` — 개요·원칙·용어
- `specs/01_requirements.md` — 요구사항(R-##)·결정 로그(D-#)
- `specs/02_data_model.md` — 스키마·streak 계산·동기화 프로토콜
- `specs/03_ui_spec.md` — 화면·칸 렌더링·편집기·팔레트·통계
- `specs/04_architecture.md` — 스택·디렉터리 구조·배포 체크리스트·테스트 기준
- `specs/05_physique_dashboard.md` — 신체 대시보드(세 번째 뷰) 지표·스키마·화면·계산 규칙
- `Roadmap.md` — 현재 구현 상황·변경 로그·다음 작업

## 스택 요약
Vite + Preact + TypeScript, 순수 CSS(토큰), vite-plugin-pwa, Cloudflare Pages(+ Functions `functions/api/data.ts`, KV 바인딩 `LH_KV`). 구현 루트는 `web_app/`.

## 저장소
GitHub **private** 권장. `temp/`(원본 사진)는 커밋 제외(.gitignore). main push → Cloudflare Pages 자동 배포 (Root `web_app`, Build `npm run build`, Output `dist`).
