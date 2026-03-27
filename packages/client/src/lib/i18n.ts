type Locale = "en" | "ko";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendar",
    "nav.todos": "Todos",
    "nav.timebox": "TimeBox",
    "nav.files": "Files",
    "nav.scheduler": "Scheduler",
    "nav.settings": "Settings",

    // Common
    "common.add": "Add",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.noData": "No data",
    "common.today": "Today",
    "common.confirm": "Confirm",

    // Auth
    "auth.login": "Login",
    "auth.logout": "Logout",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.signIn": "Sign In",
    "auth.signingIn": "Signing in...",
    "auth.requestAccount": "Request Account",
    "auth.signInToContinue": "Sign in to continue",
    "auth.requestAnAccount": "Request an account",
    "auth.requestSubmitted": "Request submitted!",
    "auth.displayName": "Display Name",
    "auth.messageToAdmin": "Message to Admin",
    "auth.optional": "optional",
    "auth.enterUsername": "Enter username",
    "auth.enterPassword": "Enter password",
    "auth.chooseUsername": "Choose a username",
    "auth.choosePassword": "Choose a password",
    "auth.yourName": "Your name",
    "auth.whyAccess": "Why you'd like access...",
    "auth.submitting": "Submitting...",
    "auth.submitRequest": "Submit Request",
    "auth.noAccount": "Don't have an account?",
    "auth.requestAccess": "Request Access",
    "auth.backToSignIn": "Back to Sign In",
    "auth.requestSubmittedMsg": "Your request has been submitted.",
    "auth.requestReviewMsg": "An admin will review your request. Once approved, you can sign in with your credentials.",
    "auth.signOut": "Sign Out",

    // Todos
    "todo.title": "Todo List",
    "todo.addPlaceholder": "Add a task...",
    "todo.noTodos": "No todos yet",
    "todo.addFirstTask": "Add your first task",
    "todo.completed": "Completed",
    "todo.active": "Active",
    "todo.all": "All",
    "todo.done": "Done",
    "todo.setDate": "Set date",
    "todo.close": "Close",
    "todo.priority.high": "High",
    "todo.priority.medium": "Medium",
    "todo.priority.low": "Low",

    // Calendar
    "calendar.addEvent": "Add Event",
    "calendar.noEvents": "No events",
    "calendar.eventTitle": "Event title",
    "calendar.start": "Start",
    "calendar.end": "End",
    "calendar.month": "M",
    "calendar.week": "W",
    "calendar.day": "D",
    "calendar.category": "Category",

    // D-Day
    "dday.title": "D-Day",
    "dday.addNew": "Add D-Day",
    "dday.targetDate": "Target Date",
    "dday.dDay": "D-Day!",
    "dday.eventName": "Event name",
    "dday.addFirst": "Add your first D-Day",

    // TimeBox
    "timebox.title": "Time Blocks",
    "timebox.addBlock": "Add Time Block",
    "timebox.noBlocks": "No time blocks",
    "timebox.addTimeBlocks": "Add time blocks",
    "timebox.blockTitle": "Block title",

    // Reminders
    "reminder.title": "Reminders",
    "reminder.addNew": "Add Reminder",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.darkMode": "Dark Mode",
    "settings.backup": "Backup & Restore",
    "settings.export": "Export Data",
    "settings.import": "Import Data",
    "settings.profile": "Profile",
    "settings.appearance": "Appearance",
    "settings.data": "Data",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.system": "System",
    "settings.exporting": "Exporting...",
    "settings.importing": "Importing...",
    "settings.dataNote": "Export downloads all your data as JSON. Import can merge with or replace existing data.",
    "settings.userManagement": "User Management",
    "settings.addUser": "Add User",
    "settings.accessRequests": "Access Requests",
    "settings.requestHistory": "Request History",
    "settings.approve": "Approve",
    "settings.reject": "Reject",
    "settings.role": "Role",
    "settings.create": "Create",
    "settings.deleteUserConfirm": "Are you sure you want to delete this user?",
    "settings.optional": "Optional",
    "settings.user": "User",
    "settings.admin": "Admin",

    // File Vault
    "files.title": "File Vault",
    "files.upload": "Upload",
    "files.searchPlaceholder": "Search files...",
    "files.dropHere": "Drop files here to upload",
    "files.noFiles": "No files yet",
    "files.dragOrUpload": "Drag & drop or click Upload",
    "files.uploading": "Uploading...",
    "files.deleteConfirm": "Delete this file?",
    "files.all": "All",

    // Scheduler
    "scheduler.brainBox": "Brain Box",
    "scheduler.priority": "Priority",
    "scheduler.timeGrid": "Time Grid",
    "scheduler.dumpPlaceholder": "Dump everything here...",
    "scheduler.place": "Place",
    "scheduler.placing": "Placing:",
    "scheduler.moveToPriority": "Move to Priority",
    "scheduler.brainBoxEmpty": "Dump all your tasks here first",
    "scheduler.priorityEmpty": "Move items from Brain Box...",
    "scheduler.planned": "planned",
    "scheduler.done": "done",

    // Search
    "search.placeholder": "Search todos, events, D-Days...",
    "search.goCalendar": "Go to Calendar",
    "search.goTimebox": "Go to TimeBox",
    "search.goTodos": "Go to Todos",
    "search.noResults": "No results for",

    // Help
    "help.title": "Keyboard Shortcuts & Help",
    "help.shortcuts": "Keyboard Shortcuts",
    "help.telegramTitle": "Telegram Commands",
    "help.tipsTitle": "Tips",

    // Projects
    "project.title": "Projects",
    "project.new": "New Project",
    "project.name": "Project Name",
    "project.description": "Description",
    "project.dashboard": "Dashboard",
    "project.tasks": "Tasks",
    "project.members": "Members",
    "project.invite": "Invite",
    "project.noProjects": "No projects yet",
    "project.backToPersonal": "Personal",

    // Transfers
    "transfer.title": "Task Transfers",
    "transfer.request": "Transfer",
    "transfer.accept": "Accept",
    "transfer.reject": "Reject",
    "transfer.pending": "Pending transfers",
    "transfer.message": "Message (optional)",
    "transfer.from": "From",
    "transfer.sent": "Transfer requested",
    "transfer.accepted": "Transfer accepted",
    "transfer.rejected": "Transfer rejected",
    "transfer.noTransfers": "No pending transfers",
    "transfer.selectMember": "Select member",

    // Common extras
    "common.close": "Close",
    "common.all": "All",
    "common.done": "Done",
    "common.active": "Active",
  },
  ko: {
    // Navigation
    "nav.dashboard": "\ub300\uc2dc\ubcf4\ub4dc",
    "nav.calendar": "\uce98\ub9b0\ub354",
    "nav.todos": "\ud560 \uc77c",
    "nav.timebox": "\ud0c0\uc784\ubc15\uc2a4",
    "nav.files": "\ud30c\uc77c",
    "nav.scheduler": "\uc2a4\ucf00\uc904\ub7ec",
    "nav.settings": "\uc124\uc815",

    // Common
    "common.add": "\ucd94\uac00",
    "common.edit": "\uc218\uc815",
    "common.delete": "\uc0ad\uc81c",
    "common.cancel": "\ucde8\uc18c",
    "common.save": "\uc800\uc7a5",
    "common.search": "\uac80\uc0c9",
    "common.loading": "\ub85c\ub529 \uc911...",
    "common.noData": "\ub370\uc774\ud130 \uc5c6\uc74c",
    "common.today": "\uc624\ub298",
    "common.confirm": "\ud655\uc778",

    // Auth
    "auth.login": "\ub85c\uadf8\uc778",
    "auth.logout": "\ub85c\uadf8\uc544\uc6c3",
    "auth.username": "\uc0ac\uc6a9\uc790\uba85",
    "auth.password": "\ube44\ubc00\ubc88\ud638",
    "auth.signIn": "\ub85c\uadf8\uc778",
    "auth.signingIn": "\ub85c\uadf8\uc778 \uc911...",
    "auth.requestAccount": "\uacc4\uc815 \uc694\uccad",
    "auth.signInToContinue": "\uacc4\uc18d\ud558\ub824\uba74 \ub85c\uadf8\uc778\ud558\uc138\uc694",
    "auth.requestAnAccount": "\uacc4\uc815 \uc694\uccad\ud558\uae30",
    "auth.requestSubmitted": "\uc694\uccad\uc774 \uc81c\ucd9c\ub418\uc5c8\uc2b5\ub2c8\ub2e4!",
    "auth.displayName": "\ud45c\uc2dc \uc774\ub984",
    "auth.messageToAdmin": "\uad00\ub9ac\uc790\uc5d0\uac8c \uba54\uc2dc\uc9c0",
    "auth.optional": "\uc120\ud0dd\uc0ac\ud56d",
    "auth.enterUsername": "\uc0ac\uc6a9\uc790\uba85 \uc785\ub825",
    "auth.enterPassword": "\ube44\ubc00\ubc88\ud638 \uc785\ub825",
    "auth.chooseUsername": "\uc0ac\uc6a9\uc790\uba85 \uc120\ud0dd",
    "auth.choosePassword": "\ube44\ubc00\ubc88\ud638 \uc120\ud0dd",
    "auth.yourName": "\uc774\ub984",
    "auth.whyAccess": "\uc811\uadfc \uc694\uccad \uc0ac\uc720...",
    "auth.submitting": "\uc81c\ucd9c \uc911...",
    "auth.submitRequest": "\uc694\uccad \uc81c\ucd9c",
    "auth.noAccount": "\uacc4\uc815\uc774 \uc5c6\uc73c\uc2e0\uac00\uc694?",
    "auth.requestAccess": "\uc561\uc138\uc2a4 \uc694\uccad",
    "auth.backToSignIn": "\ub85c\uadf8\uc778\uc73c\ub85c \ub3cc\uc544\uac00\uae30",
    "auth.requestSubmittedMsg": "\uc694\uccad\uc774 \uc81c\ucd9c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
    "auth.requestReviewMsg": "\uad00\ub9ac\uc790\uac00 \uc694\uccad\uc744 \uac80\ud1a0\ud569\ub2c8\ub2e4. \uc2b9\uc778\ub418\uba74 \uc790\uaca9 \uc99d\uba85\uc73c\ub85c \ub85c\uadf8\uc778\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
    "auth.signOut": "\ub85c\uadf8\uc544\uc6c3",

    // Todos
    "todo.title": "\ud560 \uc77c \ubaa9\ub85d",
    "todo.addPlaceholder": "\ud560 \uc77c \ucd94\uac00...",
    "todo.noTodos": "\ud560 \uc77c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4",
    "todo.addFirstTask": "\uccab \ubc88\uc9f8 \ud560 \uc77c\uc744 \ucd94\uac00\ud558\uc138\uc694",
    "todo.completed": "\uc644\ub8cc",
    "todo.active": "\uc9c4\ud589 \uc911",
    "todo.all": "\uc804\uccb4",
    "todo.done": "\uc644\ub8cc",
    "todo.setDate": "\ub0a0\uc9dc \uc124\uc815",
    "todo.close": "\ub2eb\uae30",
    "todo.priority.high": "\ub192\uc74c",
    "todo.priority.medium": "\ubcf4\ud1b5",
    "todo.priority.low": "\ub0ae\uc74c",

    // Calendar
    "calendar.addEvent": "\uc77c\uc815 \ucd94\uac00",
    "calendar.noEvents": "\uc77c\uc815 \uc5c6\uc74c",
    "calendar.eventTitle": "\uc77c\uc815 \uc81c\ubaa9",
    "calendar.start": "\uc2dc\uc791",
    "calendar.end": "\uc885\ub8cc",
    "calendar.month": "\uc6d4",
    "calendar.week": "\uc8fc",
    "calendar.day": "\uc77c",
    "calendar.category": "\uce74\ud14c\uace0\ub9ac",

    // D-Day
    "dday.title": "\ub514\ub370\uc774",
    "dday.addNew": "\ub514\ub370\uc774 \ucd94\uac00",
    "dday.targetDate": "\ubaa9\ud45c \ub0a0\uc9dc",
    "dday.dDay": "\ub514\ub370\uc774!",
    "dday.eventName": "\uc774\ubca4\ud2b8 \uc774\ub984",
    "dday.addFirst": "\uccab \ubc88\uc9f8 \ub514\ub370\uc774\ub97c \ucd94\uac00\ud558\uc138\uc694",

    // TimeBox
    "timebox.title": "\ud0c0\uc784\ube14\ub85d",
    "timebox.addBlock": "\ube14\ub85d \ucd94\uac00",
    "timebox.noBlocks": "\ud0c0\uc784\ube14\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4",
    "timebox.addTimeBlocks": "\ud0c0\uc784\ube14\ub85d \ucd94\uac00",
    "timebox.blockTitle": "\ube14\ub85d \uc81c\ubaa9",

    // Reminders
    "reminder.title": "\ub9ac\ub9c8\uc778\ub354",
    "reminder.addNew": "\ub9ac\ub9c8\uc778\ub354 \ucd94\uac00",

    // Settings
    "settings.title": "\uc124\uc815",
    "settings.language": "\uc5b8\uc5b4",
    "settings.theme": "\ud14c\ub9c8",
    "settings.darkMode": "\ub2e4\ud06c \ubaa8\ub4dc",
    "settings.backup": "\ubc31\uc5c5 \ubc0f \ubcf5\uc6d0",
    "settings.export": "\ub370\uc774\ud130 \ub0b4\ubcf4\ub0b4\uae30",
    "settings.import": "\ub370\uc774\ud130 \uac00\uc838\uc624\uae30",
    "settings.profile": "\ud504\ub85c\ud544",
    "settings.appearance": "\uc678\uad00",
    "settings.data": "\ub370\uc774\ud130",
    "settings.light": "\ub77c\uc774\ud2b8",
    "settings.dark": "\ub2e4\ud06c",
    "settings.system": "\uc2dc\uc2a4\ud15c",
    "settings.exporting": "\ub0b4\ubcf4\ub0b4\ub294 \uc911...",
    "settings.importing": "\uac00\uc838\uc624\ub294 \uc911...",
    "settings.dataNote": "JSON\uc73c\ub85c \ubaa8\ub4e0 \ub370\uc774\ud130\ub97c \ub0b4\ubcf4\ub0c5\ub2c8\ub2e4. \uac00\uc838\uc624\uae30\ub294 \uae30\uc874 \ub370\uc774\ud130\uc640 \ubcd1\ud569\ud558\uac70\ub098 \ub300\uccb4\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
    "settings.userManagement": "\uc0ac\uc6a9\uc790 \uad00\ub9ac",
    "settings.addUser": "\uc0ac\uc6a9\uc790 \ucd94\uac00",
    "settings.accessRequests": "\uc561\uc138\uc2a4 \uc694\uccad",
    "settings.requestHistory": "\uc694\uccad \uae30\ub85d",
    "settings.approve": "\uc2b9\uc778",
    "settings.reject": "\uac70\uc808",
    "settings.role": "\uc5ed\ud560",
    "settings.create": "\uc0dd\uc131",
    "settings.deleteUserConfirm": "\uc774 \uc0ac\uc6a9\uc790\ub97c \uc0ad\uc81c\ud560\uae4c\uc694?",
    "settings.optional": "\uc120\ud0dd\uc0ac\ud56d",
    "settings.user": "\uc0ac\uc6a9\uc790",
    "settings.admin": "\uad00\ub9ac\uc790",

    // File Vault
    "files.title": "\ud30c\uc77c \ubcf4\uad00\ud568",
    "files.upload": "\uc5c5\ub85c\ub4dc",
    "files.searchPlaceholder": "\ud30c\uc77c \uac80\uc0c9...",
    "files.dropHere": "\ud30c\uc77c\uc744 \uc5ec\uae30\uc5d0 \ub193\uc73c\uc138\uc694",
    "files.noFiles": "\ud30c\uc77c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4",
    "files.dragOrUpload": "\ub4dc\ub798\uadf8 \uc564 \ub4dc\ub86d \ub610\ub294 \uc5c5\ub85c\ub4dc \ud074\ub9ad",
    "files.uploading": "\uc5c5\ub85c\ub4dc \uc911...",
    "files.deleteConfirm": "\uc774 \ud30c\uc77c\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?",
    "files.all": "\uc804\uccb4",

    // Scheduler
    "scheduler.brainBox": "\ube0c\ub808\uc778 \ubc15\uc2a4",
    "scheduler.priority": "\uc6b0\uc120\uc21c\uc704",
    "scheduler.timeGrid": "\ud0c0\uc784 \uadf8\ub9ac\ub4dc",
    "scheduler.dumpPlaceholder": "\uc5ec\uae30\uc5d0 \ubaa8\ub4e0 \uac83\uc744 \uc3df\uc544\ub193\uc73c\uc138\uc694...",
    "scheduler.place": "\ubc30\uce58",
    "scheduler.placing": "\ubc30\uce58 \uc911:",
    "scheduler.moveToPriority": "\uc6b0\uc120\uc21c\uc704\ub85c \uc774\ub3d9",
    "scheduler.brainBoxEmpty": "\uba3c\uc800 \ud560 \uc77c\uc744 \ubaa8\ub450 \uc3df\uc544\ub193\uc73c\uc138\uc694",
    "scheduler.priorityEmpty": "\ube0c\ub808\uc778 \ubc15\uc2a4\uc5d0\uc11c \ud56d\ubaa9\uc744 \uc62e\uaca8\uc8fc\uc138\uc694...",
    "scheduler.planned": "\uacc4\ud68d",
    "scheduler.done": "\uc644\ub8cc",

    // Search
    "search.placeholder": "\ud560 \uc77c, \uc77c\uc815, \ub514\ub370\uc774 \uac80\uc0c9...",
    "search.goCalendar": "\uce98\ub9b0\ub354\ub85c \uc774\ub3d9",
    "search.goTimebox": "\ud0c0\uc784\ubc15\uc2a4\ub85c \uc774\ub3d9",
    "search.goTodos": "\ud560 \uc77c\ub85c \uc774\ub3d9",
    "search.noResults": "\uac80\uc0c9 \uacb0\uacfc \uc5c6\uc74c:",

    // Help
    "help.title": "\ud0a4\ubcf4\ub4dc \ub2e8\ucd95\ud0a4 & \ub3c4\uc6c0\ub9d0",
    "help.shortcuts": "\ud0a4\ubcf4\ub4dc \ub2e8\ucd95\ud0a4",
    "help.telegramTitle": "\ud154\ub808\uadf8\ub7a8 \uba85\ub839\uc5b4",
    "help.tipsTitle": "\ud301",

    // Projects
    "project.title": "\ud504\ub85c\uc81d\ud2b8",
    "project.new": "\uc0c8 \ud504\ub85c\uc81d\ud2b8",
    "project.name": "\ud504\ub85c\uc81d\ud2b8 \uc774\ub984",
    "project.description": "\uc124\uba85",
    "project.dashboard": "\ud604\ud669\ud310",
    "project.tasks": "\ud0dc\uc2a4\ud06c",
    "project.members": "\uba64\ubc84",
    "project.invite": "\ucd08\ub300",
    "project.noProjects": "\ud504\ub85c\uc81d\ud2b8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4",
    "project.backToPersonal": "\uac1c\uc778",

    // Transfers
    "transfer.title": "\uc5c5\ubb34 \uc804\ub2ec",
    "transfer.request": "\uc804\ub2ec",
    "transfer.accept": "\uc218\ub77d",
    "transfer.reject": "\uac70\uc808",
    "transfer.pending": "\ub300\uae30 \uc911\uc778 \uc804\ub2ec",
    "transfer.message": "\uba54\uc2dc\uc9c0 (\uc120\ud0dd)",
    "transfer.from": "\ubcf4\ub0b8 \uc0ac\ub78c",
    "transfer.sent": "\uc804\ub2ec \uc694\uccad\ub428",
    "transfer.accepted": "\uc804\ub2ec \uc218\ub77d\ub428",
    "transfer.rejected": "\uc804\ub2ec \uac70\uc808\ub428",
    "transfer.noTransfers": "\ub300\uae30 \uc911\uc778 \uc804\ub2ec \uc5c6\uc74c",
    "transfer.selectMember": "\uba64\ubc84 \uc120\ud0dd",

    // Common extras
    "common.close": "\ub2eb\uae30",
    "common.all": "\uc804\uccb4",
    "common.done": "\uc644\ub8cc",
    "common.active": "\uc9c4\ud589 \uc911",
  },
};

let currentLocale: Locale = (localStorage.getItem("timebox-locale") as Locale) || "ko";

export function t(key: string): string {
  return translations[currentLocale]?.[key] || translations.en[key] || key;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  localStorage.setItem("timebox-locale", locale);
  // Trigger re-render by dispatching a custom event
  window.dispatchEvent(new CustomEvent("locale-changed", { detail: locale }));
}

export function getLocale(): Locale {
  return currentLocale;
}

export type { Locale };
