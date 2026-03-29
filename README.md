# TimeBox

개인 일정·타임박싱·투두와 팀 프로젝트(칸반, 채팅, 인박스 등)를 한 앱에서 다루는 웹 앱입니다.

## 문서

| 문서 | 설명 |
|------|------|
| [PRD.md](./PRD.md) | 제품 요구사항, 데이터 모델, 기술 스택 |
| [CHANGELOG.md](./CHANGELOG.md) | 구현 현황, 변경 이력, 환경 설정, 백로그 |
| [docs/NEXT-SESSION.md](./docs/NEXT-SESSION.md) | **다음 작업 세션**용 맥락·파일 위치·제안 과제 |
| [docs/PRD-personal-schedule-project-bridge.md](./docs/PRD-personal-schedule-project-bridge.md) | 개인 일정 ↔ 프로젝트 연동 기획 |
| [docs/PRD-team-collaboration.md](./docs/PRD-team-collaboration.md) | 팀 협업 PRD |
| [docs/PRD-team-groups.md](./docs/PRD-team-groups.md) | 팀 그룹·접근 제어 PRD |

## 개발

```bash
pnpm install
pnpm dev          # 클라이언트 + 서버
pnpm build
pnpm start
```

모노레포 패키지: `@timebox/client`, `@timebox/server`, `@timebox/shared`.

## 저장소

- GitHub: [JONGMIN-PARK/timebox](https://github.com/JONGMIN-PARK/timebox)
