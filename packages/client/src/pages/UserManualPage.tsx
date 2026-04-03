import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Menu,
  X,
  BookOpen,
  ChevronRight,
  ChevronUp,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { manualSections } from "@/lib/manualContent";

export default function UserManualPage() {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState(manualSections[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return manualSections;
    const q = searchQuery.toLowerCase();
    return manualSections.filter(
      (s) =>
        t(s.titleKey).toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [searchQuery, t]);

  const registerSectionRef = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) {
        sectionRefs.current.set(id, el);
      } else {
        sectionRefs.current.delete(id);
      }
    },
    []
  );

  // Track scroll progress and active section via IntersectionObserver
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      setScrollProgress(maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0);
      setShowBackToTop(scrollTop > 400);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aTop = a.boundingClientRect.top;
            const bTop = b.boundingClientRect.top;
            return Math.abs(aTop) - Math.abs(bTop);
          });

        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("data-section-id");
          if (id) setActiveSection(id);
        }
      },
      {
        root: container,
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      }
    );

    // Observe after a short delay to let refs settle
    const timer = setTimeout(() => {
      sectionRefs.current.forEach((el) => observer.observe(el));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [filteredSections]);

  const scrollToSection = useCallback(
    (id: string) => {
      const el = sectionRefs.current.get(id);
      if (el && contentRef.current) {
        const containerTop = contentRef.current.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        const offset = elTop - containerTop + contentRef.current.scrollTop - 24;
        contentRef.current.scrollTo({ top: offset, behavior: "smooth" });
      }
      setActiveSection(id);
      setSidebarOpen(false);
    },
    []
  );

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden pt-1">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white pt-1 dark:border-slate-700 dark:bg-slate-800",
            "transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <a
              href="/app"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("manual.backToApp") || "Back to App"}
            </a>
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("manual.search") || "Search sections..."}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 pb-6">
            <ul className="space-y-0.5">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-medium transition-all duration-200",
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300"
                          : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0 transition-colors",
                          isActive
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                        )}
                      />
                      <span className="truncate">{t(section.titleKey)}</span>
                      <ChevronRight
                        className={cn(
                          "ml-auto h-3.5 w-3.5 flex-shrink-0 transition-all duration-200",
                          isActive
                            ? "text-blue-400 opacity-100"
                            : "opacity-0 group-hover:opacity-60"
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            {filteredSections.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                {t("manual.noResults") || "No sections found."}
              </div>
            )}
          </nav>

          {/* Sidebar footer */}
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              TimeBox v1.0 &middot;{" "}
              {t("manual.lastUpdated") || "Last updated"}: 2026-03
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar for mobile */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {t("manual.title") || "User Manual"}
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto scroll-smooth"
          >
            {/* Hero / gradient header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-6 py-12 sm:px-10 sm:py-16">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cuc3ZnLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48ZyBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjIiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
              <div className="relative mx-auto max-w-3xl text-center">
                <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                  <BookOpen className="h-10 w-10 text-white" />
                </div>
                <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  TimeBox {t("manual.title") || "사용자 매뉴얼"}
                </h1>
                <p className="text-base text-blue-100 sm:text-lg">
                  {t("manual.subtitle") ||
                    "TimeBox의 모든 기능을 자세히 알아보세요."}
                </p>
              </div>
            </div>

            {/* Sections */}
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="space-y-8">
                {filteredSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <section
                      key={section.id}
                      id={section.id}
                      data-section-id={section.id}
                      ref={(el) => registerSectionRef(section.id, el)}
                      className="group scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                    >
                      {/* Section header */}
                      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
                          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          {t(section.titleKey)}
                        </h2>
                      </div>

                      {/* Section content */}
                      <div className="prose prose-slate max-w-none px-6 py-5 dark:prose-invert prose-headings:font-semibold prose-h3:text-base prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-li:leading-relaxed">
                        {section.content}
                      </div>
                    </section>
                  );
                })}
              </div>

              {filteredSections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
                    {t("manual.noResults") || "No sections found."}
                  </p>
                  <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                    {t("manual.tryDifferentSearch") ||
                      "Try a different search term."}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-12 border-t border-slate-200 pb-8 pt-6 text-center dark:border-slate-700">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  &copy; 2026 TimeBox.{" "}
                  {t("manual.allRightsReserved") || "All rights reserved."}
                </p>
              </div>
            </div>
          </div>

          {/* Back to top button */}
          <button
            onClick={scrollToTop}
            className={cn(
              "fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900",
              showBackToTop
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-4 opacity-0"
            )}
            aria-label="Back to top"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        </main>
      </div>
    </div>
  );
}
