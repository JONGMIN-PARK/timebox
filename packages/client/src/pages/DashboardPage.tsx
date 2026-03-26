import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import TodoList from "@/components/todo/TodoList";
import CalendarView from "@/components/calendar/CalendarView";
import DDayWidget from "@/components/dday/DDayWidget";
import ReminderPanel from "@/components/reminders/ReminderPanel";
import TimeBoxView from "@/components/timebox/TimeBoxView";
import ElonScheduler from "@/components/scheduler/ElonScheduler";
import FileVault from "@/components/files/FileVault";
import SettingsPage from "@/pages/SettingsPage";
import { useAuthStore } from "@/stores/authStore";
import HelpModal from "@/components/HelpModal";
import SearchModal from "@/components/SearchModal";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
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
        return <TodoList />;
      case "scheduler":
        return <ElonScheduler />;
      case "settings":
        return <SettingsPage />;
      case "files":
        return <FileVault />;
      default:
        return <CalendarView />;
    }
  };

  const showRightPanel = !["settings", "scheduler"].includes(activeTab);

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900 bg-ambient pb-[48px] md:pb-0">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onAddClick={() => {}} />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-hidden animate-in">
            {renderMainContent()}
          </main>

          {showRightPanel && (
            <aside className="hidden lg:flex flex-col w-80 border-l border-slate-200/60 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm overflow-y-auto">
              {activeTab !== "todo" && (
                <div className="flex-1 border-b border-slate-200/60 dark:border-slate-700/40">
                  <TodoList />
                </div>
              )}
              <div className="p-4 space-y-4">
                <ReminderPanel />
                <DDayWidget />
              </div>
            </aside>
          )}
        </div>
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} onNavigate={setActiveTab} />
    </div>
  );
}
