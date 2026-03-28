import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Calendar,
  CheckSquare,
  Timer,
  MessageCircle,
  LayoutDashboard,
  Bot,
  Check,
  X,
  Minus,
  ChevronDown,
  ArrowRight,
  Zap,
  Shield,
  Users,
  Github,
} from "lucide-react";
import { APP_VERSION } from "@/lib/version";

/* ─────────────────────────── data ─────────────────────────── */

const features = [
  {
    icon: Calendar,
    title: "스마트 캘린더",
    desc: "월/주/일 뷰, D-Day, 반복 일정",
    color: "from-blue-500 to-cyan-400",
    shadow: "shadow-blue-500/20",
  },
  {
    icon: CheckSquare,
    title: "할일 관리",
    desc: "카테고리, 우선순위, 드래그 정렬",
    color: "from-emerald-500 to-green-400",
    shadow: "shadow-emerald-500/20",
  },
  {
    icon: Timer,
    title: "타임박스 스케줄러",
    desc: "5분 단위 시간 블록, Elon Musk 방식",
    color: "from-violet-500 to-purple-400",
    shadow: "shadow-violet-500/20",
  },
  {
    icon: MessageCircle,
    title: "실시간 채팅",
    desc: "그룹 채팅, 1:1, 이모지, 이미지",
    color: "from-pink-500 to-rose-400",
    shadow: "shadow-pink-500/20",
  },
  {
    icon: LayoutDashboard,
    title: "칸반 보드",
    desc: "프로젝트 태스크 관리, 간트 차트",
    color: "from-amber-500 to-orange-400",
    shadow: "shadow-amber-500/20",
  },
  {
    icon: Bot,
    title: "텔레그램 연동",
    desc: "QR 스캔 한 번으로 알림 설정",
    color: "from-sky-500 to-blue-400",
    shadow: "shadow-sky-500/20",
  },
];

type CellValue = "check" | "x" | "partial" | string;

const comparisonRows: { feature: string; timebox: CellValue; notion: CellValue; todoist: CellValue; slack: CellValue }[] = [
  { feature: "캘린더 + 타임박싱",   timebox: "check",   notion: "partial", todoist: "partial", slack: "x" },
  { feature: "할일 + 우선순위",     timebox: "check",   notion: "check",   todoist: "check",   slack: "x" },
  { feature: "칸반 보드",           timebox: "check",   notion: "check",   todoist: "partial", slack: "x" },
  { feature: "실시간 채팅",         timebox: "check",   notion: "x",       todoist: "x",       slack: "check" },
  { feature: "텔레그램 알림",       timebox: "check",   notion: "x",       todoist: "x",       slack: "partial" },
  { feature: "간트 차트",           timebox: "check",   notion: "partial", todoist: "x",       slack: "x" },
  { feature: "완전 무료 (개인)",    timebox: "check",   notion: "check",   todoist: "partial", slack: "partial" },
  { feature: "셀프 호스팅",         timebox: "check",   notion: "x",       todoist: "x",       slack: "x" },
];

const freeTierFeatures = [
  "캘린더 & 타임박싱",
  "할일 관리 무제한",
  "개인 프로젝트 3개",
  "실시간 채팅",
  "텔레그램 연동",
];

const teamTierFeatures = [
  "무료 플랜의 모든 기능",
  "무제한 프로젝트",
  "팀 협업 & 권한 관리",
  "간트 차트 & 리포트",
  "우선 지원",
  "관리자 대시보드",
];

/* ─────────────── helpers ─────────────── */

function CellIcon({ value }: { value: CellValue }) {
  if (value === "check") return <Check className="w-5 h-5 text-emerald-400" />;
  if (value === "x") return <X className="w-4 h-4 text-slate-600" />;
  if (value === "partial") return <Minus className="w-4 h-4 text-amber-400" />;
  return <span className="text-sm text-slate-400">{value}</span>;
}

/* ═══════════════════════════ Component ═══════════════════════════ */

