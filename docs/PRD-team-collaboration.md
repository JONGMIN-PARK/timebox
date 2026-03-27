# TimeBox Team - PRD (Product Requirements Document)

## 1. Overview

**현재**: 개인 일정/생산성 관리 도구 (1인용)
**목표**: 팀 협업 플랫폼으로 자연스럽게 확장 (개인 + 팀 모드 공존)

### 핵심 원칙
- 기존 개인 기능은 그대로 유지 (하위 호환)
- "프로젝트"를 중심으로 팀 기능이 붙는 구조
- 점진적 확장: Phase 1 → 2 → 3 순서로 개발

**구현 상태**: Phase 1-3 전체 구현 완료 (2026-03-27)

---

## 2. 정보 구조 (Architecture)

```
사용자 (User)
  ├── 개인 공간 (기존 기능 그대로)
  │   ├── 내 할일, 캘린더, 타임박스, 디데이, 리마인더
  │   └── 내 파일
  │
  └── 팀/프로젝트 (새로 추가)
      ├── 프로젝트 A
      │   ├── 멤버 관리
      │   ├── 공유 할일 (칸반 보드)
      │   ├── 공유 캘린더
      │   ├── 자료실
      │   ├── 게시판
      │   ├── 채팅
      │   └── 현황판 (대시보드)
      │
      └── 프로젝트 B
          └── ...
```

---

## 3. 데이터 모델 확장

### 3.1 새로운 테이블

```sql
-- 프로젝트 (팀 단위)
projects
  id, name, description, color, icon,
  owner_id (FK users),
  visibility ("private" | "team"),
  created_at, updated_at

-- 프로젝트 멤버
project_members
  id, project_id (FK projects), user_id (FK users),
  role ("owner" | "admin" | "member" | "viewer"),
  joined_at

-- 공유 할일 (프로젝트 단위, 칸반)
project_tasks
  id, project_id (FK projects),
  title, description,
  status ("backlog" | "todo" | "in_progress" | "review" | "done"),
  priority ("high" | "medium" | "low"),
  assignee_id (FK users),
  reporter_id (FK users),
  due_date, tags (JSON),
  sort_order, parent_id (서브태스크),
  created_at, updated_at

-- 게시판
posts
  id, project_id (FK projects),
  author_id (FK users),
  title, content (Markdown),
  pinned (boolean),
  category ("notice" | "discussion" | "question"),
  created_at, updated_at

-- 게시판 댓글
post_comments
  id, post_id (FK posts),
  author_id (FK users),
  content,
  created_at

-- 공유 자료실
project_files
  id, project_id (FK projects),
  uploader_id (FK users),
  original_name, stored_name, mime_type, size,
  folder (텍스트 경로: "/디자인/목업"),
  tags (JSON),
  created_at

-- 채팅 메시지
messages
  id, project_id (FK projects),
  channel ("general" | "task-{id}" | custom),
  sender_id (FK users),
  content, type ("text" | "file" | "system"),
  reply_to (FK messages),
  created_at

-- 활동 로그 (현황판용)
activity_log
  id, project_id, user_id,
  action ("task_created" | "task_completed" | "comment_added" | ...),
  target_type ("task" | "post" | "file"),
  target_id, metadata (JSON),
  created_at
```

### 3.2 기존 테이블 확장

```sql
-- todos 테이블에 프로젝트 연결 추가
ALTER TABLE todos ADD COLUMN project_id INTEGER REFERENCES projects(id);
ALTER TABLE todos ADD COLUMN assignee_id INTEGER REFERENCES users(id);

-- events 테이블에 프로젝트 연결 추가
ALTER TABLE events ADD COLUMN project_id INTEGER REFERENCES projects(id);

-- files 테이블에 프로젝트 연결 추가
ALTER TABLE files ADD COLUMN project_id INTEGER REFERENCES projects(id);
```

---

## 4. 기능 상세

### Phase 1: 프로젝트 + 공유 할일 + 현황판 ✅ 구현 완료

#### 4.1 프로젝트 관리 ✅
```
기능:
- 프로젝트 생성/수정/삭제 (이름, 색상, 아이콘, 설명)
- 멤버 초대 (사용자명으로 검색 → 초대)
- 멤버 역할 관리 (owner/admin/member/viewer)
- 프로젝트 목록 사이드바에 표시

UI:
- 사이드바에 "프로젝트" 섹션 추가
- 프로젝트 선택 시 팀 대시보드로 전환
- 개인/팀 모드 자연스럽게 전환
```

