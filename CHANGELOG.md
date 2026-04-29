# TimeBox — Changelog & Development Progress

## v1.11.1 (e303fed) — 2026-04-29

| 항목 | 설명 | 커밋 |
|------|------|------|
| 🐛 수정 |  | e303fed |

## v1.11.0 (35228bb) — 2026-04-04

| 항목 | 설명 | 커밋 |
|------|------|------|
| 🐛 수정 |  | 35228bb |
| ✨ 기능 |  | b451249 |
| 🔧 기타 | perf: 성능 최적화 + 미연동 기능 수정 5건 | 9b72aab |
| 🐛 수정 |  | d7c552d |
| ✨ 기능 |  | 1eaf28a |
| 🔧 기타 |  | 96a018e |
| ✨ 기능 |  | e384466 |
| ✨ 기능 |  | 79ffc6b |

## v1.10.0 — 2026-04-04

| 항목 | 설명 |
|------|------|
| ✨ 기능 | 버전 업데이트 리스트 자동 관리 시스템 |

## Project Overview

**TimeBox** — Personal Schedule Manager Web App
- **Stack:** React 18 + Vite 5 + Tailwind CSS + Express.js + PostgreSQL + Drizzle ORM + Socket.io
- **Repo:** https://github.com/JONGMIN-PARK/timebox
- **Deploy:** Render.com (starter, Singapore region)
- **Monorepo:** pnpm workspace (`@timebox/client`, `@timebox/server`, `@timebox/shared`)
- **Auth:** JWT + bcryptjs
- **Features:** Team collaboration, real-time chat, inbox messaging, per-user Telegram, admin analytics, responsive PWA

---

## 2026-03-29 — Elon 일간 스케줄러 & 타임블록 확장

| 항목 | 설명 |
|------|------|
| **DB / API** | `time_blocks.notes`, `time_blocks.meta`(JSON), 라우트·검증·백업 import/export |
| **Shared** | `TimeBlock` 타입에 `notes?`, `meta?` |
| **Client** | `ElonScheduler`, `ElonTimeCanvas`, `ElonBlockSheet`, `elonStorage.ts` — 줌/스냅, 링크·핀, 드래그·리사이즈, 전날 복사, 스케치 레이어(일 단위 localStorage) |
| **연동** | Top 3 → 타임라인 저장 시 브레인 덤프 항목 생성·갱신(`meta.brainId`). 블록 삭제 시 브레인 복구 + 제목 일치 시 Top 3 줄 비움 |
| **버그픽스** | 스케줄러에서 날짜 변경이 즉시 오늘로 되돌아가던 현상 제거(`pageVisible` effect 삭제) |
| **i18n** | `elon.*` 키 다수(스케치, Top3·브레인 안내 등) |

관련 커밋 예: `4dc74cf`, `b38173e`, `f82e2d7` (이후 `main` 기준).

---

## 다음 세션에서 이어가기

상세 아이디어·파일 위치는 **[docs/NEXT-SESSION.md](./docs/NEXT-SESSION.md)** 를 본다. 요약:

- 스케치: 애플 펜슬/와콤 — `PointerEvent.pressure`, `getCoalescedEvents()`, (선택) 스타일러스 전용 모드
- 스케치 백업: `meta` 또는 별도 API로 서버 동기화 여부 결정
- UI: 타임라인 전용 “브레인으로 되돌리기”(삭제 없이), 도형/텍스트 레이어
- PRD 브리지: [docs/PRD-personal-schedule-project-bridge.md](./docs/PRD-personal-schedule-project-bridge.md) — 개인 일정 ↔ `projectId` 연결

---

## PRD vs Implementation Status

