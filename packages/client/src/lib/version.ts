// Auto-synced from packages/shared/version.json at build time by CI
// Do NOT edit APP_VERSION or APP_BUILD_DATE manually — they are updated by CI/CD
import versionData from "../../../shared/version.json";

export const APP_VERSION: string = versionData.version;
export const APP_BUILD_DATE: string = versionData.date;

export interface VersionEntry {
  version: string;
  date: string;
  highlights: string[];
  changes: { category: string; emoji?: string; items: string[] }[];
}

// Current version from version.json as first entry, then hardcoded history
export const VERSION_HISTORY: VersionEntry[] = [
  versionData as VersionEntry,
  {
    version: "1.1.0",
    date: "2026-03-28",
    highlights: [
      "랜딩 페이지 & 온보딩",
      "PWA 아이콘 뱃지",
      "한국 시간 전체 적용",
    ],
    changes: [
      { category: "신규 기능", items: ["랜딩 페이지 (기능 소개, 비교표, 가격)", "온보딩 가이드 (6단계)", "간트 차트", "파일 버전 관리", "반복 이벤트 UI", "프로젝트 아카이브"] },
      { category: "채팅", items: ["@멘션 하이라이트 + 알림", "읽음 표시 (✓/✓✓)", "메시지 삭제"] },
      { category: "모바일 & UX", items: ["PWA 아이콘 뱃지 (읽지않은 수)", "모바일 레이아웃 안정화", "스플래시 인트로", "알림 설정 UI", "오프라인 표시", "브라우저 푸시 알림"] },
      { category: "기타", items: ["한국 시간 (Asia/Seoul) 전체 적용", "배포 시 텔레그램 상세 알림", "버전 관리 시스템 (version.json)"] },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-28",
    highlights: [
      "실시간 채팅 시스템 (그룹 + 1:1)",
      "관리자 분석 대시보드",
      "성능 대폭 개선",
    ],
    changes: [
      { category: "채팅", items: ["Socket.io 기반 실시간 채팅", "그룹 채팅방 생성/관리", "1:1 채팅 요청/수락", "이모지 피커 (16종)", "이미지 붙여넣기 전송", "메시지 삭제 (소프트 삭제)"] },
      { category: "분석", items: ["사용자 행동 트래킹", "관리자 분석 대시보드 (통계/차트/타임라인)", "메시지 관리 (열람/정리/자동삭제)", "전체 시스템 백업"] },
      { category: "성능", items: ["API 응답 compression (60-70% 압축)", "JWT role 캐시 (관리자 DB 쿼리 제거)", "DB 인덱스 최적화", "할일 목록 useMemo 최적화", "Optimistic UI (즉시 반영)", "Toast 알림 시스템"] },
      { category: "모바일", items: ["모바일 로그아웃 버튼", "리마인더/디데이 모바일 표시", "스케줄러 팀 사용자 접근", "앱 아이콘 (SVG + PNG)"] },
      { category: "텔레그램", items: ["QR코드 연동", "딥링크 자동 연결", "알림 지연 개선 (8초→3초)"] },
      { category: "UX", items: ["스플래시 인트로 화면", "버튼/카드 애니메이션", "할일 메타 정보 한 줄 압축", "인박스 벨 즉시 갱신"] },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-27",
    highlights: ["팀 협업 시스템", "텔레그램 개별 연동", "인박스 메시지함"],
    changes: [
      { category: "협업", items: ["프로젝트 관리 (CRUD, 멤버, 역할)", "칸반 보드 (5단계, 드래그앤드롭)", "게시판 (공지/토론/질문)", "프로젝트 대시보드", "태스크 이관 요청/수락", "프로젝트 문서", "팀 그룹 관리"] },
      { category: "소통", items: ["인박스 메시지함", "태스크 할당 알림", "온라인 상태 표시", "텔레그램 개별 연동"] },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-03-20",
    highlights: ["개인 생산성 도구 MVP", "텔레그램 봇", "PWA 지원"],
    changes: [
      { category: "기능", items: ["캘린더 (월/주/일)", "할일 목록 (카테고리, D-Day)", "타임박스 스케줄러", "Elon Musk 스케줄러", "D-Day 위젯", "리마인더 (반복, 스누즈)", "파일 보관함", "다크모드", "텔레그램 봇 (12+ 명령어)", "데이터 백업/복원", "PWA 지원"] },
    ],
  },
];
