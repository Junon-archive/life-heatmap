# 02. 데이터 모델 & 동기화

## 1. 전체 상태 (단일 JSON 문서)

앱 상태는 하나의 JSON 문서로 관리한다. localStorage 키: `lh:data`. 동일 문서가 KV에 동기화된다.

```jsonc
{
  "version": 1,
  "settings": {
    "weekLabel": "range",        // "range"(날짜 범위) | "number"(주 번호)
    "u": 1765000000000           // settings 수정 시각 (epoch ms) — 동기화 LWW용
  },
  "heatmaps": [
    {
      "id": "hm_a1b2c3",         // nanoid류 랜덤 id. 삭제/병합의 기준
      "name": "기상/출근",        // 사용자 지정. 언제든 변경 가능
      "type": "basic",           // "basic" | "streak" | "conditional"
      "order": 0,                // 표시 순서
      "archived": false,          // 보관(숨김). 삭제와 구분
      "createdAt": "2026-08-16",  // 생성일 — §4 streak 시작일 계산에 사용
      "config": { /* §2 */ },
      "u": 1765000000000,        // 메타(name/type/order/config) 수정 시각
      "entries": { /* §3 */ }
    }
  ],
  "tombstones": {                // 삭제된 히트맵 { id: 삭제시각 } — 동기화 시 부활 방지
    "hm_x9y8z7": 1765000000000
  }
}
```

## 2. `config` — 유형별 설정

```jsonc
{
  // 공통
  "legend": [                    // 범례. 기본 숨김 UI에서만 노출
    { "fill": {"style":"hatch","color":"blue"}, "mark": null, "label": "유산소" },
    { "fill": null, "mark": {"kind":"symbol","symbol":"circle"}, "label": "근력" }
  ],

  // type === "streak" 일 때만
  "streak": {
    "mode": "auto",              // "auto"(자동 채색) | "manual"(수동 채색)
    "baseColor": "violet",       // 그라데이션 기본 색 (팔레트 키)
    "baseStyle": "solid",        // 자동 채색의 채움 양식: "hatch" | "solid" (D-11)
    "milestones": [7, 30, 50, 100, 365],  // 사용자 지정. 기본 제안값
    "levels": [1, 3, 7, 14, 30]  // 그라데이션 단계 경계(일). 5단계 강도로 매핑
  },

  // type === "conditional" 일 때만
  "conditional": {
    "unit": "시간",              // 표시용 단위 문자열 (선택)
    "showValue": true,           // 칸에 수치 표시 여부
    "rules": [                   // 위에서부터 첫 매칭 적용. min ≤ value < max
      { "min": null, "max": 6,    "style": "solid", "color": "rose" },
      { "min": 6,    "max": 9,    "style": "solid", "color": "blue" },
      { "min": 9,    "max": null, "style": "solid", "color": "violet" }
    ]
  }
}
```

## 3. `entries` — 날짜별 기록

키는 로컬 날짜 `"YYYY-MM-DD"`. 값이 완전히 비면 키 자체를 삭제하지 않고 **마크 없는 엔트리 + `u` 갱신**으로 남긴다(동기화 시 "지움"이 전파되도록).

```jsonc
{
  "2026-07-05": {
    "fill": { "style": "hatch", "color": "blue" },   // null = 채우기 없음. style: "hatch"|"solid"
    "mark": { "kind": "number", "value": 2 },         // 또는 {"kind":"symbol","symbol":"circle"|"x"|"star"} 또는 null
    "markColor": "rose",       // 마크 색. 생략 시 자동(중립 진회색)
    "border": false,            // 테두리 강조 토글
    "fail": false,              // streak형 전용: 실패 체크. 화면상 빈칸처럼 렌더
    "value": 7.5,               // conditional형 전용: 입력 수치 (소수 허용)
    "u": 1765000000000          // 이 엔트리의 마지막 수정 시각 — 병합 기준
  }
}
```

- 숫자 마크: 정수 0~99. 조건부형의 `value`와는 별개 필드.
- streak형에서 `fail: true`인 엔트리는 fill을 가질 수 없다(편집기에서 배타 처리). mark·markColor·border는 함께 가질 수 있다(D-10).

