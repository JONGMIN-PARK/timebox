export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // "HH:MM" format, e.g. "22:00"
  end: string; // "HH:MM" format, e.g. "07:00"
}

const STORAGE_KEY = "timebox_quiet_hours";

const DEFAULT_CONFIG: QuietHoursConfig = {
  enabled: false,
  start: "22:00",
  end: "07:00",
};

export function getQuietHoursConfig(): QuietHoursConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return JSON.parse(raw) as QuietHoursConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveQuietHoursConfig(config: QuietHoursConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isQuietHoursActive(): boolean {
  const config = getQuietHoursConfig();
  if (!config.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(config.start);
  const endMinutes = parseTime(config.end);

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 09:00 to 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Overnight range (e.g., 22:00 to 07:00): quiet if >= start OR < end
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
