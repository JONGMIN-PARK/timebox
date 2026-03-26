import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import TodoList from "@/components/todo/TodoList";
import CalendarView from "@/components/calendar/CalendarView";
import DDayWidget from "@/components/dday/DDayWidget";
import TimeBoxView from "@/components/timebox/TimeBoxView";
import SettingsPage from "@/pages/SettingsPage";
import ElonScheduler from "@/components/scheduler/ElonScheduler";
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
            <p>File Vault (Coming Soon)</p>
          </div>
        );
      default:
        return <CalendarView />;
    }
  };

  const showRightPanel = activeTab !== "settings" && activeTab !== "scheduler";

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onAddClick={() => {}} />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-hidden">
            {renderMainContent()}
          </main>

          {showRightPanel && (
            <aside className="hidden lg:flex flex-col w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
              {activeTab !== "todo" && (
                <div className="flex-1 border-b border-slate-200 dark:border-slate-700">
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
