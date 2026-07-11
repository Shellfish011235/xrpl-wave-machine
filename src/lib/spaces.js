import { SPACES } from "../data/spaces";

export function getSpace(id) {
  return SPACES.find((s) => s.id === id) || null;
}

/** True only while now is inside the space's scheduled window. */
export function isSpaceActive(space, now = Date.now()) {
  if (!space?.schedule) return false;
  const start = Date.parse(space.schedule.start);
  const end = Date.parse(space.schedule.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

export function spaceStatus(space, now = Date.now()) {
  if (!space) return "unknown";
  const start = Date.parse(space.schedule.start);
  const end = Date.parse(space.schedule.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return "misconfigured";
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

export function formatWindow(space) {
  if (!space?.schedule) return "—";
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(space.schedule.start))} → ${fmt.format(new Date(space.schedule.end))}`;
}

export function buildCheckInUrl(spaceId, base = window.location.origin) {
  const url = new URL(base);
  url.searchParams.set("space", spaceId);
  url.searchParams.set("checkin", "1");
  return url.toString();
}

export function parseCheckInFromLocation(search = window.location.search) {
  const params = new URLSearchParams(search);
  const spaceId = params.get("space");
  const checkin = params.get("checkin") === "1";
  if (!spaceId || !checkin) return null;
  return { spaceId };
}

export function clearCheckInFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("space");
  url.searchParams.delete("checkin");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

const LOG_KEY = "wave-space-log";

export function loadSpaceLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSpaceLog(entries) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota */
  }
}

/** One credited check-in per wallet per space (anti-farming). */
export function hasCheckedIn(entries, spaceId, walletAddress) {
  const addr = walletAddress?.toLowerCase();
  return entries.some(
    (e) => e.spaceId === spaceId && e.wallet?.toLowerCase() === addr && e.credited
  );
}