### Phase 1: MVP — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| Project setup (React + Express + SQLite + Drizzle) | ✅ Done | pnpm monorepo, TypeScript |
| Basic auth (PIN login) | ✅ Done → ⬆️ Upgraded | Replaced with multi-user username/password system |
| Todo list (add/complete/delete/sort) | ✅ Done → ⬆️ Enhanced | + categories, inline edit, D-Day, drag reorder |
| Monthly calendar (events CRUD) | ✅ Done → ⬆️ Enhanced | + weekly/daily views, category colors, todo overlay |
| D-Day widget | ✅ Done | Countdown display, add/delete |
| Basic reminders | ✅ Done | In-app popup, sound, Telegram notification, background support |
| Responsive layout | ✅ Done → ⬆️ Enhanced | Mobile-first, glass effects, safe-area |
| Render.com deploy | ✅ Done | render.yaml blueprint |

### Phase 2: Time Boxing + Telegram — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| TimeBox scheduler | ✅ Done | Timeline UI with 6-24h, categories, completion |
| Weekly/Daily calendar views | ✅ Done | View mode toggle (M/W/D), current time indicator |
| Drag & drop (todos, blocks) | ✅ Done | @dnd-kit, sortable todos, drag overlay |
| Telegram bot (events, todos, reminders) | ✅ Done → ⬆️ Enhanced | 12+ commands, shortcuts, flags |
| Telegram slash commands | ✅ Done | /s /a /t /l /b /d /h + /check /del /week /stats /done |
| Daily briefing | ✅ Done | Cron at 08:00, events + blocks + todos + D-Days |
| Color categories | ✅ Done | 6 event categories + 6 todo categories with sub-categories |
| Dark mode | ✅ Done | Light/Dark/System toggle, localStorage persistence |

### Phase 3: File Vault + Enhancement — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| File vault (upload/download/delete/tags) | ✅ Done | Drag & drop, tag presets, search, storage bar |
| File preview (image/PDF) | ✅ Done | Modal preview, inline images, PDF iframe |
| Telegram → file auto-save | ✅ Done | Documents + photos auto-saved with Telegram tag |
| Recurring reminders | ✅ Done | Daily, weekly, monthly repeat rules |
| Snooze | ✅ Done | 15m / 1h snooze buttons |

### Phase 4: Quality of Life — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| PWA support | ✅ Done | Manifest, standalone, themed, install-ready |
| Daily template | ✅ Done | Save/load/apply time block templates |
| Recurring events | ⏳ Partial | DB field exists, reminder repeat implemented |
| Keyboard shortcuts | ✅ Done | 1-5 tabs, ? help, / search, Esc close |
| Data backup/restore | ✅ Done | JSON export/import, merge or replace |
| Time statistics | ✅ Done | Category stats in TimeBox/Scheduler |
| Actual vs planned time | ⏳ Partial | Completion tracking in time blocks |

### Phase 5: Team Collaboration — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| Team groups (admin manages) | ✅ Done | Create groups, assign users, role-based access |
| Project management | ✅ Done | CRUD with dates, D-Day, docs, team group linking |
| Kanban board | ✅ Done | 5 columns, drag & drop, auto-assign, date range |
| Project dashboard | ✅ Done | Progress, D-Day, weekly stats, member workload, activity |
| Bulletin board | ✅ Done | Posts, comments, categories (notice/discussion/question) |
| Shared file manager | ✅ Done | Folder structure, upload/download, team storage |
| Team chat | ✅ Done → ⬆️ Upgraded | Socket.io real-time, emoji picker, image support |
| Task transfer | ✅ Done | Request/accept/reject workflow, notifications |
| Project documents | ✅ Done | Overview/specs editor, viewer role separation |
| Member management | ✅ Done | Invite, roles, team group auto-viewer access |

### Phase 6: Messaging & Notifications — ✅ Complete

| PRD Item | Status | Notes |
|----------|--------|-------|
| Inbox messaging | ✅ Done | Send/receive, read status, compose with user select |
| Task assignment notifications | ✅ Done | Auto-inbox + Telegram on assign |
| Per-user Telegram | ✅ Done | Link code → /link, per-user chatId, all commands per-user |
| Telegram new commands | ✅ Done | /project, /mytasks, /inbox, /msg + auto-complete menu |
| Online presence | ✅ Done | Heartbeat system, green dot in sidebar |
| Header unread badge | ✅ Done | Bell icon with count, 30s polling |