#### 4.2 공유 할일 (칸반 보드) ✅
```
기능:
- 칸반 뷰: Backlog → Todo → In Progress → Review → Done
- 리스트 뷰: 기존 TodoList와 유사
- 할일 생성: 제목, 설명, 담당자, 우선순위, 마감일, 태그
- 담당자 배정 (드래그 또는 선택)
- 서브태스크 (체크리스트)
- 필터: 담당자별, 상태별, 우선순위별, 태그별
- 드래그로 상태 변경 (칸반)
- 활동 로그 자동 기록

UI:
- 칸반: 5개 컬럼, 카드 드래그 (dnd-kit 활용)
- 카드: 제목, 담당자 아바타, 우선순위 색상, 마감일
- 상세 모달: 설명(Markdown), 댓글, 활동 히스토리
```

#### 4.3 현황판 (팀 대시보드) ✅
```
기능:
- 프로젝트 진행률 (전체 태스크 중 완료 비율)
- 멤버별 할당 현황 (누가 몇 개 진행 중)
- 최근 활동 타임라인 (누가 뭘 했는지)
- 이번 주 완료 통계
- 마감 임박 태스크 목록
- 번다운 차트 (선택)

UI:
- 그리드 레이아웃 위젯
- 진행률 원형 차트
- 멤버 아바타 + 태스크 수
- 활동 피드 (실시간 업데이트)
```

### Phase 2: 게시판 + 자료실 ✅ 구현 완료

#### 4.4 게시판 ✅
```
기능:
- 카테고리: 공지, 자유토론, 질문
- 글 작성 (Markdown 지원)
- 댓글
- 고정글 (pinned)
- 검색
- 새 글 알림 (리마인더 시스템 활용)

UI:
- 목록: 제목, 작성자, 날짜, 댓글 수
- 상세: Markdown 렌더링, 댓글 스레드
- 작성: Markdown 에디터 (간단한 툴바)
```

#### 4.5 공유 자료실 ✅
```
기능:
- 폴더 구조 (가상 폴더, 텍스트 경로)
- 파일 업로드 (기존 FileVault 확장)
- 태그 분류
- 버전 관리 (같은 이름 파일 업로드 시 버전 +1)
- 미리보기 (이미지, PDF)
- 팀 저장 용량 관리

UI:
- 폴더 트리 좌측 + 파일 그리드 우측
- 드래그 앤 드롭 업로드
- 파일 카드: 썸네일, 이름, 크기, 업로더, 날짜
```

### Phase 3: 실시간 채팅 ✅ 구현 (polling 방식, WebSocket 미적용)

#### 4.6 채팅 ✅
```
기능:
- 프로젝트별 채팅방 (general 기본 채널)
- 태스크별 스레드 (태스크 카드에서 바로 대화)
- 텍스트 + 파일 전송
- 답글 (reply)
- 읽음 표시
- @멘션 → 알림
- 이모지 리액션

기술:
- Polling (5초 간격) 방식으로 구현 (WebSocket 미적용)
- 메시지 DB 저장
- REST API 기반 메시지 송수신

UI:
- 우측 패널 또는 하단 패널 (슬랙 스타일)
- 채널 목록 + 메시지 영역
- 입력창: 텍스트 + 파일 첨부 + 이모지
```

### Phase 4: 확장 기능 (2026-03-27 구현)

#### 4.7 프로젝트 문서
- 프로젝트 생성 시 개요/사양 문서 입력 가능
- "문서" 탭에서 조회/편집 (admin/owner만 편집)
- 일반 텍스트 에디터

#### 4.8 메시지함 (인박스)
- 사용자 간 직접 메시지 발송
- 태스크 할당 시 자동 알림 메시지 생성
- 받은 메시지 / 보낸 메시지 탭
- 읽음/안읽음 표시, 전체 읽음, 삭제
- 헤더에 안읽은 메시지 벨 아이콘 + 뱃지

#### 4.9 텔레그램 개별 연동
- 각 사용자가 설정에서 연동 코드 생성
- 봇에서 /link CODE로 개별 연동
- 모든 알림이 본인 텔레그램으로 전달
- 신규 명령어: /project, /mytasks, /inbox, /msg
- / 입력 시 자동완성 메뉴 (setMyCommands)

#### 4.10 온라인 상태
- 사이드바 하단에 접속 중인 팀 멤버 표시
- 60초 하트비트, 2분 미응답 시 오프라인
- 초록 점 + 풀네임 표시

---

## 5. API 설계

