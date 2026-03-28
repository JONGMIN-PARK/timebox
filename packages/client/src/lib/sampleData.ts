import { api } from "@/lib/api";

export async function seedSampleData() {
  const alreadySeeded = localStorage.getItem("timebox_sample_seeded");
  if (alreadySeeded) return;

  // Add sample todos
  await api.post("/todos", {
    title: "TimeBox 시작하기 🎉",
    priority: "high",
    category: "personal",
    dueDate: new Date().toISOString().slice(0, 10),
  });
  await api.post("/todos", {
    title: "캘린더에 일정 추가해보기",
    priority: "medium",
    category: "personal",
  });
  await api.post("/todos", {
    title: "타임박스로 하루 계획 세우기",
    priority: "medium",
    category: "work",
  });

  // Add sample D-Day
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  await api.post("/ddays", {
    title: "첫 주 목표 달성!",
    targetDate: nextWeek.toISOString().slice(0, 10),
    color: "#3b82f6",
  });

  localStorage.setItem("timebox_sample_seeded", "true");
}
