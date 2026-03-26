# PRD: Personal Schedule Manager (TimeBox)

## 1. 개요

**제품명:** TimeBox - Personal Schedule Manager
**목표:** 어디서든 접근 가능한 개인 스케줄 관리 웹앱
**배포:** Render.com (무료 티어)
**저장소:** GitHub 개인 리포지토리

### 1.1 핵심 가치
- **단일 화면 관리:** 달력, 타임라인, 투두리스트를 한 화면에서 통합 관리
- **타임박싱:** 일론 머스크 스타일의 시간 블록 스케줄링으로 하루를 5분 단위로 계획
- **어디서든 접근:** 모바일/데스크톱 반응형 웹앱, PWA 지원
- **텔레그램 연동:** 봇을 통한 빠른 일정 추가, 리마인더 알림 수신
- **파일 보관소:** 간단한 파일/자료를 업로드하고 정리

### 1.2 설계 원칙: 시인성(Visibility) & 작업성(Usability)

> 모든 UI 결정은 "한눈에 파악되는가?" + "최소 클릭으로 끝나는가?"를 기준으로 판단한다.

| 원칙 | 적용 방식 |
|------|-----------|
| **정보 밀도 최적화** | 한 화면에 오늘의 타임박스 + 투두 + D-Day를 동시에 표시. 스크롤 최소화 |
| **상태의 즉각 인지** | 색상 코드, 진행률 바, 뱃지 카운트로 현재 상태를 0.5초 내 파악 |
| **원클릭 액션** | 완료 토글, 일정 추가 등 핵심 동작은 1클릭/1탭으로 완료 |
| **인라인 편집** | 모달 최소화. 제목·시간·날짜는 클릭 즉시 인라인 수정 |
| **컨텍스트 유지** | 편집 중 화면 전환 없음. 사이드패널/팝오버로 디테일 표시 |
| **시각적 계층** | 타이포그래피 스케일(14/16/20/28px), 볼드/미디엄 웨이트로 중요도 구분 |
| **컬러 시스템** | 카테고리별 고정 색상 팔레트(최대 8색). 다크/라이트 모두 WCAG AA 대비율 충족 |
| **터치 친화** | 모바일 탭 타겟 최소 44×44px, 스와이프 제스처 (완료/삭제) |
| **키보드 퍼스트** | 데스크톱에서 `N` 새 일정, `T` 새 투두, `/` 검색, `Esc` 닫기 등 단축키 |
| **로딩 피드백** | 스켈레톤 UI + 옵티미스틱 업데이트로 체감 지연 0

---

## 2. 사용자 페르소나

- 개인 사용자 1명 (본인)
- 여러 디바이스에서 접근 (PC, 모바일, 태블릿)
- 인증: 간단한 비밀번호 또는 PIN 기반 접근 제어

---

## 3. 기능 요구사항

### 3.1 달력 (Calendar View)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 월간 달력 | 월 단위 달력 표시, 일정이 있는 날짜 표시 | P0 |
| 주간 달력 | 주 단위 달력, 시간대별 일정 블록 표시 | P0 |
| 일간 달력 | 하루 상세 타임라인 | P0 |
| 일정 추가 | 클릭/탭으로 빠른 일정 추가 | P0 |
| 일정 수정/삭제 | 인라인 편집, 삭제 확인 | P0 |
| 드래그 앤 드롭 | 일정 이동 (날짜/시간 변경) | P1 |
| 반복 일정 | 매일/매주/매월/사용자 정의 반복 | P1 |
| 색상 카테고리 | 일정별 색상 분류 (업무, 개인, 운동 등) | P1 |

### 3.2 타임박스 스케줄러 (Elon Musk Style)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 타임 블록 생성 | 5분 단위로 시간 블록 설정 | P0 |
| 블록 크기 조절 | 드래그로 블록 길이 조절 | P0 |
| 블록 카테고리 | 심층 작업, 미팅, 이메일, 운동, 휴식 등 카테고리 | P0 |
| 일일 템플릿 | 자주 쓰는 하루 패턴을 템플릿으로 저장 | P1 |
| 실제 vs 계획 | 계획한 시간과 실제 사용 시간 비교 | P2 |
| 시간 통계 | 카테고리별 주간/월간 시간 사용 통계 | P2 |

