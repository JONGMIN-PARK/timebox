import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import TodoList from "@/components/todo/TodoList";
import CalendarView from "@/components/calendar/CalendarView";
import DDayWidget from "@/components/dday/DDayWidget";
import TimeBoxView from "@/components/timebox/TimeBoxView";
import ElonScheduler from "@/components/scheduler/ElonScheduler";
import SettingsPage from "@/pages/SettingsPage";
import { useAuthStore } from "@/stores/authStore";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
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
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-sm font-medium">File Vault</p>
              <p className="text-xs text-slate-400 mt-1">Coming Soon</p>
            </div>
          </div>
        );
      default:
        return <CalendarView />;
    }
  };

  const showRightPanel = !["settings", "scheduler"].includes(activeTab);

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900 pb-[48px] md:pb-0">
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
              <div className="p-4">
                <DDayWidget />
              </div>
            </aside>
          )}
        </div>
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
