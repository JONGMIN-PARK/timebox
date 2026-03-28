import { useState, useEffect, lazy, Suspense } from "react";
import OnboardingGuide from "@/components/OnboardingGuide";
import { seedSampleData } from "@/lib/sampleData";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import DDayWidget from "@/components/dday/DDayWidget";
import ReminderPanel from "@/components/reminders/ReminderPanel";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import SplashScreen from "@/components/SplashScreen";

const TodoList = lazy(() => import("@/components/todo/TodoList"));
const CalendarView = lazy(() => import("@/components/calendar/CalendarView"));
const TimeBoxView = lazy(() => import("@/components/timebox/TimeBoxView"));
const ElonScheduler = lazy(() => import("@/components/scheduler/ElonScheduler"));
const FileVault = lazy(() => import("@/components/files/FileVault"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const InboxPanel = lazy(() => import("@/components/inbox/InboxPanel"));
const ChatPanel = lazy(() => import("@/components/chat/ChatPanel"));
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import ToastContainer from "@/components/ui/Toast";
import HelpModal from "@/components/HelpModal";
import SearchModal from "@/components/SearchModal";
import VersionModal from "@/components/VersionModal";
import ChatRequestPopup from "@/components/chat/ChatRequestPopup";
import FloatingChat from "@/components/chat/FloatingChat";

const ProjectView = lazy(() => import("@/components/project/ProjectView"));
const ProjectSummary = lazy(() => import("@/components/project/ProjectSummary"));
import NewProjectForm from "@/components/project/NewProjectForm";

// Only show splash on the very first mount of the app session
const splashShownRef = { current: false };

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    if (splashShownRef.current) return false;
    splashShownRef.current = true;
    return true;
  });
  const { fetchMe } = useAuthStore();
  const { activeProjectId } = useProjectStore();
  const user = useAuthStore(s => s.user);
  const hasTeamAccess = user?.role === 'admin' || user?.hasProjectAccess || (user?.teamGroups?.length ?? 0) > 0;

  useEffect(() => {
    fetchMe();
    connectSocket();
    // Check if first-time user
    if (!localStorage.getItem("timebox_onboarding_done")) {
      seedSampleData().then(() => setShowOnboarding(true));
    }
    return () => disconnectSocket();
  }, []);

  // Browser notifications for background events
  useEffect(() => {
    const socket = getSocket();

    const showNotif = (title: string, body: string) => {
      if (document.hidden && Notification.permission === "granted") {
        const prefs = JSON.parse(localStorage.getItem("timebox_notification_prefs") || "{}");
        new Notification(title, { body, icon: "/icon-192.png" });
      }
    };

    const handleInbox = (data: any) => {
      const prefs = JSON.parse(localStorage.getItem("timebox_notification_prefs") || "{}");
      if (prefs.inbox !== false) showNotif("새 메시지", data.fromName ? `${data.fromName}님의 메시지` : "새 메시지가 도착했습니다");
    };

    const handleChat = (data: any) => {
      const prefs = JSON.parse(localStorage.getItem("timebox_notification_prefs") || "{}");
      if (prefs.chat !== false) showNotif("채팅", data.message?.senderName ? `${data.message.senderName}: ${(data.message.content || "").slice(0, 50)}` : "새 채팅 메시지");
    };

    const handleTask = (data: any) => {
      const prefs = JSON.parse(localStorage.getItem("timebox_notification_prefs") || "{}");
      if (prefs.tasks !== false) showNotif("태스크 할당", "새로운 태스크가 할당되었습니다");
    };

    socket.on("inbox:new-message", handleInbox);
    socket.on("chat:message", handleChat);
    socket.on("task:assigned", handleTask);

    return () => {
      socket.off("inbox:new-message", handleInbox);
      socket.off("chat:message", handleChat);
      socket.off("task:assigned", handleTask);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "1": setActiveTab("calendar"); break;
        case "2": setActiveTab("timebox"); break;
        case "3": setActiveTab("todo"); break;
        case "4": setActiveTab("files"); break;
        case "5": setActiveTab("scheduler"); break;
        case "?": setShowHelp(true); break;
        case "/": e.preventDefault(); setShowSearch(true); break;
        case "Escape": setShowHelp(false); setShowSearch(false); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const renderMainContent = () => {
    switch (activeTab) {
      case "calendar":
        return <CalendarView />;
      case "timebox":
        return <TimeBoxView />;
      case "todo":
        return (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="flex-1 min-h-0">
              <TodoList />
            </div>
            <div className="lg:hidden p-4 space-y-4 border-t border-slate-200/60 dark:border-slate-700/40">
              <ReminderPanel />
              <DDayWidget />
            </div>
          </div>
        );
      case "scheduler":
        return <ElonScheduler />;
      case "settings":
        return <SettingsPage />;
      case "files":
        return <FileVault />;
      case "inbox":
        return <InboxPanel />;
      case "chat":
        return <ChatPanel />;
      case "analytics":
        return <AnalyticsDashboard />;
      case "projects":
        return <ProjectSummary />;
      case "project-new":
        return (
          <NewProjectForm
            onCreated={(projectId) => {
              useProjectStore.getState().setActiveProject(projectId);
              setActiveTab("project-dashboard");
            }}
            onCancel={() => setActiveTab("calendar")}
          />
        );
      default:
        return <CalendarView />;
    }
  };

  const showRightPanel = !["settings", "scheduler", "chat", "analytics"].includes(activeTab);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="h-[100dvh] flex bg-slate-50 dark:bg-slate-900 bg-ambient safe-top safe-left safe-right pb-[calc(48px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onInboxClick={() => {
          useProjectStore.getState().setActiveProject(null);
          setActiveTab("inbox");
        }} onVersionClick={() => setShowVersion(true)} />

        <div className="flex-1 flex overflow-hidden">
          {activeProjectId && hasTeamAccess ? (
            <main className="flex-1 overflow-hidden animate-in">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>}>
                <ProjectView projectId={activeProjectId} initialTab={activeTab.startsWith("project-") ? activeTab.replace("project-", "") as any : "dashboard"} />
              </Suspense>
            </main>
          ) : (
            <>
              <main className="flex-1 overflow-hidden animate-in">
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>}>
                  {renderMainContent()}
                </Suspense>
              </main>

              {showRightPanel && (
                <aside className="hidden lg:flex flex-col w-80 border-l border-slate-200/60 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm overflow-y-auto">
                  {activeTab !== "todo" && (
                    <div className="flex-1 border-b border-slate-200/60 dark:border-slate-700/40">
                      <Suspense fallback={<div className="p-4"><LoadingSpinner size="sm" /></div>}>
                        <TodoList />
                      </Suspense>
                    </div>
                  )}
                  <div className="p-4 space-y-4">
                    <ReminderPanel />
                    <DDayWidget />
                  </div>
                </aside>
              )}
            </>
          )}
        </div>
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      <ChatRequestPopup onAccept={() => setActiveTab("chat")} />
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <VersionModal open={showVersion} onClose={() => setShowVersion(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} onNavigate={setActiveTab} />
      <FloatingChat />
      <ToastContainer />
      {showOnboarding && (
        <OnboardingGuide onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem("timebox_onboarding_done", "true");
        }} />
      )}
    </div>
  );
}