### Phase 7: Real-time, Analytics & Optimization — ✅ Complete (2026-03-28)

| PRD Item | Status | Notes |
|----------|--------|-------|
| Real-time chat (Socket.io) | ✅ Done | Group rooms, 1:1 chat request, emoji picker, image upload, message delete |
| Activity tracking | ✅ Done | Middleware logging all user actions (create/update/delete) |
| Admin analytics dashboard | ✅ Done | User stats, activity charts, message viewer, auto-cleanup |
| Performance: compression | ✅ Done | gzip/brotli via compression middleware |
| Performance: JWT role cache | ✅ Done | Cached role in token to reduce DB lookups |
| Performance: DB indexes | ✅ Done | Additional indexes on high-traffic query columns |
| Performance: category cache | ✅ Done | Server-side category data cached |
| Performance: useMemo | ✅ Done | Memoized expensive computations in React components |
| Optimistic UI updates | ✅ Done | Instant feedback on todo/task actions before server confirms |
| Toast notifications | ✅ Done | Non-blocking success/error feedback system |
| Mobile: logout in settings | ✅ Done | Logout button accessible on mobile settings page |
| Mobile: reminder/D-Day | ✅ Done | Reminder and D-Day views optimized for mobile |
| Mobile: scheduler for team | ✅ Done | Elon Musk scheduler available for team users on mobile |
| Telegram: QR code linking | ✅ Done | QR code display for easy bot linking |
| Telegram: deep link | ✅ Done | Auto-connect via deep link URL |
| Telegram: polling fix | ✅ Done | Reduced polling interval from 8s to 3s for faster notifications |
| App icons | ✅ Done | SVG + PNG icon set for all platforms (mobile, desktop, PWA) |
| Deploy: pnpm cache | ✅ Done | Build speedup with pnpm store caching |
| Deploy: bcryptjs | ✅ Done | Pure JS bcryptjs replaces native bcrypt (no build issues) |
| Deploy: frozen-lockfile | ✅ Done | Deterministic installs with --frozen-lockfile |

---

## Features Beyond PRD (Added)