export default function LandingPage() {
  const featuresRef = useRef<HTMLDivElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden scroll-smooth">
      {/* ───────── Sticky Nav ───────── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">TimeBox</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-slate-400">
            <button onClick={scrollToFeatures} className="hover:text-white transition-colors">Features</button>
            <a href="#comparison" className="hover:text-white transition-colors">Compare</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <Link
            to="/login"
            className="h-9 px-5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-all flex items-center gap-1.5"
          >
            로그인 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative pt-32 pb-24 sm:pt-44 sm:pb-36 overflow-hidden">
        {/* bg blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-30%] left-[-15%] w-[70%] h-[70%] rounded-full bg-blue-600/15 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-violet-600/10 blur-[140px]" />
          <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyan-500/8 blur-[100px]" />
        </div>

        {/* grid lines (decorative) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            생산성을 극대화하는 올인원 플랫폼
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-4">
            <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
              당신의 시간을
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              디자인하세요
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto mb-4 leading-relaxed">
            개인 생산성부터 팀 협업까지, 하나의 앱에서.
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-10">
            Design Your Time &mdash; from personal productivity to team collaboration, all in one place.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="group h-12 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 hover:shadow-blue-500/35 transition-all duration-300 flex items-center gap-2 active:scale-[0.97]"
            >
              시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={scrollToFeatures}
              className="h-12 px-8 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-sm font-medium transition-all duration-300 flex items-center gap-2"
            >
              기능 둘러보기
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* floating feature icons */}
          <div className="mt-20 relative max-w-3xl mx-auto">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-300"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg ${f.shadow} group-hover:scale-110 transition-transform`}
                  >
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section ref={featuresRef} id="features" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-400 tracking-widest uppercase mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">필요한 모든 것, 한 곳에서</h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto">
              여러 앱을 오가지 마세요. TimeBox 하나면 충분합니다.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 transition-all duration-300 hover:bg-slate-800/40"
              >
                {/* subtle glow on hover */}
                <div
                  className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 pointer-events-none`}
                />
                <div className="relative">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg ${f.shadow} mb-4`}
                  >
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ COMPARISON ═══════════════════ */}
      <section id="comparison" className="py-24 sm:py-32 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-400 tracking-widest uppercase mb-3">Compare</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">왜 TimeBox인가?</h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto">
              여러 도구에 흩어진 기능을 하나로 통합했습니다.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 font-medium text-slate-400">기능</th>
                  <th className="p-4 font-semibold text-blue-400 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4" /> TimeBox
                    </div>
                  </th>
                  <th className="p-4 font-medium text-slate-400 text-center">Notion</th>
                  <th className="p-4 font-medium text-slate-400 text-center">Todoist</th>
                  <th className="p-4 font-medium text-slate-400 text-center">Slack</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}
                  >
                    <td className="p-4 text-slate-300 font-medium whitespace-nowrap">{row.feature}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <CellIcon value={row.timebox} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <CellIcon value={row.notion} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <CellIcon value={row.todoist} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <CellIcon value={row.slack} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-4 text-center">
            <Check className="w-3 h-3 text-emerald-500 inline mr-1" />
            = 완전 지원 &nbsp;&nbsp;
            <Minus className="w-3 h-3 text-amber-400 inline mr-1" />
            = 제한적 지원 &nbsp;&nbsp;
            <X className="w-3 h-3 text-slate-600 inline mr-1" />
            = 미지원
          </p>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-400 tracking-widest uppercase mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">심플한 가격 정책</h2>
            <p className="text-slate-400 mt-3">개인 사용은 완전 무료. 팀도 합리적인 가격에.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-1">
                <Shield className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-semibold">Free</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">개인 사용 무료</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-slate-500 text-sm ml-1">/ 영구 무료</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {freeTierFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="h-11 rounded-xl border border-slate-700 hover:border-slate-500 text-sm font-medium transition-all flex items-center justify-center gap-1.5 hover:text-white text-slate-300"
              >
                무료로 시작하기
              </Link>
            </div>

            {/* Team */}
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-950/30 to-slate-900/50 p-8 flex flex-col relative">
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 rounded-full bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/25">
                  추천
                </span>
              </div>
              <div className="flex items-center gap-3 mb-1">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Team</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">팀 협업에 최적화</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$5</span>
                <span className="text-slate-500 text-sm ml-1">/ user / 월</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {teamTierFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm font-semibold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-[0.97]"
              >
                지금 바로 시작하세요 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA BANNER ═══════════════════ */}
      <section className="py-20 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-3xl bg-gradient-to-r from-blue-600/20 via-violet-600/15 to-blue-600/20 border border-blue-500/15 p-12 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 pointer-events-none" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">시간 관리, 지금 시작하세요</h2>
              <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-md mx-auto">
                가입은 30초, 셋업은 필요 없습니다.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-all shadow-xl shadow-white/10 active:scale-[0.97]"
              >
                무료로 시작하기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-slate-800/60 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Clock className="w-3 h-3 text-white" />
            </div>
            <span>TimeBox v{APP_VERSION}</span>
            <span className="text-slate-700">|</span>
            <span>&copy; {new Date().getFullYear()} TimeBox</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
