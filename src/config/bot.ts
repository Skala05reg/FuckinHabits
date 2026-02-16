import { APP_CONFIG } from "@/config/app";

export const BOT_CONFIG = {
  messageKinds: {
    taskList: "task_list",
  },
  callbacks: {
    toggleEventPrefix: "toggle_event:",
    showTasksToday: "show_tasks_today",
  },
  labels: {
    openTracker: "Открыть трекер",
    showTodayTasks: "📋 Показать задачи на сегодня",
    tasksEmpty: "📅 На сегодня задач нет! Отдыхай.",
    tasksHeading: "📋 *Задачи на день*",
    tasksHint: "Нажимай на кнопки ниже, чтобы отмечать выполнение.",
    tasksDatePrefix: "Дата:",
  },
  quickTaskQueryKeywords: [
    "покажи задачи",
    "покажи дела",
    "что на сегодня",
    "что сегодня",
    "задачи на сегодня",
    "план на сегодня",
    "список задач",
    "мой план",
    "today tasks",
    "tasks today",
    "show tasks",
    "todo",
  ],
  maxTrackedTaskListMessages: APP_CONFIG.maxTrackedTaskListMessages,
} as const;

export function isLikelyTaskListQuery(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return BOT_CONFIG.quickTaskQueryKeywords.some((keyword) => normalized.includes(keyword));
}
