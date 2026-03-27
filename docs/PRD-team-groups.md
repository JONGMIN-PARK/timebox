# PRD: 팀 그룹 기반 UI 분리 및 접근 제어

## 1. 개요

**목표:** 관리자가 등록된 사용자를 "팀 그룹"에 배정할 수 있게 하고, 그룹 소속 여부에 따라 UI와 기능 접근을 분리한다.

**핵심 원칙:**
- 개인 사용자 = 개인 생산성 도구만 사용
- 팀 그룹 사용자 = 개인 도구 + 팀 협업 기능 사용
- 관리자(admin)가 그룹 생성/관리/배정 권한 보유
- 기존 프로젝트 기능은 팀 그룹 내부에서 동작하도록 연결

**기존 PRD와의 관계:**
- `PRD.md` (개인 일정관리): 이 기능은 변경 없이 모든 사용자에게 유지
- `PRD-team-collaboration.md` (팀 협업): 이 기능이 팀 그룹 소속 사용자에게만 제공되도록 접근 제어 추가
- 본 PRD는 위 두 PRD 사이의 **접근 제어 레이어**를 정의

---

## 2. 사용자 유형별 기능 접근 매트릭스

```
기능                    개인 사용자    팀 그룹 사용자    관리자(admin)
───────────────────────────────────────────────────────────────────
캘린더 (개인 일정)       ✅             ✅               ✅
타임박스 스케줄러        ✅             ✅               ✅
투두 리스트              ✅             ✅               ✅
개인 파일 보관함         ✅             ✅               ✅
디데이                   ✅             ✅               ✅
리마인더                 ✅             ✅               ✅
텔레그램 봇              ✅             ✅               ✅
설정 (개인)              ✅             ✅               ✅
───────────────────────────────────────────────────────────────────
팀 프로젝트 (칸반)       ❌             ✅               ✅
팀 게시판                ❌             ✅               ✅
팀 자료실                ❌             ✅               ✅
팀 채팅                  ❌             ✅               ✅
팀 현황판                ❌             ✅               ✅
업무 전달                ❌             ✅               ✅
멤버 관리                ❌             ⚪ (역할별)       ✅
───────────────────────────────────────────────────────────────────
팀 그룹 관리             ❌             ❌               ✅
사용자 관리              ❌             ❌               ✅
그룹 배정/해제           ❌             ❌               ✅
```

---

## 3. 정보 구조 변경

### 3.1 현재 구조 (코드 기준)
```
사용자 (User: authStore.ts)
  ├── 개인 공간 (캘린더, 타임박스, 투두, 파일, 디데이, 리마인더)
  └── 프로젝트 (모든 인증 사용자가 프로젝트 생성/접근 가능)
      └── Sidebar.tsx: 항상 프로젝트 섹션 표시 + "새 프로젝트" 버튼
```

**현재 문제:** `Sidebar.tsx`가 모든 인증 사용자에게 프로젝트 섹션을 노출하고, `projectStore.fetchProjects()`가 무조건 호출된다. 팀 기능에 대한 접근 제어가 없다.

### 3.2 변경 후 구조
```
사용자 (User)
  ├── 개인 공간 (모든 사용자 접근 가능)
  │   ├── 캘린더, 타임박스, 투두, 파일
  │   ├── 디데이, 리마인더
  │   └── 스케줄러
  │
  └── 팀 공간 (팀 그룹 소속 사용자만)
      ├── 팀 그룹 A
      │   ├── 프로젝트들 (칸반, 태스크)
      │   ├── 팀 게시판
      │   ├── 팀 자료실
      │   ├── 팀 채팅
      │   └── 현황판
      │
      └── 팀 그룹 B
          └── ...

관리자 (Admin)
  └── 관리 영역
      ├── 사용자 관리 (기존: SettingsPage.tsx의 isAdmin 분기)
      ├── 팀 그룹 관리 (신규)
      │   ├── 그룹 CRUD
      │   └── 멤버 배정/해제
      └── 접근 요청 관리 (기존: auth.ts /api/auth/requests)
```

---

## 4. 데이터 모델 확장

### 4.1 신규 테이블: team_groups

```sql
CREATE TABLE IF NOT EXISTS team_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT,
  created_by INTEGER NOT NULL,           -- admin user ID
  max_members INTEGER DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT true,  -- 비활성화 시 팀 기능 접근 차단
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);
```

### 4.2 신규 테이블: team_group_members

