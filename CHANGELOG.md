# TimeBox — Changelog & Development Progress

## Project Overview

**TimeBox** — Personal Schedule Manager Web App
- **Stack:** React 18 + Vite 5 + Tailwind CSS + Express.js + PostgreSQL + Drizzle ORM
- **Repo:** https://github.com/JONGMIN-PARK/timebox
- **Deploy:** Render.com (free tier, Singapore region)
- **Monorepo:** pnpm workspace (`@timebox/client`, `@timebox/server`, `@timebox/shared`)
- **Features:** Team collaboration, inbox messaging, per-user Telegram, responsive PWA

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
| Basic reminders | ⏳ Partial | DB schema exists, no UI yet |
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
| Team chat | ✅ Done | Per-project, polling, keep-alive tabs |
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

---

## Features Beyond PRD (Added)

| Feature | Description |
|---------|-------------|
| **Multi-user auth** | Username/password login, JWT, user roles (admin/user) |
| **Registration requests** | Public signup request → admin approval workflow |
| **Admin settings** | User CRUD, role toggle, activate/deactivate, request management |
| **Elon Musk Scheduler** | 3-step: Brain Box → Priority → Time Grid (5-min slots) |
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
| **Kanban → Todo** | "내 할 일에 추가" button copies task to personal todo list |
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
| DB indexes | 10+ new indexes for team/project/inbox tables |

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

### Remaining
- [ ] WebSocket real-time (replace polling)
- [ ] Push notifications (Web Push API)
- [ ] Gantt chart view for projects
- [ ] File versioning
- [ ] @mention in chat/posts
- [ ] Service worker (full offline support)
- [ ] Swipe gestures (mobile)
- [ ] Data analytics dashboard
- [ ] Password complexity requirements

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
| NODE_ENV | Yes | `production` |
| JWT_SECRET | Yes | Random secret string |
| TELEGRAM_BOT_TOKEN | No | BotFather token |
| TELEGRAM_CHAT_ID | No | Your chat ID |
| CORS_ORIGIN | No | Allowed origin for CORS |
| DEFAULT_ADMIN_USERNAME | No | Admin username (default: admin) |
| DEFAULT_ADMIN_PASSWORD | No | Admin password (default: admin123) |