**타임박싱 개념:**
```
08:00 - 08:30  [심층 작업] 프로젝트 A 코딩
08:30 - 09:00  [심층 작업] 프로젝트 A 코딩
09:00 - 09:15  [이메일] 메일 확인 및 응답
09:15 - 10:00  [미팅] 팀 스탠드업
10:00 - 12:00  [심층 작업] 프로젝트 B 설계
12:00 - 13:00  [휴식] 점심
```

### 3.3 투두 리스트 (Todo List)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 할 일 추가 | 텍스트 입력으로 빠른 추가 | P0 |
| 완료 처리 | 체크 시 취소선 + 완료 섹션으로 이동 | P0 |
| 삭제 | 할 일 삭제 (확인 후) | P0 |
| 순서 변경 | 드래그 앤 드롭으로 우선순위 정렬 | P0 |
| 날짜 연결 | 투두를 특정 날짜에 연결 | P1 |
| 하위 작업 | 투두 안에 서브 태스크 | P1 |
| 필터링 | 전체 / 진행 중 / 완료 필터 | P0 |
| 우선순위 | 높음 / 보통 / 낮음 표시 | P1 |

### 3.4 텔레그램 봇 연동

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 봇 기본 연결 | Telegram Bot API 연동, 개인 chat_id 등록 | P0 |
| 빠른 일정 추가 | 텔레그램에서 메시지 전송 → 일정/투두 자동 생성 | P0 |
| 리마인더 알림 | 일정 시작 전 알림 (5분/15분/30분/1시간 전) | P0 |
| D-Day 알림 | D-Day 접근 시 텔레그램 알림 (D-7, D-3, D-1, D-Day) | P1 |
| 일일 브리핑 | 매일 아침 오늘의 일정 + 투두 요약 전송 | P1 |
| 명령어 인터페이스 | `/add`, `/todo`, `/today`, `/dday` 등 슬래시 커맨드 | P0 |
| 파일 전송 → 보관 | 텔레그램으로 파일 전송 시 자동으로 파일 보관소에 저장 | P2 |

**텔레그램 명령어 예시:**
```
/add 내일 14:00 팀 미팅           → 달력에 일정 추가
/todo 보고서 작성 !high           → 높은 우선순위 투두 추가
/today                            → 오늘의 일정 + 투두 요약
/dday                             → D-Day 목록 표시
/remind 30m 약 먹기               → 30분 후 리마인더
```

### 3.5 리마인더 / 알림 시스템

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 일정 리마인더 | 달력 일정 시작 전 알림 (시간 설정 가능) | P0 |
| 투두 마감 알림 | 마감일이 있는 투두의 당일/전날 알림 | P0 |
| 커스텀 리마인더 | 특정 시간에 한 번 울리는 단발성 알림 | P1 |
| 반복 리마인더 | 매일/매주 반복되는 알림 (약 먹기, 운동 등) | P1 |
| 알림 채널 | 텔레그램 봇 메시지 (1차) + 웹 Push Notification (2차) | P0 |
| 알림 관리 | 알림 내역 조회, 다음 알림 예정 목록 | P1 |
| 스누즈 | 텔레그램에서 인라인 버튼으로 5분/15분/1시간 스누즈 | P2 |

### 3.6 파일 보관소 (File Vault)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 파일 업로드 | 웹에서 드래그 앤 드롭 / 클릭 업로드 | P0 |
| 파일 목록 | 이름, 크기, 날짜, 태그별 목록 표시 | P0 |
| 파일 다운로드 | 클릭 시 즉시 다운로드 | P0 |
| 파일 삭제 | 삭제 확인 후 제거 | P0 |
| 폴더/태그 분류 | 태그 기반 파일 분류 (업무, 개인, 참고자료 등) | P1 |
| 미리보기 | 이미지/PDF 인라인 미리보기 | P1 |
| 텔레그램 연동 | 텔레그램으로 보낸 파일 자동 저장 | P2 |
| 용량 관리 | 사용 용량 표시, 최대 500MB 제한 (Render Disk) | P0 |
| 검색 | 파일명/태그 기반 검색 | P1 |

