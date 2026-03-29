# 다음 작업 세션 가이드 (TimeBox)

**마지막 정리일:** 2026-03-29  
**목적:** 저장소를 며칠 뒤 열어도 맥락을 잃지 않고 이어서 구현·기획할 수 있게 한다.

---

## 1. 방금까지 된 일 (짧은 요약)

- **타임블록**에 `notes`, `meta`(JSON)가 서버·공유 타입·백업까지 연결됨.
- **일간 Elon 스케줄러** (`packages/client/src/components/scheduler/`): 타임 캔버스, 블록 시트, `elonStorage`의 로컬 데이터(브레인/Top3/스케치 뷰 설정 등).
- **Top 3 ↔ 브레인 덤프**: `prioritySlot` 블록 저장 시 `meta.brainId`로 브레인 줄과 연동; 블록 삭제 시 복구 + Top 3 제목 일치 시 줄 비움.
- **필기 레이어**: 날짜별 `tb_elon_sketch_v1_{yyyy-MM-dd}` — **기기 로컬만**, 서버 없음.
- **날짜 버그**: 스케줄러에서 ◀▶로 바꾼 날짜가 곧바로 오늘로 돌아가던 문제 수정됨 (`ElonScheduler`에서 `usePageVisible` 기반 강제 오늘 이동 제거).

---

## 2. 이어서 하기 좋은 작업 (우선순위 제안)

### A. 스케줄러 / 필기

| 아이디어 | 메모 |
|----------|------|
| **스타일러스 품질** | `pointermove`에서 `getCoalescedEvents()`로 중간 샘플 보강; `pressure`로 굵기 변화(포인트에 `p` 저장 + SVG 세그먼트 렌더). |
| **스타일러스만 그리기** | `pointerType === 'pen'`일 때만 그리기, 손가락은 스크롤 — 옵션 토글. |
| **스케치 동기화** | 백업 JSON에 포함 vs 별도 테이블/API — 용량·프라이버시 결정 필요. |
| **도형 / 텍스트** | 사각형·화살표·캔버스 고정 텍스트는 별도 `meta` 스키마 설계 후 캔버스 레이어 확장. |
| **“타임라인에서만 제거”** | 삭제 대신 브레인으로 되돌리기 버튼(블록은 지우고 브레인만 채우는 플로우와 구분). |

주요 파일: `ElonTimeCanvas.tsx`, `ElonScheduler.tsx`, `elonStorage.ts`, `ElonBlockSheet.tsx`.

### B. 제품 / PRD 브리지

- [PRD-personal-schedule-project-bridge.md](./PRD-personal-schedule-project-bridge.md): 개인 이벤트·투두에 `projectId`, 프로젝트 단위 캘린더 뷰 등 — **아직 별도 구현 스코프**.
- 일간 Elon과의 중복: “하루 집중”은 로컬 브레인/Top3와 잘 맞음; **프로젝트 태그**는 캘린더 이벤트 쪽부터 붙이는 편이 자연스러울 수 있음.

### C. 기술 부채·품질

- `ElonScheduler`의 `handleSheetSave` / `handleBlockDelete`가 `brainItems` 클로저에 의존 — 연속 저장 레이스가 있으면 ref 또는 함수형 업데이트 검토.
- 스케치 `ResizeObserver`는 `showSketchLayer`·`heightPx`에 묶여 있음; 레이아웃 변경 시 너비 0 방어는 이미 `sketchPointsToPathD`에서 처리.

---

## 3. 빌드·실행 (상기)

```bash
pnpm install
pnpm dev
pnpm --filter @timebox/client exec tsc --noEmit
```

공유 패키지 수정 시: `pnpm --filter @timebox/shared build`

---

## 4. 문서 맵

| 문서 | 용도 |
|------|------|
| [PRD.md](../PRD.md) | 제품 전체 요구·데이터 모델(3.2.1 Elon 현황 포함) |
| [CHANGELOG.md](../CHANGELOG.md) | 구현 진행·백로그·환경 변수 |
| [PRD-personal-schedule-project-bridge.md](./PRD-personal-schedule-project-bridge.md) | 개인 ↔ 프로젝트 연동 기획 |
| [PRD-team-collaboration.md](./PRD-team-collaboration.md) | 팀 협업 코어 |
| [PRD-team-groups.md](./PRD-team-groups.md) | 팀 그룹 접근 제어 |