## 4. 파생 값 계산 규칙 (저장하지 않음)

- **현재 streak** = `오늘 - (가장 최근 fail 날짜)` (일 단위, fail 다음 날이 1일차). fail이 하나도 없으면 히트맵의 **기록 시작일**(첫 엔트리 날짜 또는 생성일 중 이른 쪽)부터 센다.
- **최고 streak** = 인접한 fail들(및 시작일~첫 fail) 사이 간격의 최댓값과 현재 streak 중 큰 값.
- **그라데이션 단계** = 해당 날짜의 streak 일수를 `config.streak.levels`에 대입해 1~5단계 결정.
- auto 모드: 마지막 fail 이후 ~ 오늘까지의 지난 날짜 칸을 단계별 색으로 자동 렌더(엔트리 없어도). 사용자가 그 위에 수동 표기를 하면 수동 표기가 우선.
- manual 모드: fill이 있는 칸만 채색하되 강도는 계산된 단계를 따른다.
- **주 번호** = 일요일 시작 주 기준, 1월 1일이 포함된 주가 W1.

## 5. 동기화 (Cloudflare Pages Functions + KV)

### 5.1 개념
- **비밀 동기화 코드(passphrase)** 를 사용자가 정한다(충분히 긴 임의 문자열, 앱이 랜덤 생성 버튼 제공). 기기마다 최초 1회 입력 → localStorage `lh:syncCode`에 저장.
- KV 키 = `SHA-256(syncCode)` hex. 코드를 모르면 데이터에 접근 불가. 서버는 코드 원문을 저장하지 않는다.
- 저장 단위 = 전체 JSON 문서 1개 (수년치여도 수백 KB 이내 — KV 값 한도 25MB에 여유).

### 5.2 API (`functions/api/data.ts`)
| 메서드 | 요청 | 응답 |
|---|---|---|
| `GET /api/data` | 헤더 `X-Sync-Key: <sha256 hex>` | `200` 문서 JSON / `404` 없음 |
| `PUT /api/data` | 같은 헤더 + body=문서 JSON | `200` |

- KV 네임스페이스 바인딩 이름: `LH_KV`.
- 키 형식 검증(64자 hex) 외 별도 인증 없음 — 키 자체가 비밀이다.
- 문서 크기 상한(예: 5MB) 초과 시 `413`.

### 5.3 병합 (client-side, Last-Write-Wins per unit)
클라이언트가 pull → merge → push를 수행한다. 병합 단위와 기준:
1. `settings`: `u`가 큰 쪽.
2. 히트맵 메타(name/type/order/archived/config): 히트맵 `id`별로 `u`가 큰 쪽. 한쪽에만 있는 id는 추가하되, `tombstones`에 있고 그 삭제 시각이 해당 히트맵 `u`보다 크면 삭제 유지.
3. `entries`: (히트맵 id, 날짜) 단위로 `u`가 큰 쪽.
4. `tombstones`: 합집합.

단일 사용자이므로 충돌은 드물다. LWW로 충분하며 CRDT는 과설계다.

### 5.4 동기화 트리거
- 앱 로드 시, `visibilitychange`(탭 복귀) 시: pull → merge → (변경 있으면) push.
- 로컬 편집 후 **3초 디바운스** push. 오프라인이면 큐잉해 온라인 복귀(`online` 이벤트) 시 전송.
- 헤더에 동기화 상태 인디케이터(마지막 동기화 시각 / 오프라인 / 오류)와 수동 동기화 버튼.
- 동기화 코드 미설정 상태에서도 앱은 완전 동작(로컬 전용 모드).

## 6. 백업 (JSON 내보내기/가져오기)
- 내보내기: 전체 문서를 `life-heatmap-backup-YYYYMMDD.json`으로 다운로드.
- 가져오기: 파일 선택 → **병합**(위 §5.3 규칙) 또는 **전체 교체**(확인 대화상자 필수) 중 선택.

## 7. 마이그레이션
`version` 필드로 스키마 버전 관리. 로드 시 버전이 낮으면 순차 마이그레이션 함수 적용 후 저장. 최초 버전은 1.