### 3.7 D-Day 관리

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| D-Day 추가 | 이벤트명 + 목표 날짜 설정 | P0 |
| D-Day 카운트다운 | D-day, D+n 자동 계산 표시 | P0 |
| 대시보드 위젯 | 메인 화면 상단에 주요 D-Day 표시 | P0 |
| 색상/아이콘 | D-Day별 시각적 구분 | P1 |
| 알림 | D-Day 접근 시 알림 (D-7, D-3, D-1) | P2 |

### 3.8 공통 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 반응형 UI | 모바일/태블릿/데스크톱 대응 | P0 |
| PWA | 모바일 홈 화면 추가, 오프라인 기본 지원 | P1 |
| 다크 모드 | 라이트/다크 테마 전환 | P1 |
| 데이터 백업 | JSON 내보내기/가져오기 | P1 |
| 키보드 단축키 | 빠른 일정 추가 등 단축키 지원 | P2 |

---

## 4. 화면 구성

### 4.1 메인 레이아웃 (데스크톱)

```
+------------------------------------------------------------------+
|  TimeBox    [달력] [타임박스] [투두] [파일]       [D-Day 위젯] [⚙]  |
+------------------------------------------------------------------+
|          |                              |                         |
|  사이드   |    중앙 영역                  |   우측 패널              |
|  미니     |    (달력 / 타임박스 / 파일)    |                         |
|  달력     |                              |   ┌─ 투두 리스트 ──┐    |
|          |    08:00 [████████ 코딩]      |   │ [ ] 할 일 1     │    |
|  ───     |    09:00 [█████ 미팅]         |   │ [x] 할 일 2 ̶ ̶ ̶│    |
|  카테고리 |    10:00 [████████ 코딩]      |   │ [ ] 할 일 3     │    |
|  필터     |    11:00 [████ 이메일]        |   └─────────────────┘    |
|          |    12:00 [█████ 점심]         |                         |
|  ───     |          ▲ 현재 시간 표시선    |   ┌─ 리마인더 ─────┐    |
|  D-Day   |                              |   │ 🔔 14:00 미팅   │    |
|  목록     |                              |   │ 🔔 18:00 운동   │    |
|          |                              |   └─────────────────┘    |
|  ───     |                              |                         |
|  빠른     |                              |   ┌─ D-Day ────────┐    |
|  리마인더 |                              |   │ 시험 D-15       │    |
|  추가     |                              |   │ 여행 D-30       │    |
|          |                              |   └─────────────────┘    |
+------------------------------------------------------------------+
```

**시인성 설계 포인트:**
- 현재 시간 표시선(빨간 라인)이 타임박스 위를 실시간 이동
- 진행 중인 블록 하이라이트 (배경 pulse 애니메이션)
- 투두 완료율 프로그레스 바 (우측 상단)
- D-Day 카운트는 숫자 크게, 라벨은 작게 (시각 계층)

### 4.2 메인 레이아웃 (모바일)

```
+─────────────────────────+
│ TimeBox         [+] [☰] │
+─────────────────────────+
│ D-Day: 시험 D-15 │ 여행 D-30 │  ← 가로 스크롤 칩
+─────────────────────────+
│                         │
│   (선택된 뷰 표시)       │
│                         │
│   ← 스와이프: 완료      │
│   → 스와이프: 삭제      │
│                         │
+─────────────────────────+
│ [달력] [타임박스] [투두] [파일] │  ← 하단 탭 바
+─────────────────────────+
```