| Feature | Description |
|---------|-------------|
| **Multi-user auth** | Username/password login, JWT, user roles (admin/user) |
| **Registration requests** | Public signup request → admin approval workflow |
| **Admin settings** | User CRUD, role toggle, activate/deactivate, request management |
| **Elon Musk Scheduler** | 3-step: Brain Box → Priority → Time Grid (5-min slots) |
| **Elon day view (mobile/desktop)** | Summary, Top 3, timeline tools, time canvas + brain dump, day memo; notes/meta on blocks; sketch layer; Top 3 ↔ brain sync |
| **Todo categories** | Hierarchical: Work (Meeting/Proposal/Dev/Review/Report), Personal, Study, Project, Urgent, Idea |
| **Todo due dates (D-Day)** | Per-todo date with D-Day countdown (color-coded) |
| **Todo inline editing** | Double-click or pencil icon to edit title |
| **Calendar + todo overlay** | Calendar shows both events (dots) and todos (squares) per date |
| **Hover tooltips** | Mouse over calendar dates shows event/todo details |
| **UI polish** | Inter font, glass/blur effects, gradient accents, ambient backgrounds |
| **Animations** | Stagger fade-in, scale-in modals, bounce check, glow pulse, shimmer |
| **Error Boundary** | Catches React crashes, shows reload button |
| **Help modal** | Keyboard shortcuts, Telegram commands, todo flags, tips |
| **File Vault** | Upload/download/delete, drag & drop, tags, search, preview, storage bar |
| **Global search** | Command palette (/ key), searches todos/events/D-Days, keyboard nav |
| **PWA** | Web app manifest, standalone mode, themed, install-to-homescreen |
| **Gradient text** | Rainbow gradient on login title |
| **Particles** | Floating animated particles on backgrounds |
| **Rainbow border** | CSS @property animated gradient border |
| **Ripple/bounce** | Interactive hover effects on icons and buttons |
| **Telegram shortcuts** | 1-2 char aliases (/s /a /t /l /b /d /h) |
| **Telegram todo flags** | Priority (!high !low) + Category (@work @study @project @urgent) |
| **Telegram management** | /check N, /del N, /done, /week, /stats |
| **Team group access control** | Admin creates groups, assigns users; UI conditionally shows team features |
| **Project creation form** | Name, description, dates, color, docs, team group selection |
| **Project D-Day** | Start/target dates, D-Day badge (color-coded) on dashboard |
| **Kanban improvements** | Card follows cursor on drag, blue border for my tasks, full assignee names |
| **Kanban → Todo** | "Add to my todos" button copies task to personal todo list |
| **Project documents** | Markdown/text docs per project, admin/owner editable |
| **Inbox messaging** | User-to-user messages, compose, received/sent tabs, delete |
| **Task assignment inbox** | Auto-notification on assign with project/task/date details |
| **Per-user Telegram** | Each user links via /link CODE, all notifications route to own chatId |
| **Telegram /project** | View project progress and D-Day from Telegram |
| **Telegram /mytasks** | View assigned active tasks from Telegram |
| **Telegram /inbox** | View unread messages from Telegram |
| **Telegram /msg** | Send message to another user from Telegram |
| **Online presence** | Green dot + full name for online team members in sidebar |
| **Todo time support** | Date picker + time picker (HH:MM), stored as YYYY-MM-DDThh:mm |
| **iPhone safe area** | env(safe-area-inset-*) for notch/Dynamic Island padding |
| **Responsive design** | All panels adapt to screen size, tab bar scrollable, column widths scale |
| **Real-time chat (Socket.io)** | WebSocket-based group and 1:1 chat with rooms, typing indicators |
| **Chat emoji picker** | Inline emoji selection in chat messages |
| **Chat image support** | Upload and display images in chat conversations |
| **Chat message delete** | Delete own messages from chat |
| **Admin analytics dashboard** | User activity stats, charts, message viewer, system health |
| **Activity tracking middleware** | Automatic logging of all CRUD actions per user |
| **Admin message viewer** | Admin can view and manage all messages across the system |
| **Admin data backup** | Full database backup and auto-cleanup from admin panel |
| **Toast notification system** | Non-blocking success/error/info toasts for user feedback |
| **Optimistic UI updates** | Instant local state updates before server confirmation |
| **Telegram QR code linking** | QR code in Settings for easy bot connection |
| **Telegram deep link** | One-click deep link URL for Telegram bot auto-connect |
| **Task emoji reactions** | React to kanban tasks with emoji (displayed on cards) |
| **Project overview summary** | Dashboard summary view for project health |
| **App icons (SVG + PNG)** | Full icon set for mobile homescreen, desktop, and PWA |
| **Compact todo meta** | Category, date, D-Day in single line for cleaner display |
| **CI/CD pipeline** | Auto-deploy to Render after successful build |

---

## Technical Improvements (Refactoring)

| Item | Description |
|------|-------------|
| adminMiddleware | Extracted from 6x duplicated checks into reusable middleware |
| safeParseId | parseInt validation helper (NaN safety) |
| JWT_SECRET enforcement | Fails hard in production if not set |
| ErrorBoundary | React error boundary prevents full app crash |
| Per-user data isolation | All tables have userId, queries filtered by user |
| Telegram prod-only | Bot polling only in NODE_ENV=production (prevents conflict) |
| CORS + Rate limiting | Configurable origin, 300/15min general, 20/15min auth |
| File upload shared module | lib/upload.ts: multer fileFilter, safeUnlink, safeJsonParse |
| N+1 query fixes | inArray + Map lookups, db.transaction for reorder |
| React.memo + useCallback | KanbanBoard TaskCard memoized, handlers stabilized |
| i18n coverage | 50+ new translation keys, all hardcoded Korean removed |
| Accessibility | ARIA labels, dialog roles, focus trap, escape handlers |
| Token security | Removed cache storage duplication, localStorage only |
| DB indexes | 10+ new indexes for team/project/inbox/activity tables |
| compression middleware | gzip/brotli response compression for all API responses |
| JWT role cache | Role embedded in JWT token to eliminate per-request DB role lookups |
| Category cache | Server-side caching of category data to reduce repeated queries |
| useMemo optimization | Memoized expensive list filtering and computation in React |
| Shared helpers: userEnrichment | Centralized user data enrichment logic for API responses |
| Shared helpers: constants | Shared constants module for categories, roles, limits |
| Shared helpers: Avatar | Reusable Avatar component across all views |
| Shared helpers: usePolling | Custom hook for polling-based data refresh with cleanup |
| Shared helpers: Toast | Centralized toast notification utility |
| Optimistic UI pattern | Local state updated before server round-trip for instant feel |
| bcryptjs migration | Replaced native bcrypt with pure JS bcryptjs (no native build deps) |
| pnpm cache + frozen-lockfile | Faster CI builds with cached pnpm store and deterministic installs |
| Stale cache elimination | Service worker versioning ensures fresh code on deploy |

