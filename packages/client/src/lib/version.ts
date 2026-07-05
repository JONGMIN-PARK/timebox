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

// Manually curated release notes — shown in Settings → 앱 정보 → 업데이트 내역.
// ⚠️ On every version bump, add a new entry at the TOP of this array so the
// change is recorded in the Settings screen. Newest first; keep it in sync with
// the deployed version numbers (CI bumps the minor per deploy).
const HISTORY: VersionEntry[] = [
  {
    version: "1.57.0",
    date: "2026-07-05",
    highlights: ["파일 공유(최대 2GB)", "이모지 피커 개선"],
    changes: [
      { category: "채팅", emoji: "📎", items: [
        "채팅에서 파일 공유 추가 (클립 버튼, 최대 2GB, 방 참여자 다운로드)",
        "이모지 피커 간격/버튼 크기 확대로 선택 편의성 개선",
        "파일 메시지 미리보기(목록·답장)에 📎 표시",
      ] },
    ],
  },
  {
    version: "1.56.0",
    date: "2026-07-05",
    highlights: ["공개/비공개 채팅방", "초대·수락·참여"],
    changes: [
      { category: "채팅", emoji: "🔒", items: [
        "채팅방 생성 시 공개/비공개 선택 (공개=누구나 참여, 비공개=초대 전용)",
        "공개방 둘러보기 & 바로 참여 (나침반 아이콘)",
        "비공개방 초대 → 수락/거절 (받은 초대 목록, 실시간 알림)",
      ] },
    ],
  },
  {
    version: "1.55.0",
    date: "2026-07-05",
    highlights: ["답장·공감·날짜 구분", "카카오톡 스타일 메신저"],
    changes: [
      { category: "채팅 (카카오톡 스타일)", emoji: "💬", items: [
        "메시지 답장(답장 인용) — 원본 미리보기와 함께 전송",
        "메시지 공감(이모지 반응) — 👍❤️😂😮😢👏 실시간 반영",
        "대화 날짜 구분선 (오늘/어제/날짜) 표시",
      ] },
    ],
  },
  {
    version: "1.54.0",
    date: "2026-07-05",
    highlights: ["전체 채팅방", "가입 회원 자동 참여"],
    changes: [
      { category: "채팅", emoji: "🌐", items: [
        "모든 가입 회원이 참여하는 공용 '전체 채팅방' 추가 (목록 상단 고정)",
        "신규 가입/승인 시 자동 참여, 회원 삭제 시 자동 정리",
        "전체 채팅방은 삭제·휴지통 이동 불가 (실수 방지)",
      ] },
    ],
  },
  {
    version: "1.53.0",
    date: "2026-07-05",
    highlights: ["스마트 데일리 브리핑", "텔레그램 아침 알림"],
    changes: [
      { category: "스마트 비서", emoji: "🌅", items: [
        "오늘의 일정·마감 할일·리마인더·다가오는 D-Day를 한 장의 브리핑 카드로 요약",
        "헤더 🌅 버튼으로 언제든 열기 + 하루 한 번 자동 표시",
        "텔레그램 아침 브리핑에 마감 할일·리마인더 추가 (/today 명령·자동 발송 통합)",
      ] },
    ],
  },
  {
    version: "1.52.0",
    date: "2026-07-05",
    highlights: ["채팅방 휴지통", "복원/영구삭제"],
    changes: [
      { category: "채팅", emoji: "🗑️", items: [
        "채팅방 삭제 시 바로 지우지 않고 휴지통으로 이동 (소프트 삭제, 방장만 가능)",
        "휴지통에서 방 복원 또는 영구 삭제 (영구 삭제 시 메시지까지 완전 제거)",
        "방 삭제/복원 시 참여자 목록 실시간 갱신 (Socket.io)",
      ] },
    ],
  },
  {
    version: "1.44.0",
    date: "2026-07-04",
    highlights: ["노트 리마인더", "노트 실시간 공유"],
    changes: [
      { category: "노트 (Google Keep 확장 4단계)", emoji: "🔔", items: [
        "노트에 직접 리마인더 지정 (편집 모달 날짜/시간 선택, 카드 벨 칩)",
        "기한 도래 시 실시간·텔레그램 알림 후 1회 발화",
        "메모 전달 시 수신자에게 Socket.io 실시간 도착 (새로고침 불필요)",
      ] },
    ],
  },
  {
    version: "1.43.0",
    date: "2026-07-04",
    highlights: ["이미지 첨부", "AI 텍스트 추출(OCR)"],
    changes: [
      { category: "노트 (Google Keep 확장 3단계)", emoji: "🖼️", items: [
        "이미지 캡처 유형 추가 (파일 선택으로 이미지 노트 생성)",
        "Gemini 비전 OCR로 이미지 속 텍스트 추출",
        "이미지/손글씨 노트 탭하면 편집 모달 열림",
      ] },
    ],
  },
  {
    version: "1.42.0",
    date: "2026-07-04",
    highlights: ["보기 전환", "드래그 정렬", "체크리스트 강화"],
    changes: [
      { category: "노트 (Google Keep 확장 2단계)", emoji: "🗂️", items: [
        "그리드/리스트 보기 전환",
        "수동 정렬 모드 + 노트 카드 드래그 정렬 (서버 저장)",
        "체크리스트: 완료 항목 숨기기·모두 해제·완료 항목 삭제",
      ] },
    ],
  },
  {
    version: "1.41.0",
    date: "2026-07-04",
    highlights: ["일 타임라인 드래그"],
    changes: [
      { category: "캘린더 (Google Calendar 참고)", emoji: "🗓️", items: [
        "빈 타임라인 드래그로 이벤트 생성 (선택 범위 표시)",
        "이벤트 드래그 이동 + 하단 핸들 리사이즈 (15분 스냅, 서버 반영)",
      ] },
    ],
  },
  {
    version: "1.40.0",
    date: "2026-07-04",
    highlights: ["겹치는 일정 나란히", "상세 팝오버", "아젠다 뷰"],
    changes: [
      { category: "캘린더 (Google Calendar 참고)", emoji: "🗓️", items: [
        "겹치는 일정을 나란히 배치 (컬럼 패킹)",
        "이벤트 클릭 상세 팝오버 (수정/전달/삭제)",
        "아젠다(목록) 뷰 추가 + 월 셀 더보기 정확도 개선",
      ] },
    ],
  },
  {
    version: "1.39.0",
    date: "2026-07-03",
    highlights: ["라벨/태그", "보관(Archive)"],
    changes: [
      { category: "노트 (Google Keep 확장 1단계)", emoji: "🏷️", items: [
        "노트 라벨/태그 + 라벨 필터",
        "노트 보관(Archive) 및 보관함",
        "iOS Safari 음성녹음 대응 (Web Audio WAV)",
      ] },
    ],
  },
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

// Build the changelog shown in Settings / the version modal.
// If the current (CI-generated) version is already curated in HISTORY, show the
// curated list as-is (nicer wording). Otherwise prepend the auto-generated
// entry so a freshly deployed version is never missing from the record.
const current = versionData as VersionEntry;
export const VERSION_HISTORY: VersionEntry[] = HISTORY.some(
  (e) => e.version === current.version,
)
  ? HISTORY
  : [current, ...HISTORY];