**모바일 UX 포인트:**
- 하단 탭 바 (엄지 접근성)
- 스와이프 제스처: 좌 → 완료, 우 → 삭제
- FAB(Floating Action Button)으로 빠른 추가
- Pull-to-refresh

### 4.3 파일 보관소 뷰

```
+──────────────────────────────────────+
│ 파일 보관소    [검색🔍]  [업로드 ⬆]   │
+──────────────────────────────────────+
│ 태그: [전체] [업무] [개인] [참고자료]  │
+──────────────────────────────────────+
│ 📄 보고서_v2.pdf      1.2MB  3/20   │
│ 🖼 스크린샷.png       340KB  3/19   │
│ 📋 회의록.docx        89KB   3/18   │
│ 📁 ...                              │
+──────────────────────────────────────+
│ 사용량: 120MB / 500MB  ████░░░ 24%  │
+──────────────────────────────────────+
```

### 4.4 뷰 전환

- **달력 뷰:** 월간/주간/일간 전환 가능
- **타임박스 뷰:** 오늘의 시간 블록 관리 (일간 달력과 통합 가능)
- **투두 뷰:** 전체 할 일 목록 + 완료 항목
- **파일 뷰:** 파일 보관소 (태그 필터, 검색)

---

## 5. 기술 스택

### 5.1 개발 환경

| 항목 | 기술 | 버전 |
|------|------|------|
| **런타임** | Node.js | 20 LTS |
| **언어** | TypeScript | 5.x (프론트 + 백엔드 모두) |
| **패키지 매니저** | pnpm | 9.x (모노레포 workspace) |
| **린터/포맷** | ESLint + Prettier | 최신 |
| **테스트** | Vitest | 최신 |
| **Git Hooks** | husky + lint-staged | 최신 |

### 5.2 프론트엔드

| 항목 | 기술 | 비고 |
|------|------|------|
| **프레임워크** | React 18 | |
| **빌드** | Vite 5 | |
| **UI 컴포넌트** | shadcn/ui | Radix UI 기반, 커스터마이징 용이 |
| **스타일** | Tailwind CSS 3 | |
| **상태 관리** | Zustand | 가볍고 간단 |
| **달력** | react-big-calendar 또는 FullCalendar | |
| **드래그 앤 드롭** | @dnd-kit/core | |
| **날짜 처리** | date-fns | |
| **아이콘** | Lucide React | |
| **HTTP 클라이언트** | ky 또는 axios | |

### 5.3 백엔드

| 항목 | 기술 | 비고 |
|------|------|------|
| **프레임워크** | Express.js 4 | |
| **DB** | SQLite 3 | better-sqlite3 (동기, 빠름) |
| **ORM** | Drizzle ORM | 타입 안전, 경량 |
| **인증** | bcrypt + JWT | PIN 해시 + 토큰 |
| **텔레그램** | node-telegram-bot-api | Polling 또는 Webhook |
| **파일 업로드** | Multer | 로컬 Disk 저장 |
| **스케줄러** | node-cron | 리마인더 발송 |
| **유효성 검증** | zod | 요청 스키마 검증 |

### 5.4 프로젝트 구조 (pnpm 모노레포)

```
timebox/
├── packages/
│   ├── client/          # React + Vite 프론트엔드
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── stores/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── package.json
│   ├── server/          # Express 백엔드
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   ├── telegram/
│   │   │   └── middleware/
│   │   └── package.json
│   └── shared/          # 공유 타입, 유틸리티
│       ├── src/
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── PRD.md
└── README.md
```

### 5.5 배포

- **호스팅:** Render.com Web Service (무료 티어)
- **DB 저장:** Render.com Persistent Disk (SQLite + 업로드 파일, 1GB)
- **CI/CD:** GitHub → Render.com 자동 배포
- **빌드 명령:** `pnpm build` → Express가 React 정적 파일 서빙

---

## 6. 데이터 모델

### 6.1 주요 엔티티