```sql
CREATE TABLE IF NOT EXISTS team_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',    -- 'leader' | 'member'
  joined_at TEXT NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_group_members_group ON team_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_team_group_members_user ON team_group_members(user_id);
```

### 4.3 기존 테이블 연결: projects

```sql
-- projects 테이블에 team_group_id 추가 (schema.ts + initDb 둘 다 변경)
ALTER TABLE projects ADD COLUMN team_group_id INTEGER REFERENCES team_groups(id);
CREATE INDEX IF NOT EXISTS idx_projects_team_group ON projects(team_group_id);
```

- `team_group_id = NULL` → 독립 프로젝트 (기존 호환, 팀 그룹 소속자만 생성 가능)
- `team_group_id = N` → 특정 팀 그룹 소속 프로젝트

### 4.4 Drizzle ORM 스키마 추가 (schema.ts)

```typescript
// schema.ts에 추가
export const teamGroups = pgTable("team_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon"),
  createdBy: integer("created_by").notNull(),
  maxMembers: integer("max_members").default(50),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export const teamGroupMembers = pgTable("team_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`now()`),
});

// 기존 projects 테이블에 추가
// teamGroupId: integer("team_group_id"),
```

### 4.5 users 테이블 확장 (변경 없음)

기존 `users.role` ("admin" | "user")은 그대로 유지.
팀 그룹 소속 여부는 `team_group_members` 조인으로 판단.

---

## 5. API 설계

### 5.1 팀 그룹 관리 (관리자 전용)

```
GET    /api/admin/groups                   - 전체 팀 그룹 목록 (멤버 수 포함)
POST   /api/admin/groups                   - 팀 그룹 생성
       body: { name, description?, color?, icon?, maxMembers? }
PUT    /api/admin/groups/:groupId          - 팀 그룹 수정
       body: { name?, description?, color?, icon?, maxMembers?, active? }
DELETE /api/admin/groups/:groupId          - 팀 그룹 삭제
       query: ?deleteProjects=true|false (소속 프로젝트 처리 방식)

GET    /api/admin/groups/:groupId/members  - 그룹 멤버 목록 (유저 정보 포함)
POST   /api/admin/groups/:groupId/members  - 멤버 배정
       body: { userId, role? }
PUT    /api/admin/groups/:groupId/members/:userId - 멤버 역할 변경
       body: { role }
DELETE /api/admin/groups/:groupId/members/:userId - 멤버 해제

GET    /api/admin/users/available?groupId=N  - 그룹에 미소속된 사용자 목록
       (멤버 추가 시 검색/선택용)
```

**미들웨어:** `authMiddleware` → `adminMiddleware`
**라우트 등록:** `app.use("/api/admin/groups", authMiddleware, adminMiddleware, groupRoutes);`

### 5.2 사용자용 API

```
GET    /api/my/groups                      - 내가 속한 팀 그룹 목록
       응답: [{ id, name, color, icon, role, memberCount }]
GET    /api/my/groups/:groupId             - 특정 그룹 상세 (프로젝트 목록 포함)
       응답: { ...group, projects: [...], members: [...] }
```

**미들웨어:** `authMiddleware` (그룹 소속 검증은 핸들러 내부에서)

### 5.3 기존 API 변경

```
GET /api/auth/me
  현재 응답: { id, username, displayName, role }
  변경 응답: { id, username, displayName, role, teamGroups: [{ id, name, color, role }] }
  변경 위치: auth.ts GET /me 핸들러에서 team_group_members JOIN 추가

GET /api/auth/login
  현재 응답: { token, user: { id, username, displayName, role } }
  변경 응답: { token, user: { id, username, displayName, role, teamGroups: [...] } }
  변경 위치: auth.ts POST /login 핸들러

GET /api/projects
  현재: 사용자가 project_members에 속한 모든 프로젝트 반환
  변경: 팀 그룹 미소속 사용자 → 빈 배열 반환 (+ 403 아님, 정상 빈 응답)
        admin → 모든 프로젝트 반환
  변경 위치: projects.ts GET / 핸들러

POST /api/projects
  현재: 모든 인증 사용자가 프로젝트 생성 가능
  변경: 팀 그룹 소속자 또는 admin만 생성 가능
        body에 teamGroupId 필드 추가 (선택)
  변경 위치: projects.ts POST / 핸들러
```

### 5.4 API 에러 응답 규격