---

## Commit History

```
891a892 Initial project setup: pnpm monorepo with React + Express + TypeScript
95f298c Implement Phase 1 MVP: auth, todo, calendar, d-day with full-stack
1023e25 Implement Phase 2: timebox scheduler, weekly/daily views, dark mode, telegram bot
7564780 Add Render.com deployment config
eb7ac09 Remove persistent disk from render.yaml for free tier compatibility
cde0a3c Add todo due dates with D-Day display, calendar todo integration, hover tooltips
2a1d1cc Multi-user auth, English UI, inline todo editing, admin settings
8c3f963 Fix ESM require error for bcrypt in db init
d3b8ed9 Add Elon Musk-style 5-minute grid scheduler
86ddb9c Redesign scheduler with Elon Musk 3-step workflow: Brain Box → Priority → Time Grid
9461afb Responsive UI overhaul: mobile-first scheduler, layout fixes, UX polish
d4c7aa2 Only start Telegram bot polling in production to prevent conflict
def025a UI polish: Inter font, glass effects, refined colors, subtle animations
98fe9d6 Add user registration request workflow with admin approval
53070e7 Add todo categorization with hierarchical categories and filtering
d8bd49c Add animations, ambient backgrounds, data backup/restore
1b56c8c Refactoring, Telegram enhancement, keyboard shortcuts, help modal
8458a1b Code review fixes + team group access control feature
d69d943 Fix sidebar: show ungrouped projects + grouped projects together
633678b Add project creation UI + fix ProjectView i18n
f2c67fa Add GET /api/projects/:projectId endpoint
35b7ff7 Fix dashboard: stats/activity API field mapping + auto-refresh
bd57987 Fix dashboard: use memberStats from stats API instead of members endpoint
35f4d82 Improve dashboard-task integration
8aa56b8 Fix: project-invited users can now see team features
4d0fe1e Fix: stats/activity endpoints missing projectMemberMiddleware
340e038 Add project dates, task date range, D-Day display, transfer badge
c82ca79 Admin-only project creation, fix drag UX, show full assignee names
be70f54 Fix drag: make entire card draggable, not just handle icon
3f7f019 Fix drag: card itself follows cursor via transform instead of DragOverlay
60bb3d5 Fix drag: card no longer hides behind other columns
c647d24 Chat layout fix, team group project access, task indicators, online status
3a389fe Add kanban-to-todo integration + project documents feature
da34327 Add inbox messaging system with task assignment notifications
6c6a894 Add Telegram notifications for inbox messages and task assignments
269e10b Per-user Telegram linking + todo time/minute support
7bb4df4 Fix: all users can compose inbox messages, not just admins
106ba64 Overhaul Telegram bot: per-user commands + 4 new commands + auto-complete
f040e92 Responsive design: auto-adapt to all screen sizes
d6eab73 Fix iPhone safe area: prevent overlap with status bar/Dynamic Island
37b184a Update all documentation with today's implementation progress
ff70777 Major refactoring: performance, security, code quality for 100+ users
3f982f0 Add task emoji reactions + project overview summary dashboard
b913ae6 Add CI/CD: auto-deploy to Render after successful build
6595472 Show emoji reactions on kanban task cards
d161031 Redesign project header: D-Day, dates, members, transfer badges
cea6180 Inline date editing in project header + kanban within-column reordering
902987c Fix drag offset: remove DragOverlay, use useSortable transform directly
cd87d40 Add Telegram linking UI in Settings for all users
373bc87 Mobile optimization + deploy build speedup
4b590b8 Add TimeBox app icons for mobile and desktop
ec779b2 Compact todo meta row: category, date, D-Day in single line
82f5222 Fix Telegram notification delay by tuning polling config
75c5d90 Add QR code for Telegram linking + deep link auto-connect
380567d Refresh inbox bell count immediately on read/delete
45599b0 Add real-time chat, activity tracking, and admin analytics
edf1a1d Fix ChatPanel API paths and socket message handling
0d5f984 Fix activity tracking: register middleware before routes, log all actions
d7a51f0 Fix analytics dashboard: match server response format
37ad04f Fix SW cache error for non-http schemes + add mobile-web-app-capable meta
3024314 Fix chat auto-scroll: scroll within container only, not page
94ce4a7 Fix chat React error: match server response structure
d2664da Eliminate stale cache: instant updates on deploy
f6c1079 Major refactoring: shared helpers, performance, i18n, accessibility
217ddc9 Add message delete, emoji picker, and image support for all chat
15c63ba Admin data management: full backup, message viewer, auto-cleanup
7f5d170 Fix analytics crash: null-safe access + fix message API field names
82f19e7 Major performance & UX upgrade: compression, real-time, optimistic UI
```

