import {
  Rocket,
  Calendar,
  Clock,
  CheckSquare,
  CalendarClock,
  MessageCircle,
  FolderKanban,
  FileArchive,
  Inbox,
  Bell,
  Timer,
  Settings,
  Keyboard,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ManualSection {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  content: JSX.Element;
}

export const manualSections: ManualSection[] = [
  {
    id: "getting-started",
    titleKey: "manual.gettingStarted",
    icon: Rocket,
    content: (
      <>
        <h3>TimeBox 시작하기</h3>
        <p>
          TimeBox는 일정, 할 일, 타임박스, 프로젝트 관리를 하나의 앱에서 처리할 수 있는 올인원 생산성 도구입니다.
        </p>
        <h3>회원가입 및 로그인</h3>
        <ol>
          <li>앱에 접속하면 로그인 화면이 표시됩니다.</li>
          <li><strong>회원가입</strong> 버튼을 클릭하여 이메일과 비밀번호로 계정을 생성합니다.</li>
          <li>로그인 후 대시보드로 이동합니다.</li>
        </ol>
        <h3>대시보드 구성</h3>
        <p>
          대시보드에는 오늘의 일정, 할 일, 타임박스, D-Day 위젯이 표시됩니다.
          좌측 사이드바를 통해 각 기능 페이지로 빠르게 이동할 수 있습니다.
        </p>
        <ul>
          <li><strong>사이드바</strong>: 캘린더, 할 일, 타임박스, 채팅, 프로젝트 등 주요 기능에 빠르게 접근</li>
          <li><strong>모바일</strong>: 하단 네비게이션 바를 통해 주요 기능으로 이동</li>
          <li><strong>검색</strong>: <kbd>Ctrl</kbd>+<kbd>K</kbd> 또는 상단 검색 아이콘으로 전체 검색</li>
        </ul>
      </>
    ),
  },
  {
    id: "calendar",
    titleKey: "manual.calendar",
    icon: Calendar,
    content: (
      <>
        <h3>캘린더 기능</h3>
        <p>
          월간, 주간, 일간 뷰를 제공하며, 일정을 시각적으로 관리할 수 있습니다.
        </p>
        <h3>일정 추가</h3>
        <ol>
          <li>원하는 날짜를 클릭하면 일정 추가 모달이 열립니다.</li>
          <li>제목, 시간, 카테고리를 설정합니다.</li>
          <li>반복 설정(매일/매주/매월)을 선택할 수 있습니다.</li>
          <li><strong>추가</strong> 버튼을 클릭하여 저장합니다.</li>
        </ol>
        <h3>일정 수정 및 삭제</h3>
        <ul>
          <li>날짜를 선택하면 하단에 해당 날짜의 일정과 할 일 목록이 표시됩니다.</li>
          <li>각 항목의 <strong>연필 아이콘</strong>으로 수정, <strong>휴지통 아이콘</strong>으로 삭제합니다.</li>
        </ul>
        <h3>카테고리</h3>
        <p>
          카테고리를 생성하여 일정을 색상별로 분류할 수 있습니다. 설정 페이지에서 카테고리를 관리하세요.
        </p>
        <h3>뷰 전환</h3>
        <ul>
          <li><strong>월간 뷰</strong>: 한 달의 일정을 한눈에 확인</li>
          <li><strong>주간 뷰</strong>: 일주일 단위로 시간대별 일정 확인</li>
          <li><strong>일간 뷰</strong>: 하루의 세부 시간표 확인</li>
        </ul>
      </>
    ),
  },
  {
    id: "timebox",
    titleKey: "manual.timebox",
    icon: Clock,
    content: (
      <>
        <h3>타임박스란?</h3>
        <p>
          타임박스는 특정 시간 블록을 할당하여 집중적으로 작업하는 시간 관리 기법입니다.
          포모도로 기법과 유사하지만, 자유롭게 시간을 설정할 수 있습니다.
        </p>
        <h3>타임박스 사용법</h3>
        <ol>
          <li>타임박스 페이지에서 <strong>새 타임박스 추가</strong>를 클릭합니다.</li>
          <li>작업 제목과 시간(분)을 설정합니다.</li>
          <li><strong>시작</strong> 버튼을 눌러 타이머를 시작합니다.</li>
          <li>타이머가 완료되면 알림이 표시됩니다.</li>
        </ol>
        <h3>타임박스 팁</h3>
        <ul>
          <li>25분 작업 + 5분 휴식의 포모도로 방식을 추천합니다.</li>
          <li>완료된 타임박스는 기록에 자동 저장됩니다.</li>
          <li>타임박스를 할 일이나 캘린더 일정과 연결하여 관리할 수 있습니다.</li>
        </ul>
      </>
    ),
  },
  {
    id: "todos",
    titleKey: "manual.todos",
    icon: CheckSquare,
    content: (
      <>
        <h3>할 일 관리</h3>
        <p>
          할 일 목록을 통해 해야 할 작업을 체계적으로 관리할 수 있습니다.
        </p>
        <h3>할 일 추가</h3>
        <ol>
          <li>할 일 페이지에서 입력란에 할 일 제목을 입력합니다.</li>
          <li>카테고리, 우선순위, 마감일을 설정할 수 있습니다.</li>
          <li><kbd>Enter</kbd> 키 또는 추가 버튼으로 저장합니다.</li>
        </ol>
        <h3>할 일 관리</h3>
        <ul>
          <li><strong>체크박스</strong>: 클릭하여 완료/미완료 전환</li>
          <li><strong>드래그 앤 드롭</strong>: 할 일 순서 변경</li>
          <li><strong>수정</strong>: 항목 클릭 후 내용 편집</li>
          <li><strong>삭제</strong>: 휴지통 아이콘 클릭</li>
        </ul>
        <h3>필터 및 정렬</h3>
        <p>
          카테고리, 우선순위, 완료 상태별로 필터링하고 정렬할 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: "scheduler",
    titleKey: "manual.scheduler",
    icon: CalendarClock,
    content: (
      <>
        <h3>스케줄러</h3>
        <p>
          스케줄러는 일간 시간표를 시각적으로 관리할 수 있는 기능입니다.
          드래그로 시간 블록을 배치하고 조정할 수 있습니다.
        </p>
        <h3>사용법</h3>
        <ol>
          <li>시간대를 클릭하거나 드래그하여 새 블록을 생성합니다.</li>
          <li>블록의 상하 경계를 드래그하여 시간을 조정합니다.</li>
          <li>블록을 클릭하여 제목과 세부 사항을 편집합니다.</li>
        </ol>
        <ul>
          <li>캘린더 일정과 자동 연동됩니다.</li>
          <li>현재 시간 표시줄로 진행 상황을 쉽게 확인할 수 있습니다.</li>
        </ul>
      </>
    ),
  },
  {
    id: "chat",
    titleKey: "manual.chat",
    icon: MessageCircle,
    content: (
      <>
        <h3>채팅 기능</h3>
        <p>
          채팅 기능을 통해 AI 어시스턴트와 대화하거나, 프로젝트 팀원들과 소통할 수 있습니다.
        </p>
        <h3>일반 채팅</h3>
        <ul>
          <li>새 채팅방을 생성하여 AI와 대화합니다.</li>
          <li>이전 채팅 기록은 자동으로 저장됩니다.</li>
        </ul>
        <h3>프로젝트 채팅</h3>
        <ul>
          <li>프로젝트에 속한 팀원들과 실시간 메시지를 주고받습니다.</li>
          <li>프로젝트 페이지 내 채팅 탭에서 접근할 수 있습니다.</li>
        </ul>
        <h3>플로팅 채팅 버튼</h3>
        <p>
          화면 하단의 플로팅 버튼을 통해 어디서든 빠르게 채팅에 접근할 수 있습니다.
          버튼을 드래그하여 원하는 위치로 이동할 수도 있습니다.
        </p>
      </>
    ),
  },
  {
    id: "projects",
    titleKey: "manual.projects",
    icon: FolderKanban,
    content: (
      <>
        <h3>프로젝트 관리</h3>
        <p>
          프로젝트 기능은 팀 단위의 작업을 관리할 수 있는 강력한 도구입니다.
        </p>
        <h3>프로젝트 생성</h3>
        <ol>
          <li>프로젝트 페이지에서 <strong>새 프로젝트</strong>를 클릭합니다.</li>
          <li>프로젝트 이름과 설명을 입력합니다.</li>
          <li>팀원을 초대합니다.</li>
        </ol>
        <h3>태스크 관리</h3>
        <ul>
          <li><strong>칸반 보드</strong>: Backlog, To Do, In Progress, Review, Done으로 태스크 상태 관리</li>
          <li><strong>태스크 상세</strong>: 제목, 설명, 상태, 우선순위, 담당자, 날짜 설정</li>
          <li><strong>작업 로그</strong>: 각 태스크에 작업 진행 사항 기록</li>
          <li><strong>리액션</strong>: 태스크에 이모지 반응 추가</li>
          <li><strong>인수인계</strong>: 다른 팀원에게 태스크 전달 요청</li>
        </ul>
        <h3>팀원 관리</h3>
        <p>
          프로젝트 설정에서 팀원을 추가/제거하고 역할(관리자, 멤버)을 지정할 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: "files",
    titleKey: "manual.files",
    icon: FileArchive,
    content: (
      <>
        <h3>파일 자료실</h3>
        <p>
          파일 자료실은 문서, 이미지, 파일 등을 안전하게 보관하고 관리할 수 있는 공간입니다.
        </p>
        <h3>파일 업로드</h3>
        <ol>
          <li>파일 자료실 페이지에서 <strong>업로드</strong> 버튼을 클릭합니다.</li>
          <li>파일을 선택하거나 드래그 앤 드롭으로 업로드합니다.</li>
          <li>폴더를 생성하여 파일을 체계적으로 정리할 수 있습니다.</li>
        </ol>
        <h3>파일 관리</h3>
        <ul>
          <li>파일 미리보기, 다운로드, 삭제 가능</li>
          <li>검색 기능으로 빠르게 파일 찾기</li>
          <li>프로젝트별 파일 분류 지원</li>
        </ul>
      </>
    ),
  },
  {
    id: "inbox",
    titleKey: "manual.inbox",
    icon: Inbox,
    content: (
      <>
        <h3>인박스</h3>
        <p>
          인박스는 알림, 인수인계 요청, 프로젝트 초대 등 중요한 메시지를 모아서 보여주는 공간입니다.
        </p>
        <h3>알림 유형</h3>
        <ul>
          <li><strong>인수인계 요청</strong>: 다른 팀원이 태스크를 전달할 때 알림 수신</li>
          <li><strong>프로젝트 초대</strong>: 새 프로젝트에 초대될 때 알림 수신</li>
          <li><strong>태스크 업데이트</strong>: 담당 태스크의 상태 변경 알림</li>
        </ul>
        <p>
          각 알림을 클릭하면 해당 항목으로 바로 이동할 수 있습니다.
          읽은 알림과 읽지 않은 알림이 구분되어 표시됩니다.
        </p>
      </>
    ),
  },
  {
    id: "reminders",
    titleKey: "manual.reminders",
    icon: Bell,
    content: (
      <>
        <h3>리마인더</h3>
        <p>
          리마인더를 설정하여 중요한 일정이나 할 일을 잊지 않도록 알림을 받으세요.
        </p>
        <h3>리마인더 설정</h3>
        <ol>
          <li>캘린더에서 날짜를 선택한 후 <strong>리마인더 추가</strong>를 클릭합니다.</li>
          <li>리마인더 제목을 입력합니다.</li>
          <li>설정한 시간에 알림이 표시됩니다.</li>
        </ol>
        <ul>
          <li>대시보드에서 오늘의 리마인더를 확인할 수 있습니다.</li>
          <li>완료된 리마인더는 체크하여 정리할 수 있습니다.</li>
        </ul>
      </>
    ),
  },
  {
    id: "dday",
    titleKey: "manual.dday",
    icon: Timer,
    content: (
      <>
        <h3>D-Day 카운터</h3>
        <p>
          중요한 날짜까지 남은 일수를 카운트다운하여 표시합니다.
        </p>
        <h3>D-Day 추가</h3>
        <ol>
          <li>대시보드의 D-Day 위젯에서 <strong>추가</strong>를 클릭합니다.</li>
          <li>이벤트 이름과 날짜를 설정합니다.</li>
          <li>D-Day가 대시보드에 표시됩니다.</li>
        </ol>
        <ul>
          <li>지난 D-Day도 경과 일수로 표시됩니다.</li>
          <li>여러 개의 D-Day를 동시에 관리할 수 있습니다.</li>
        </ul>
      </>
    ),
  },
  {
    id: "settings",
    titleKey: "manual.settings",
    icon: Settings,
    content: (
      <>
        <h3>설정</h3>
        <p>
          설정 페이지에서 앱의 다양한 옵션을 변경할 수 있습니다.
        </p>
        <h3>설정 항목</h3>
        <ul>
          <li><strong>프로필</strong>: 이름, 프로필 사진 변경</li>
          <li><strong>테마</strong>: 라이트/다크 모드 전환</li>
          <li><strong>언어</strong>: 한국어/영어 전환</li>
          <li><strong>카테고리 관리</strong>: 일정 카테고리 추가, 수정, 삭제</li>
          <li><strong>데이터 관리</strong>: 내보내기, 가져오기, 초기화</li>
        </ul>
        <h3>테마</h3>
        <p>
          시스템 설정을 따르거나, 수동으로 라이트/다크 모드를 선택할 수 있습니다.
          다크 모드는 어두운 환경에서 눈의 피로를 줄여줍니다.
        </p>
      </>
    ),
  },
  {
    id: "shortcuts",
    titleKey: "manual.shortcuts",
    icon: Keyboard,
    content: (
      <>
        <h3>키보드 단축키</h3>
        <p>
          키보드 단축키를 사용하면 더 빠르게 앱을 사용할 수 있습니다.
        </p>
        <h3>전역 단축키</h3>
        <ul>
          <li><kbd>Ctrl</kbd>+<kbd>K</kbd> — 전체 검색 열기</li>
          <li><kbd>Ctrl</kbd>+<kbd>B</kbd> — 사이드바 토글</li>
          <li><kbd>Esc</kbd> — 모달/팝업 닫기</li>
        </ul>
        <h3>캘린더 단축키</h3>
        <ul>
          <li><kbd>←</kbd> <kbd>→</kbd> — 이전/다음 달 이동</li>
          <li><kbd>T</kbd> — 오늘로 이동</li>
        </ul>
        <h3>에디터 단축키</h3>
        <ul>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> — 저장/전송</li>
          <li><kbd>Esc</kbd> — 편집 취소</li>
        </ul>
      </>
    ),
  },
  {
    id: "faq",
    titleKey: "manual.faq",
    icon: HelpCircle,
    content: (
      <>
        <h3>자주 묻는 질문</h3>

        <h3>Q: 모바일에서도 사용할 수 있나요?</h3>
        <p>
          네, TimeBox는 반응형 디자인으로 모바일 브라우저에서도 최적화되어 있습니다.
          PWA(Progressive Web App)로 홈 화면에 추가하면 네이티브 앱처럼 사용할 수 있습니다.
        </p>

        <h3>Q: 데이터는 어디에 저장되나요?</h3>
        <p>
          모든 데이터는 서버에 안전하게 저장됩니다. 로그인하면 어느 기기에서든 데이터에 접근할 수 있습니다.
        </p>

        <h3>Q: 비밀번호를 잊어버렸어요.</h3>
        <p>
          로그인 화면의 "비밀번호 찾기" 링크를 통해 이메일로 재설정 링크를 받을 수 있습니다.
        </p>

        <h3>Q: 프로젝트에 팀원을 초대하려면?</h3>
        <p>
          프로젝트 설정에서 사용자 이름이나 이메일로 팀원을 검색하여 초대할 수 있습니다.
        </p>

        <h3>Q: 오프라인에서도 사용할 수 있나요?</h3>
        <p>
          현재 오프라인 모드는 지원되지 않습니다. 인터넷 연결이 필요합니다.
        </p>
      </>
    ),
  },
];