```typescript
// 팀 그룹 미소속 사용자가 팀 기능 접근 시
{ success: false, error: "TEAM_GROUP_REQUIRED", message: "팀 그룹에 소속되어야 사용할 수 있습니다" }

// 비활성화된 그룹 접근 시
{ success: false, error: "GROUP_INACTIVE", message: "이 팀 그룹은 비활성화되었습니다" }

// 그룹 멤버 수 초과 시
{ success: false, error: "GROUP_FULL", message: "그룹 최대 멤버 수에 도달했습니다" }
```

---

## 6. UI/UX 설계

### 6.1 개인 사용자 (팀 그룹 미소속) UI

```
사이드바 (Sidebar.tsx 변경)
  ├── 캘린더
  ├── 타임박스
  ├── 할 일
  ├── 파일
  ├── 스케줄러
  │
  ├── ── (프로젝트 섹션 숨김) ──
  │
  └── 설정
```

**변경 대상: `Sidebar.tsx`**
- 현재: `projects` 섹션이 항상 표시됨 (109행 ~)
- 변경: `user.teamGroups.length > 0 || user.role === 'admin'` 조건으로 감싸기
- `fetchProjects()`도 조건부 호출

**변경 대상: `MobileNav.tsx`**
- 현재: 개인 탭만 표시 (프로젝트 진입 경로 없음)
- 변경: 팀 그룹 사용자에게 "팀" 탭 추가 (기존 5개 → 조건부 6개)

**변경 대상: `DashboardPage.tsx`**
- 현재: `activeProjectId`가 있으면 `ProjectView` 표시
- 변경: 팀 그룹 미소속 사용자는 `activeProjectId`가 설정되지 않도록 방어

### 6.2 팀 그룹 사용자 UI

```
사이드바
  ├── 캘린더
  ├── 타임박스
  ├── 할 일
  ├── 파일
  ├── 스케줄러
  │
  ├── ── 구분선 ──
  │
  ├── 🟢 팀 그룹 A               (그룹 이름, 클릭 시 펼침/접힘)
  │   ├── 📊 프로젝트 A
  │   ├── 📊 프로젝트 B
  │   └── + 새 프로젝트           (leader/admin만)
  │
  ├── 🔵 팀 그룹 B               (복수 그룹 소속 가능)
  │   └── ...
  │
  └── 설정
```

**변경 대상: `Sidebar.tsx`**
- 현재: 플랫 프로젝트 목록 (115행 ~ `projects.map`)
- 변경: `user.teamGroups`를 기준으로 그룹별 아코디언 구조
- 각 그룹: 색상 dot + 이름 + 멤버 수 뱃지
- 펼치기/접기 상태: `useState<Set<number>>` (열린 그룹 ID 집합)
- "새 프로젝트" 버튼: 그룹 내 role이 'leader'이거나 시스템 admin일 때만

**변경 대상: `projectStore.ts`**
- `Project` 인터페이스에 `teamGroupId: number | null` 추가
- `fetchProjects` 응답이 `teamGroupId`를 포함하도록

### 6.3 관리자 UI (설정 > 팀 관리)

**변경 대상: `SettingsPage.tsx`**
- 현재: 프로필 / 외관 / 데이터 / 사용자 관리(admin) 섹션
- 추가: "팀 그룹 관리" 섹션 (admin 전용, `isAdmin` 조건)

```
┌────────────────────────────────────────────────────────────────┐
│ 팀 그룹 관리                                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [+ 새 그룹 만들기]                                              │
│                                                                │
│ ┌──────────────────────────────────────────────────────┐      │
│ │ 🟢 개발팀 (5/50명)                      [수정] [삭제] │      │
│ │    설명: 백엔드/프론트엔드 개발 팀                      │      │
│ │    ┌─────────────────────────────────────────────┐   │      │
│ │    │ 👤 김철수 (leader)          [역할▾] [해제]   │   │      │
│ │    │ 👤 박영희 (member)          [역할▾] [해제]   │   │      │
│ │    │ 👤 이민수 (member)          [역할▾] [해제]   │   │      │
│ │    │ [+ 멤버 추가]                                │   │      │
│ │    └─────────────────────────────────────────────┘   │      │
│ └──────────────────────────────────────────────────────┘      │
│                                                                │
│ ┌──────────────────────────────────────────────────────┐      │
│ │ 🔵 디자인팀 (3/50명)                    [수정] [삭제] │      │
│ │    ...                                               │      │
│ └──────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────┘

멤버 추가 UI (인라인 또는 모달):
┌──────────────────────────────────────┐
│ 사용자 검색: [_______________] 🔍     │
│                                      │
│ ☐ 홍길동 (@hong)                     │
│ ☐ 최수진 (@choi)                     │
│                                      │
│ 역할: [member ▾]                     │
│                                      │
│            [취소] [추가]              │
└──────────────────────────────────────┘
```