```
User
├── id (PK)
├── pin_hash
└── created_at

Event (달력 일정)
├── id (PK)
├── title
├── description
├── start_time (datetime)
├── end_time (datetime)
├── all_day (boolean)
├── category_id (FK)
├── recurrence_rule (nullable)
├── color
├── created_at
└── updated_at

TimeBlock (타임박스)
├── id (PK)
├── date
├── start_time
├── end_time
├── title
├── category (enum: deep_work, meeting, email, exercise, break, etc.)
├── color
├── completed (boolean)
├── created_at
└── updated_at

Todo
├── id (PK)
├── title
├── completed (boolean)
├── priority (enum: high, medium, low)
├── due_date (nullable)
├── sort_order (integer)
├── parent_id (nullable, FK → Todo)
├── created_at
└── updated_at

DDay
├── id (PK)
├── title
├── target_date
├── color
├── icon
├── created_at
└── updated_at

Category
├── id (PK)
├── name
├── color
└── icon

Reminder (리마인더/알림)
├── id (PK)
├── title
├── message (nullable)
├── remind_at (datetime)
├── repeat_rule (nullable, cron 표현식)
├── source_type (enum: event, todo, dday, custom)
├── source_id (nullable, FK → 해당 엔티티)
├── channel (enum: telegram, web_push, both)
├── sent (boolean)
├── snoozed_until (nullable, datetime)
├── created_at
└── updated_at

File (파일 보관소)
├── id (PK)
├── original_name
├── stored_name (UUID 기반)
├── mime_type
├── size (bytes)
├── tags (JSON array)
├── uploaded_via (enum: web, telegram)
├── created_at
└── updated_at

TelegramConfig
├── id (PK)
├── chat_id
├── bot_token (환경변수 참조)
├── daily_briefing_time (nullable, e.g. "08:00")
├── active (boolean)
└── updated_at
```

---

## 7. API 설계

```
인증
POST   /api/auth/login          PIN 로그인 → JWT 토큰

달력 일정
GET    /api/events              일정 목록 (query: start, end)
POST   /api/events              일정 생성
PUT    /api/events/:id          일정 수정
DELETE /api/events/:id          일정 삭제

타임박스
GET    /api/timeblocks           타임블록 목록 (query: date)
POST   /api/timeblocks           타임블록 생성
PUT    /api/timeblocks/:id       타임블록 수정
DELETE /api/timeblocks/:id       타임블록 삭제
GET    /api/timeblocks/templates 템플릿 목록
POST   /api/timeblocks/templates 템플릿 저장

투두
GET    /api/todos               투두 목록 (query: filter, date)
POST   /api/todos               투두 추가
PUT    /api/todos/:id           투두 수정 (완료, 내용, 순서)
DELETE /api/todos/:id           투두 삭제
PUT    /api/todos/reorder       순서 일괄 변경

D-Day
GET    /api/ddays               D-Day 목록
POST   /api/ddays               D-Day 추가
PUT    /api/ddays/:id           D-Day 수정
DELETE /api/ddays/:id           D-Day 삭제

리마인더
GET    /api/reminders            리마인더 목록 (query: upcoming, sent)
POST   /api/reminders            리마인더 생성
PUT    /api/reminders/:id        리마인더 수정
DELETE /api/reminders/:id        리마인더 삭제
POST   /api/reminders/:id/snooze 스누즈 (body: duration)

파일 보관소
GET    /api/files                파일 목록 (query: tag, search)
POST   /api/files/upload         파일 업로드 (multipart/form-data)
GET    /api/files/:id/download   파일 다운로드
DELETE /api/files/:id            파일 삭제
PUT    /api/files/:id/tags       태그 수정
GET    /api/files/usage          저장소 사용량 조회

텔레그램
POST   /api/telegram/webhook     텔레그램 Webhook 수신
GET    /api/telegram/config      텔레그램 설정 조회
PUT    /api/telegram/config      텔레그램 설정 변경
POST   /api/telegram/test        테스트 메시지 전송

백업
GET    /api/backup/export       전체 데이터 JSON 내보내기
POST   /api/backup/import       JSON 데이터 가져오기
```

