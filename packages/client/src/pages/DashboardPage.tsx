import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import Header from "@/components/layout/Header";
import TodoList from "@/components/todo/TodoList";
import CalendarView from "@/components/calendar/CalendarView";
import DDayWidget from "@/components/dday/DDayWidget";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("calendar");

  const renderMainContent = () => {
    switch (activeTab) {
      case "calendar":
        return <CalendarView />;
      case "timebox":
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>타임박스 (Phase 2에서 구현)</p>
          </div>
        );
      case "todo":
        return <TodoList />;
      case "files":
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>파일 보관소 (Phase 3에서 구현)</p>
          </div>
        );
      default:
        return <CalendarView />;
    }
  };

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* Sidebar - desktop */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onAddClick={() => {}} />

        <div className="flex-1 flex overflow-hidden">
          {/* Center content */}
          <main className="flex-1 overflow-hidden">
            {renderMainContent()}
          </main>

          {/* Right panel - desktop only */}
          <aside className="hidden lg:flex flex-col w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            {/* Todo list in right panel when calendar is active */}
            {activeTab !== "todo" && (
              <div className="flex-1 border-b border-slate-200 dark:border-slate-700">
                <TodoList />
              </div>
            )}
            {/* D-Day widget */}
            <div className="p-4">
              <DDayWidget />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