### 6.4 사용자 관리에 그룹 소속 표시

**변경 대상: `SettingsPage.tsx` 사용자 관리 섹션**
- 현재: 사용자 목록에 username, role, active만 표시
- 변경: 소속 그룹 뱃지 표시 (예: `김철수 [admin] [개발팀] [디자인팀]`)
- 사용자 관리에서 직접 그룹 배정도 가능하면 편리 (바로가기 링크)

---

## 7. 사이드바 동작 상세

### 7.1 팀 그룹 소속 판단 로직

```typescript
// authStore.ts 변경
interface User {
  id: number;
  username: string;
  displayName: string | null;
  role: string;                          // 기존
  teamGroups: TeamGroupSummary[];        // 신규 필드
}

interface TeamGroupSummary {
  id: number;
  name: string;
  color: string;
  role: string;  // 'leader' | 'member'
}

// Sidebar.tsx에서:
const isAdmin = user?.role === 'admin';
const hasTeamGroups = user?.teamGroups && user.teamGroups.length > 0;
const showTeamSection = isAdmin || hasTeamGroups;
// showTeamSection = true  → 프로젝트 섹션 표시
// showTeamSection = false → 프로젝트 섹션 숨김
```

### 7.2 프로젝트 목록 그룹핑

```typescript
// projectStore.ts 변경
interface Project {
  // ...기존 필드
  teamGroupId: number | null;            // 신규
}

// Sidebar.tsx에서 그룹별 묶기
const groupedProjects = useMemo(() => {
  if (!user?.teamGroups) return [];
  return user.teamGroups.map(group => ({
    group,
    projects: projects.filter(p => p.teamGroupId === group.id),
  }));
}, [user?.teamGroups, projects]);
```

### 7.3 사이드바 접기/펼치기 상태 유지

```typescript
// localStorage에 저장하여 새로고침 후에도 유지
const [openGroups, setOpenGroups] = useState<Set<number>>(() => {
  const saved = localStorage.getItem('timebox-open-groups');
  return saved ? new Set(JSON.parse(saved)) : new Set();
});

const toggleGroup = (groupId: number) => {
  setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    localStorage.setItem('timebox-open-groups', JSON.stringify([...next]));
    return next;
  });
};
```

---

## 8. 권한 모델 확장

### 8.1 역할 체계

```
시스템 역할 (users.role)     팀 그룹 역할 (team_group_members.role)
──────────────────────────────────────────────────────────────
admin   → 모든 기능 + 관리    (그룹 소속 불필요, 자동 전체 접근)
user    → 개인 기능만          leader → 프로젝트 생성/삭제, 멤버 관리
                               member → 프로젝트 참여, 게시판/채팅 사용

프로젝트 역할 (project_members.role) - 기존 유지
  owner  → 프로젝트 설정, 멤버 관리, CRUD
  admin  → 멤버 관리, CRUD
  member → CRUD (본인 작성분)
  viewer → 읽기만
```

### 8.2 권한 체크 우선순위

```
1. 시스템 admin이면 → 모든 팀/프로젝트 접근 허용
2. 팀 그룹 소속이면 → 해당 그룹의 프로젝트에 접근 가능
3. 프로젝트 멤버이면 → 프로젝트 멤버 역할에 따라 권한 적용
4. 그 외 → 개인 기능만
```

### 8.3 미들웨어 흐름

```
요청 → authMiddleware (JWT 검증, req.userId 설정)
     ↓
  개인 API (/api/todos, /api/events 등)
     → 바로 라우트 핸들러 (기존과 동일)

  팀 API (/api/projects/*)
     → teamGroupCheckMiddleware (그룹 소속 확인 또는 admin 확인)
     → projectMemberMiddleware (기존, 프로젝트 멤버 확인)
     → 라우트 핸들러

  관리자 API (/api/admin/groups/*)
     → adminMiddleware (기존)
     → 라우트 핸들러
```

