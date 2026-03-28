import { useState, useEffect, lazy, Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import DDayWidget from "@/components/dday/DDayWidget";
import ReminderPanel from "@/components/reminders/ReminderPanel";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

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
import { connectSocket, disconnectSocket } from "@/lib/socket";
import ToastContainer from "@/components/ui/Toast";
import HelpModal from "@/components/HelpModal";
import SearchModal from "@/components/SearchModal";
import ChatRequestPopup from "@/components/chat/ChatRequestPopup";

const ProjectView = lazy(() => import("@/components/project/ProjectView"));
const ProjectSummary = lazy(() => import("@/components/project/ProjectSummary"));
import NewProjectForm from "@/components/project/NewProjectForm";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { fetchMe } = useAuthStore();
  const { activeProjectId } = useProjectStore();
  const user = useAuthStore(s => s.user);
  const hasTeamAccess = user?.role === 'admin' || user?.hasProjectAccess || (user?.teamGroups?.length ?? 0) > 0;

  useEffect(() => {
    fetchMe();
    connectSocket();
    return () => disconnectSocket();
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

  return (
    <div className="h-[100dvh] flex bg-slate-50 dark:bg-slate-900 bg-ambient pb-[48px] md:pb-0 safe-top safe-left safe-right">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onInboxClick={() => {
          useProjectStore.getState().setActiveProject(null);
          setActiveTab("inbox");
        }} />

        <div className="flex-1 flex overflow-hidden">
          {activeProjectId && hasTeamAccess ? (
            <main className="flex-1 overflow-hidden animate-in">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>}>
                <ProjectView projectId={activeProjectId} />
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
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} onNavigate={setActiveTab} />
      <ToastContainer />
    </div>
  );
}
