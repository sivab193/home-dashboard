import crypto from "node:crypto";

export interface CalendarEvent {
  id: string;
  uid: string;
  title: string;
  start: string;
  end: string;
  location: string;
  calendar: string;
}

export interface CalendarNotification {
  id: string;
  kind: "new" | "updated";
  title: string;
  start: string;
  detected_at: string;
  read: boolean;
}

export interface CalendarStatus {
  configured: boolean;
  events: CalendarEvent[];
  notifications: CalendarNotification[];
  unread: number;
  last_sync?: string;
  error?: string;
  refresh_seconds?: number;
}

function parseIcsDate(raw: string): string | null {
  const cleaned = raw.trim();
  const dateOnly = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00.000Z`;
  }
  const dateTime = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dateTime) {
    return `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}T${dateTime[4]}:${dateTime[5]}:${dateTime[6]}.000Z`;
  }
  const parsed = Date.parse(cleaned);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function parseIcsFeed(icsText: string): CalendarEvent[] {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const events: CalendarEvent[] = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0] ?? "";
    const lines = body.split(/\r?\n/);
    let uid = "";
    let title = "Untitled event";
    let start: string | null = null;
    let end: string | null = null;
    let location = "";

    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).split(";")[0].toUpperCase();
      const value = line.slice(colon + 1).trim();
      if (key === "UID") uid = value;
      else if (key === "SUMMARY") title = value || "Untitled event";
      else if (key === "DTSTART") start = parseIcsDate(value);
      else if (key === "DTEND") end = parseIcsDate(value);
      else if (key === "LOCATION") location = value;
    }

    if (!start) continue;
    const id = crypto
      .createHash("sha256")
      .update(`${uid || title}|${start}`)
      .digest("hex")
      .slice(0, 20);
    events.push({
      id,
      uid,
      title,
      start,
      end: end || start,
      location,
      calendar: "Subscribed calendar",
    });
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

export class CalendarFeedService {
  private url: string;
  private token: string;
  private refreshSeconds: number;
  private events: CalendarEvent[] = [];
  private fingerprints = new Map<string, string>();
  private notifications: CalendarNotification[] = [];
  private lastSyncAt = 0;
  private lastSyncIso?: string;
  private error = "";

  constructor(options?: { url?: string; token?: string; refreshSeconds?: number }) {
    this.url = (options?.url ?? process.env.CALENDAR_ICS_URL ?? "").trim();
    this.token = (options?.token ?? process.env.CALENDAR_ICS_TOKEN ?? "").trim();
    const rawRefresh = Number(
      options?.refreshSeconds ?? process.env.CALENDAR_REFRESH_SECONDS ?? "900"
    );
    this.refreshSeconds = Math.max(60, Number.isFinite(rawRefresh) ? rawRefresh : 900);
  }

  async status(): Promise<CalendarStatus> {
    if (!this.url) {
      return { configured: false, events: [], notifications: [], unread: 0 };
    }
    const now = Date.now();
    if (now - this.lastSyncAt >= this.refreshSeconds * 1000) {
      this.lastSyncAt = now;
      await this.refresh();
    }
    return {
      configured: true,
      events: this.events,
      notifications: this.notifications,
      unread: this.notifications.filter((n) => !n.read).length,
      last_sync: this.lastSyncIso,
      error: this.error,
      refresh_seconds: this.refreshSeconds,
    };
  }

  markRead(): CalendarStatus {
    for (const item of this.notifications) {
      item.read = true;
    }
    return {
      configured: Boolean(this.url),
      events: this.events,
      notifications: this.notifications,
      unread: 0,
      last_sync: this.lastSyncIso,
      error: this.error,
      refresh_seconds: this.refreshSeconds,
    };
  }

  private async refresh(): Promise<void> {
    try {
      const headers: Record<string, string> = { Accept: "text/calendar" };
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      const res = await fetch(this.url, { headers, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const nextEvents = parseIcsFeed(await res.text());
      const nextFingerprints = new Map<string, string>();
      for (const ev of nextEvents) {
        const fp = crypto
          .createHash("sha256")
          .update(JSON.stringify(ev))
          .digest("hex");
        nextFingerprints.set(ev.id, fp);
      }

      if (this.fingerprints.size > 0) {
        const stamp = new Date().toISOString();
        for (const ev of nextEvents) {
          const prev = this.fingerprints.get(ev.id);
          const next = nextFingerprints.get(ev.id);
          if (!prev) {
            this.notifications.unshift({
              id: `${ev.id}-${Date.now()}`,
              kind: "new",
              title: ev.title,
              start: ev.start,
              detected_at: stamp,
              read: false,
            });
          } else if (prev !== next) {
            this.notifications.unshift({
              id: `${ev.id}-${Date.now()}`,
              kind: "updated",
              title: ev.title,
              start: ev.start,
              detected_at: stamp,
              read: false,
            });
          }
        }
        this.notifications = this.notifications.slice(0, 100);
      }

      this.events = nextEvents;
      this.fingerprints = nextFingerprints;
      this.lastSyncIso = new Date().toISOString();
      this.error = "";
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to refresh calendar feed";
    }
  }
}