### 프로젝트
```
GET    /api/projects                    - 내 프로젝트 목록
POST   /api/projects                    - 프로젝트 생성
PUT    /api/projects/:id                - 프로젝트 수정
DELETE /api/projects/:id                - 프로젝트 삭제
POST   /api/projects/:id/members        - 멤버 초대
PUT    /api/projects/:id/members/:uid    - 멤버 역할 변경
DELETE /api/projects/:id/members/:uid    - 멤버 제거
```

### 프로젝트 태스크
```
GET    /api/projects/:id/tasks           - 태스크 목록 (필터 쿼리)
POST   /api/projects/:id/tasks           - 태스크 생성
PUT    /api/projects/:id/tasks/:tid      - 태스크 수정 (상태/담당자/내용)
DELETE /api/projects/:id/tasks/:tid      - 태스크 삭제
PUT    /api/projects/:id/tasks/reorder   - 칸반 순서 변경
GET    /api/projects/:id/tasks/:tid/comments  - 태스크 댓글
POST   /api/projects/:id/tasks/:tid/comments  - 댓글 추가
```

### 게시판
```
GET    /api/projects/:id/posts           - 글 목록
POST   /api/projects/:id/posts           - 글 작성
PUT    /api/projects/:id/posts/:pid      - 글 수정
DELETE /api/projects/:id/posts/:pid      - 글 삭제
POST   /api/projects/:id/posts/:pid/comments  - 댓글
```

### 자료실
```
GET    /api/projects/:id/files           - 파일 목록 (폴더 필터)
POST   /api/projects/:id/files/upload    - 파일 업로드
DELETE /api/projects/:id/files/:fid      - 파일 삭제
PUT    /api/projects/:id/files/:fid/move - 폴더 이동
```

### 채팅
```
GET    /api/projects/:id/messages        - 메시지 히스토리
WS     /ws/projects/:id/chat             - 실시간 채팅 (Socket.io)
```

### 활동 로그
```
GET    /api/projects/:id/activity        - 활동 타임라인
GET    /api/projects/:id/stats           - 프로젝트 통계
```

---

## 6. 권한 모델

```
역할          프로젝트설정  멤버관리  태스크  게시판  자료실  채팅
─────────────────────────────────────────────────────────────
owner         CRUD         CRUD     CRUD   CRUD   CRUD   CRUD
admin         RU           CRU      CRUD   CRUD   CRUD   CRUD
member        R            R        CRUD   CRUD   CRU    CRUD
viewer        R            R        R      R      R      R
```

**팀 그룹 기반 접근 제어 (추가됨)**:
- 관리자가 팀 그룹 생성 → 사용자 배정
- 그룹 소속자만 프로젝트 기능 사용 가능
- 그룹 내 프로젝트는 멤버 전원 viewer 접근
- 개인 사용자는 캘린더/투두/타임박스만 사용

---

## 7. UI/UX 설계

### 네비게이션 확장
```
사이드바
  ├── 개인 (기존)
  │   ├── 캘린더
  │   ├── 타임박스
  │   ├── 할 일
  │   ├── 파일
  │   └── 스케줄러
  │
  ├── ── 구분선 ──
  │
  ├── 프로젝트 (새로 추가)
  │   ├── 🟢 프로젝트 A
  │   │   ├── 현황판
  │   │   ├── 태스크
  │   │   ├── 게시판
  │   │   ├── 자료실
  │   │   └── 채팅
  │   ├── 🔵 프로젝트 B
  │   └── + 새 프로젝트
  │
  └── 설정
```

### 팀 대시보드 레이아웃
```
┌──────────────────────────────────────┐
│  프로젝트명              멤버 아바타들  │
├──────────┬──────────┬────────────────┤
│ 진행률    │ 이번주    │  마감 임박      │
│ 🔵 72%   │ 완료: 12  │  - 보고서 D-2  │
│          │ 생성: 5   │  - 발표 D-5    │
├──────────┴──────────┴────────────────┤
│  최근 활동                            │
│  🟢 김철수가 "UI 디자인" 완료          │
│  🔵 박영희가 "API 문서" 생성           │
│  🟡 이민수가 "DB 설계"에 댓글          │
└──────────────────────────────────────┘
```