**신규 미들웨어: `teamGroupCheckMiddleware`**
```typescript
// middleware/teamGroupAuth.ts
export async function teamGroupCheckMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // admin은 무조건 통과
  const user = await db.select().from(users).where(eq(users.id, req.userId!));
  if (user[0]?.role === 'admin') { next(); return; }

  // 팀 그룹 소속 확인
  const memberships = await db.select().from(teamGroupMembers)
    .where(eq(teamGroupMembers.userId, req.userId!));
  if (memberships.length === 0) {
    res.status(403).json({ success: false, error: "TEAM_GROUP_REQUIRED" });
    return;
  }
  next();
}
```

---

## 9. 마이그레이션 전략

### 9.1 기존 데이터 호환

- 기존에 생성된 프로젝트(`team_group_id = NULL`)는 별도 마이그레이션 불필요
- admin이 팀 그룹 생성 후, 기존 프로젝트를 그룹에 연결 가능 (PUT /api/admin/groups/:id에서)
- 기존 사용자는 그룹 미소속 상태로 시작 → 개인 기능만 사용
- **주의:** 기존 프로젝트가 있는 경우, 사이드바에서 갑자기 사라짐 → admin에게 마이그레이션 안내 필요

### 9.2 마이그레이션 안내 UX

```
// admin이 로그인 시 기존 프로젝트가 있고 팀 그룹이 0개면:
알림 배너: "기존 프로젝트를 팀 그룹에 연결해주세요.
          팀 그룹을 만들고 프로젝트를 배정하면 멤버들이 접근할 수 있습니다."
          [팀 그룹 만들기] [나중에]
```

### 9.3 단계적 전환

```
Phase 1: 백엔드 (데이터 모델 + API)
  - DB 테이블 생성 (initDb에 추가)
  - Drizzle 스키마 추가 (schema.ts)
  - projects 테이블에 team_group_id 컬럼 추가
  - /api/admin/groups/* API 구현
  - /api/my/groups API 구현
  - /api/auth/me, /api/auth/login 응답 확장
  - teamGroupCheckMiddleware 구현
  - /api/projects 라우트에 미들웨어 적용

Phase 2: 프론트엔드 (사이드바 + 접근 제어)
  - authStore User 타입 확장
  - Sidebar.tsx: 그룹 기반 조건부 렌더링
  - MobileNav.tsx: 팀 탭 조건부 추가
  - projectStore.ts: teamGroupId 필드 추가
  - DashboardPage.tsx: 팀 그룹 미소속 방어 로직

Phase 3: 관리자 UI
  - SettingsPage.tsx: "팀 그룹 관리" 섹션 추가
  - 그룹 CRUD UI 컴포넌트
  - 멤버 배정/해제 UI (사용자 검색 + 선택)
  - 마이그레이션 안내 배너 (기존 프로젝트 연결)

Phase 4: i18n + 테스트
  - 팀 그룹 관련 번역 키 추가 (en/ko)
  - 에지 케이스 수동 테스트
  - 빌드 검증
```

---

## 10. 에지 케이스

| 시나리오 | 처리 방식 |
|----------|-----------|
| 사용자가 복수 팀 그룹에 소속 | 사이드바에 모든 그룹 표시, 각 그룹별 프로젝트 묶음 |
| 팀 그룹에서 해제된 사용자 | 즉시 팀 기능 접근 차단, 프로젝트 섹션 사라짐. 개인 데이터는 유지. 이미 열려있는 프로젝트 뷰는 다음 API 호출 시 403으로 개인 화면으로 돌아감 |
| 팀 그룹 삭제 | CASCADE로 team_group_members 삭제. admin에게 소속 프로젝트 처리 선택: (a) 프로젝트도 삭제, (b) 프로젝트 연결만 해제(team_group_id = NULL, 이후 다른 그룹에 재연결 가능) |
| admin 계정 | 팀 그룹 소속 여부와 무관하게 모든 프로젝트/그룹에 접근 가능. 사이드바에 모든 그룹 표시 |
| leader가 그룹 탈퇴 | admin만 그룹 멤버 관리 가능하므로 leader 해제는 admin이 직접 수행 |
| 프로젝트 생성 시 그룹 연결 | 사용자가 소속된 그룹이 1개면 자동 연결, 복수면 선택 UI 제공 |
| 그룹이 비활성화(active=false) | 소속 멤버에게 팀 기능 접근 차단, 사이드바에서 그룹이 회색 처리 + "비활성화됨" 표시 |
| 사용자 삭제 | CASCADE로 team_group_members에서도 제거 (4.2에서 ON DELETE CASCADE 설정) |
| 동시에 같은 사용자를 두 admin이 배정 | UNIQUE(group_id, user_id) 제약으로 중복 방지, 두 번째 요청은 409 Conflict |
| 그룹의 max_members 초과 시 | 멤버 추가 API에서 현재 인원 체크 후 거부 (GROUP_FULL 에러) |
| leader 없는 그룹 | 허용 (admin이 외부에서 관리), 단 UI에서 "leader가 없습니다" 경고 표시 |