---

## Remaining Work (Backlog)

### Completed
- [x] ~~File Vault~~ ✅
- [x] ~~Reminder system UI~~ ✅
- [x] ~~Telegram per-user config~~ ✅
- [x] ~~PWA support~~ ✅
- [x] ~~Recurring reminders~~ ✅
- [x] ~~Daily schedule templates~~ ✅
- [x] ~~Telegram file → vault auto-save~~ ✅
- [x] ~~Search across all entities~~ ✅
- [x] ~~Team collaboration~~ ✅
- [x] ~~Inbox messaging~~ ✅
- [x] ~~Per-user Telegram~~ ✅
- [x] ~~Responsive design~~ ✅
- [x] ~~iPhone safe area~~ ✅
- [x] ~~WebSocket real-time (Socket.io chat)~~ ✅
- [x] ~~Data analytics dashboard~~ ✅

### Remaining
- [ ] Push notifications (Web Push API)
- [ ] Gantt chart view for projects
- [ ] File versioning
- [ ] @mention in chat/posts
- [ ] Service worker (full offline support)
- [ ] Swipe gestures (mobile)
- [ ] Password complexity requirements
- [ ] Recurring events UI (DB field exists, no front-end)
- [ ] Actual vs planned time comparison view
- [ ] Chat read receipts / typing indicators
- [ ] Project archiving
- [ ] Bulk task operations (multi-select, batch update)

---

## Environment Setup

```bash
# Local development
pnpm install
pnpm dev          # starts client (5173) + server (3001)

# Production build
pnpm build
pnpm start

# Default admin account (first run)
# username: admin (or DEFAULT_ADMIN_USERNAME)
# password: admin123 (or DEFAULT_ADMIN_PASSWORD)
# Change password immediately after first login
```

### Environment Variables (Render.com)

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| NODE_ENV | Yes | `production` |
| JWT_SECRET | Yes | Random secret string |
| TELEGRAM_BOT_TOKEN | No | BotFather token |
| TELEGRAM_CHAT_ID | No | Your chat ID |
| CORS_ORIGIN | No | Allowed origin for CORS |
| DEFAULT_ADMIN_USERNAME | No | Admin username (default: admin) |
| DEFAULT_ADMIN_PASSWORD | No | Admin password (default: admin123) |