### 칸반 보드 레이아웃
```
┌─Backlog──┬──Todo────┬─Progress─┬─Review──┬──Done────┐
│          │          │          │         │          │
│ [카드]    │ [카드]   │ [카드]    │ [카드]  │ [카드]   │
│ [카드]    │ [카드]   │          │         │ [카드]   │
│ [카드]    │          │          │         │ [카드]   │
│          │          │          │         │          │
│ + 추가    │ + 추가   │ + 추가   │ + 추가  │          │
└──────────┴──────────┴──────────┴─────────┴──────────┘

카드 상세:
┌────────────────────────────┐
│ 🔴 UI 디자인 리뉴얼         │
│ 담당: 👤김철수  마감: 3/30   │
│ 태그: #디자인 #긴급          │
│ ☐ 와이어프레임 (2/4)        │
└────────────────────────────┘
```

---

## 8. 기술 스택 추가

| 영역 | 현재 | 추가 |
|------|------|------|
| 실시간 통신 | - | **Socket.io** (채팅, 실시간 업데이트) |
| 에디터 | - | **@uiw/react-md-editor** (Markdown 게시판) |
| 차트 | - | **recharts** (현황판 통계) |
| 드래그 | dnd-kit | 그대로 활용 (칸반) |
| 알림 | Web Notification + Telegram | 그대로 활용 + @멘션 알림 |
| DB | PostgreSQL (Supabase) | 그대로 (테이블 추가) |
| 인증 | JWT | 그대로 + 프로젝트 권한 미들웨어 |
| 메시지 | - | **inbox_messages** 테이블, REST API |
| 온라인 상태 | - | **In-memory heartbeat** (60s interval) |
| 반응형 | Tailwind | **Safe area, dvh, responsive breakpoints** |

---

## 9. 개발 로드맵

### Phase 1 (2~3주) - 팀 기초
```
Week 1: 프로젝트 CRUD + 멤버 관리 + 사이드바 확장
Week 2: 칸반 보드 (태스크 CRUD + 드래그)
Week 3: 현황판 + 활동 로그
```

### Phase 2 (2주) - 소통
```
Week 4: 게시판 (글/댓글, Markdown)
Week 5: 공유 자료실 (폴더, 업로드)
```

### Phase 3 (2주) - 실시간
```
Week 6: Socket.io 채팅 기본
Week 7: 스레드, 멘션, 리액션, 알림 연동
```

### Phase 4 (1주) - 마무리
```
Week 8: 통합 테스트, 성능 최적화, 모바일 반응형
```

---

## 10. 확장 시 주의사항

### 하위 호환
- `project_id = NULL`이면 개인 데이터 (기존과 동일)
- `project_id`가 있으면 팀 데이터
- 기존 API는 변경 없음 (개인 데이터만 반환)
- 팀 API는 `/api/projects/:id/` 네임스페이스로 분리

### 성능
- 프로젝트 멤버 수 제한 (무료: 10명, 유료: 무제한)
- 채팅 메시지 페이지네이션 (최근 50개씩)
- 활동 로그 30일 보관 (이전 데이터 아카이브)
- 파일 용량: 프로젝트당 1GB (무료), 10GB (유료)

### 보안
- 모든 팀 API에 프로젝트 멤버십 검증 미들웨어
- 역할 기반 접근 제어 (RBAC)
- 파일 접근 시 프로젝트 소속 확인
- 채팅 WebSocket 연결 시 JWT + 프로젝트 권한 확인

---

## 11. 수익화 (선택)

```
무료 플랜:
  - 프로젝트 2개
  - 멤버 10명/프로젝트
  - 저장소 1GB/프로젝트
  - 채팅 히스토리 30일

프로 플랜 ($5/user/월):
  - 프로젝트 무제한
  - 멤버 무제한
  - 저장소 10GB/프로젝트
  - 채팅 히스토리 무제한
  - 번다운 차트
  - 우선 지원
```

---

## 12. 경쟁사 대비 차별점

| 기능 | Notion | Slack | TimeBox Team |
|------|--------|-------|--------------|
| 개인 생산성 | ⚪ 약함 | ❌ 없음 | ✅ 타임박스+캘린더+디데이 |
| 칸반 보드 | ✅ | ❌ | ✅ |
| 실시간 채팅 | ⚪ 댓글만 | ✅ | ✅ |
| 게시판 | ✅ 페이지 | ❌ | ✅ |
| 자료실 | ⚪ | ⚪ | ✅ |
| 텔레그램 연동 | ❌ | ❌ | ✅ |
| PWA/오프라인 | ⚪ | ⚪ | ✅ |
| 가격 | $8/user | $7/user | **$5/user** |

**핵심 차별점**: "개인 생산성 도구 + 팀 협업"이 하나의 앱에서 자연스럽게 전환