---

## 11. 성공 지표

| 지표 | 목표 |
|------|------|
| 개인 사용자 → 팀 사용자 전환 시 UI 로딩 | < 200ms (fetchMe 응답으로 즉시 판단) |
| 팀 그룹 미소속 사용자의 프로젝트 API 차단 | 403 응답, 0건의 데이터 누출 |
| admin 그룹 관리 UI 조작 | 3클릭 이내로 멤버 추가 완료 |
| 기존 기능 하위 호환 | 개인 사용자 기능 100% 유지 |
| 사이드바 그룹 렌더링 | 10개 그룹, 50개 프로젝트에서도 jank 없음 |

---

## 12. 기술 변경 요약

### 백엔드 변경
| 파일 | 변경 내용 |
|------|-----------|
| `db/schema.ts` | `teamGroups`, `teamGroupMembers` 테이블 스키마 추가, `projects`에 `teamGroupId` 필드 추가 |
| `db/index.ts` | `initDb()`에 CREATE TABLE, CREATE INDEX 추가 |
| `routes/teamGroups.ts` | 신규 파일: admin 그룹 CRUD + 멤버 관리 API |
| `routes/myGroups.ts` | 신규 파일: 사용자 그룹 조회 API |
| `routes/auth.ts` | `/me`, `/login` 응답에 `teamGroups` 필드 추가 |
| `routes/projects.ts` | 프로젝트 생성 시 `teamGroupId` 처리, 목록 조회 시 그룹 소속 필터 |
| `middleware/teamGroupAuth.ts` | 신규 파일: `teamGroupCheckMiddleware` |
| `index.ts` | 신규 라우트 등록 (`/api/admin/groups`, `/api/my/groups`), 기존 `/api/projects`에 미들웨어 추가 |

### 프론트엔드 변경
| 파일 | 변경 내용 |
|------|-----------|
| `stores/authStore.ts` | `User` 타입에 `teamGroups: TeamGroupSummary[]` 추가 |
| `stores/projectStore.ts` | `Project`에 `teamGroupId` 추가, 그룹별 필터 |
| `stores/teamGroupStore.ts` | 신규 파일: admin 그룹 관리 스토어 |
| `components/layout/Sidebar.tsx` | 그룹 소속 여부 조건부 렌더링, 그룹별 아코디언 |
| `components/layout/MobileNav.tsx` | 팀 그룹 사용자에게 "팀" 탭 추가 |
| `pages/DashboardPage.tsx` | 팀 그룹 미소속 방어, 프로젝트 뷰 접근 차단 |
| `pages/SettingsPage.tsx` | "팀 그룹 관리" 섹션 추가 (admin 전용) |
| `components/settings/TeamGroupManager.tsx` | 신규 파일: 그룹 CRUD + 멤버 관리 UI |
| `lib/i18n.ts` | 팀 그룹 관련 번역 키 추가 (en/ko) |

---

## 13. 기존 PRD 영향 분석

| 기존 PRD | 영향 | 필요 조치 |
|----------|------|-----------|
| `PRD.md` (개인 기능) | 없음 | 변경 불필요. 모든 사용자에게 동일하게 제공 |
| `PRD-team-collaboration.md` (팀 협업) | 접근 제어 추가 | "모든 인증 사용자" → "팀 그룹 소속 사용자"로 전제 변경. 프로젝트가 반드시 팀 그룹에 속하도록 제약 추가. 권한 모델 섹션(6장) 업데이트 필요 |

### PRD-team-collaboration.md 갱신 사항
- 2장 정보 구조: 프로젝트 위에 "팀 그룹" 레이어 추가
- 6장 권한 모델: 시스템 역할 → 그룹 역할 → 프로젝트 역할 3단계로 확장
- 7장 UI/UX: 사이드바 프로젝트 섹션이 그룹별로 묶임을 반영
- 10장 주의사항 > 보안: teamGroupCheckMiddleware 언급 추가