---

## 8. 개발 단계

### Phase 1: MVP (핵심 기능)
1. 프로젝트 세팅 (React + Express + SQLite + Drizzle)
2. 기본 인증 (PIN 로그인)
3. 투두 리스트 (추가/완료/삭제/정렬/취소선)
4. 월간 달력 (일정 추가/수정/삭제)
5. D-Day 위젯
6. 기본 리마인더 (웹 알림)
7. 반응형 레이아웃 (시인성 원칙 적용)
8. Render.com 배포

### Phase 2: 타임박싱 + 텔레그램
1. 타임박스 스케줄러 구현
2. 주간/일간 달력 뷰
3. 드래그 앤 드롭 (일정 이동, 투두 정렬, 블록 리사이즈)
4. 텔레그램 봇 연동 (일정 추가, 투두 추가, 리마인더 알림)
5. 텔레그램 슬래시 커맨드
6. 일일 브리핑 전송
7. 색상 카테고리
8. 다크 모드

### Phase 3: 파일 보관소 + 강화
1. 파일 보관소 (업로드/다운로드/삭제/태그)
2. 파일 미리보기 (이미지/PDF)
3. 텔레그램 → 파일 보관소 자동 저장
4. 반복 리마인더
5. 스누즈 기능

### Phase 4: 편의 기능
1. PWA 지원
2. 일일 템플릿
3. 반복 일정
4. 키보드 단축키
5. 데이터 백업/복원
6. 시간 통계
7. 실제 vs 계획 시간 비교

---

## 9. 비기능 요구사항

- **성능:** 초기 로딩 2초 이내, 인터랙션 100ms 이내 반응
- **보안:** HTTPS, JWT 인증, PIN 해시 저장
- **가용성:** Render.com 무료 티어 (15분 미활동 시 슬립 → 재접속 시 10~30초 웨이크업)
- **브라우저:** Chrome, Safari, Firefox 최신 2개 버전
- **데이터:** SQLite 단일 파일, 주기적 백업 권장

---

## 10. Render.com 배포 고려사항

- 무료 티어 제한: 512MB RAM, 0.1 CPU, 비활동 시 슬립
- SQLite 파일은 Render Disk에 저장 (무료 Disk 1GB)
- 업로드 파일도 Render Disk에 저장 (SQLite + 파일 합산 1GB 이내)
- 프론트엔드: Express에서 정적 파일 서빙 (단일 서비스로 배포)
- 환경변수: JWT_SECRET, PIN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 등 Render 환경변수로 관리
- 텔레그램 Webhook: Render 서비스 URL을 Webhook으로 등록 (슬립 시에도 Webhook 수신으로 웨이크업)

---

## 11. 텔레그램 봇 설정 가이드

1. BotFather에서 봇 생성 → BOT_TOKEN 획득
2. 봇에게 메시지 전송 → chat_id 획득
3. Render 환경변수에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 설정
4. Webhook URL 등록: `https://<app>.onrender.com/api/telegram/webhook`
5. 웹 설정 페이지에서 일일 브리핑 시간, 알림 기본값 설정

---

## 12. 시인성/작업성 체크리스트 (개발 시 참조)

모든 기능 구현 시 아래 항목을 확인:

- [ ] 한눈에 현재 상태가 파악되는가? (색상, 뱃지, 프로그레스)
- [ ] 핵심 동작이 1클릭/1탭으로 완료되는가?
- [ ] 모달 없이 인라인으로 편집 가능한가?
- [ ] 모바일에서 터치 타겟이 44px 이상인가?
- [ ] 스와이프 제스처가 직관적인가?
- [ ] 데스크톱에서 키보드만으로 조작 가능한가?
- [ ] 로딩 시 스켈레톤/옵티미스틱 업데이트가 적용되었는가?
- [ ] 다크 모드에서 대비율이 충분한가?
- [ ] 불필요한 화면 전환 없이 컨텍스트가 유지되는가?
