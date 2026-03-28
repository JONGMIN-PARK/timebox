// PWA App Badge API - shows unread count on home screen icon
// Supported: Android Chrome 81+, iOS Safari 16.4+

let badgeCount = 0;

export function updateAppBadge(count: number) {
  badgeCount = count;
  if ("setAppBadge" in navigator) {
    if (count > 0) {
      (navigator as any).setAppBadge(count).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }
}

export function incrementBadge(by = 1) {
  updateAppBadge(badgeCount + by);
}

export function getBadgeCount() {
  return badgeCount;
}
