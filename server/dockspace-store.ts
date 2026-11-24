import { ValidationError, NotFoundError } from "./home-store.ts";

export interface AutomationRule {
  id: string;
  name: string;
  status: "active" | "paused";
  condition: string;
  action: string;
  ventImpact: number;
  updatedAt: string;
}

export interface MediaTrack {
  id: string;
  index: string;
  title: string;
  artist: string;
  album: string;
  quality: string;
  durationSec: number;
  accent: string;
}

export interface MediaState {
  playing: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  volume: number;
  positionSec: number;
  outputZone: "airpods" | "monitors" | "mac";
  outputLabel: string;
  source: string;
  trackId: string;
  track: MediaTrack;
  queue: MediaTrack[];
  updatedAt: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  dayOffset: number; // 0 = Sun ... 6 = Sat
  startHour: number; // e.g. 9.0, 10.5, 13.0
  durationHours: number;
  category: "shift" | "system" | "climate" | "studio" | "personal";
  subtitle: string;
  source: "studio" | "automated" | "cloud" | "hardware";
}

export interface WorldClockItem {
  label: string;
  timeZone: string;
}

export interface DockConfig {
  userName: string;
  studioName: string;
  autoHideDock: boolean;
  activeMacTarget: string;
  workShiftHours: string;
  clockFormat: "12-hour" | "24-hour";
  cloudSync: boolean;
  dockOpacity: number;
  showWeatherOverlay: boolean;
  widgetDisplayName: string;
  widgetGridSpan: string;
  weatherCity: string;
  weatherLat: number;
  weatherLon: number;
  stockSymbols: string;
  worldClocks: WorldClockItem[];
  homeQuickDeviceIds: string[];
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "rule-vent-cooldown",
    name: "Smart Vent Cool-Down",
    status: "active",
    condition: "Interior > 72°F",
    action: "Open Studio Vents",
    ventImpact: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule-frost-guard",
    name: "Frost Guard & Heat",
    status: "active",
    condition: "Outdoor < 45°F",
    action: "Engage Radiator",
    ventImpact: 0,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule-cross-breeze",
    name: "Cross-Breeze Purge",
    status: "paused",
    condition: "AQI > 50",
    action: "Open North Skylight",
    ventImpact: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule-humidity-eq",
    name: "Humidity Equalizer",
    status: "active",
    condition: "RH > 60%",
    action: "Run Exhaust Fan",
    ventImpact: 1,
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_QUEUE: MediaTrack[] = [
  {
    id: "trk-01",
    index: "01",
    title: "Briansstorming Session",
    artist: "Studio Ambient",
    album: "24-bit / 96kHz",
    quality: "24-bit / 96kHz",
    durationSec: 222,
    accent: "#ff6370",
  },
  {
    id: "trk-02",
    index: "02",
    title: "Midnight Compiler",
    artist: "Kiasmos",
    album: "Blurred EP",
    quality: "24-bit / 48kHz",
    durationSec: 318,
    accent: "#82d8a6",
  },
  {
    id: "trk-03",
    index: "03",
    title: "Silicon Drift",
    artist: "Rival Consoles",
    album: "Articulation",
    quality: "24-bit / 96kHz",
    durationSec: 249,
    accent: "#ffb3b4",
  },
  {
    id: "trk-04",
    index: "04",
    title: "Sub-Zero Telemetry",
    artist: "Jon Hopkins",
    album: "Singularity",
    quality: "24-bit / 96kHz",
    durationSec: 384,
    accent: "#77cc90",
  },
  {
    id: "trk-05",
    index: "05",
    title: "Analog Horizon",
    artist: "Nils Frahm",
    album: "All Melody",
    quality: "24-bit / 48kHz",
    durationSec: 291,
    accent: "#f5bb5c",
  },
];

const OUTPUT_LABELS: Record<MediaState["outputZone"], string> = {
  airpods: "AirPods Pro",
  monitors: "Studio Monitors",
  mac: "Mac Studio",
};

const DEFAULT_EVENTS: ScheduleEvent[] = [
  {
    id: "evt-shift",
    title: "Shift Active · Studio",
    dayOffset: 0,
    startHour: 9,
    durationHours: 8,
    category: "shift",
    subtitle: "9:00 AM – 5:00 PM · Active focus block",
    source: "studio",
  },
  {
    id: "evt-mac-sync",
    title: "Mac Studio M2 Sync",
    dayOffset: 0,
    startHour: 10.5,
    durationHours: 1,
    category: "system",
    subtitle: "10:30 AM · 60 min · Workstation backup",
    source: "automated",
  },
  {
    id: "evt-weather-review",
    title: "Studio Weather Review",
    dayOffset: 0,
    startHour: 13,
    durationHours: 0.75,
    category: "climate",
    subtitle: "1:00 PM · 45 min · Vent calibration",
    source: "hardware",
  },
  {
    id: "evt-dock-audit",
    title: "Dock Widgets Audit",
    dayOffset: 0,
    startHour: 15.25,
    durationHours: 0.75,
    category: "studio",
    subtitle: "3:15 PM · 45 min · Module telemetry",
    source: "studio",
  },
  {
    id: "evt-evening-wrap",
    title: "Evening Wind-Down",
    dayOffset: 0,
    startHour: 19.5,
    durationHours: 0.75,
    category: "personal",
    subtitle: "7:30 PM · 45 min · Warm ambient lights",
    source: "studio",
  },
  {
    id: "evt-firmware",
    title: "Studio Firmware Update",
    dayOffset: 1,
    startHour: 8.5,
    durationHours: 1,
    category: "system",
    subtitle: "Mac Studio M2 background patch · Automated",
    source: "automated",
  },
  {
    id: "evt-backup",
    title: "Weekly Dock Layout Backup",
    dayOffset: 2,
    startHour: 11,
    durationHours: 1,
    category: "studio",
    subtitle: "8 modules configuration export · Cloud",
    source: "cloud",
  },
  {
    id: "evt-climate-cal",
    title: "Studio Climate Calibration",
    dayOffset: 3,
    startHour: 8.5,
    durationHours: 1,
    category: "climate",
    subtitle: "Smart thermostat and weather sync · Hardware",
    source: "hardware",
  },
];

export const DEFAULT_WORLD_CLOCKS: WorldClockItem[] = [
  { label: "San Francisco", timeZone: "America/Los_Angeles" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Bengaluru", timeZone: "Asia/Kolkata" },
  { label: "Tokyo", timeZone: "Asia/Tokyo" },
];

export const DEFAULT_DOCK_CONFIG: DockConfig = {
  userName: "Alex",
  studioName: "Studio",
  autoHideDock: true,
  activeMacTarget: "Mac Studio M2",
  workShiftHours: "9:00 AM - 5:00 PM",
  clockFormat: "12-hour",
  cloudSync: true,
  dockOpacity: 85,
  showWeatherOverlay: true,
  widgetDisplayName: "Mac Studio M2",
  widgetGridSpan: "2x4 Medium",
  weatherCity: "West Lafayette, Indiana",
  weatherLat: 40.4259,
  weatherLon: -86.9081,
  stockSymbols: "AAPL,NVDA,V,GOOG,META,TSLA",
  worldClocks: DEFAULT_WORLD_CLOCKS.map((c) => ({ ...c })),
  homeQuickDeviceIds: [],
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export class AutomationsStore {
  private rules: AutomationRule[];

  constructor(seed: AutomationRule[] = DEFAULT_RULES) {
    this.rules = seed.map((rule) => ({ ...rule }));
  }

  summary() {
    const activeCount = this.rules.filter((r) => r.status === "active").length;
    const ventsOpen = this.rules
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + r.ventImpact, 0);
    return {
      rules: this.rules.map((r) => ({ ...r })),
      stats: {
        activeCount,
        totalRules: this.rules.length,
        ventsOpen: Math.min(3, ventsOpen),
        totalVents: 3,
      },
    };
  }

  toggleRule(id: string): AutomationRule {
    const found = this.rules.find((r) => r.id === id);
    if (!found) throw new NotFoundError("Automation rule not found");
    found.status = found.status === "active" ? "paused" : "active";
    found.updatedAt = new Date().toISOString();
    return { ...found };
  }

  addRule(payload: { name?: unknown; condition?: unknown; action?: unknown; status?: unknown }): AutomationRule {
    const name = String(payload.name ?? "").trim();
    const condition = String(payload.condition ?? "").trim();
    const action = String(payload.action ?? "").trim();
    if (!name) throw new ValidationError("Enter a rule name");
    if (!condition) throw new ValidationError("Enter a trigger condition");
    if (!action) throw new ValidationError("Enter an automation action");
    const status = payload.status === "paused" ? "paused" : "active";
    const rule: AutomationRule = {
      id: makeId("rule"),
      name: name.slice(0, 80),
      status,
      condition: condition.slice(0, 64),
      action: action.slice(0, 80),
      ventImpact: /vent|skylight|fan|breeze/i.test(action) ? 1 : 0,
      updatedAt: new Date().toISOString(),
    };
    this.rules.push(rule);
    return { ...rule };
  }

  removeRule(id: string): void {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundError("Automation rule not found");
    this.rules.splice(idx, 1);
  }
}

export class MediaDeckStore {
  private queue: MediaTrack[];
  private currentIndex = 0;
  private playing = true;
  private shuffle = false;
  private repeat: "off" | "all" | "one" = "all";
  private volume = 68;
  private positionSec = 134;
  private outputZone: MediaState["outputZone"] = "airpods";

  constructor(queue: MediaTrack[] = DEFAULT_QUEUE) {
    this.queue = queue.map((t) => ({ ...t }));
  }

  state(): MediaState {
    const track = this.queue[this.currentIndex] ?? this.queue[0];
    return {
      playing: this.playing,
      shuffle: this.shuffle,
      repeat: this.repeat,
      volume: this.volume,
      positionSec: Math.min(this.positionSec, track.durationSec),
      outputZone: this.outputZone,
      outputLabel: OUTPUT_LABELS[this.outputZone],
      source: "Apple Music Lossless",
      trackId: track.id,
      track: { ...track },
      queue: this.queue.map((t) => ({ ...t })),
      updatedAt: new Date().toISOString(),
    };
  }

  control(payload: {
    action?: unknown;
    volume?: unknown;
    positionSec?: unknown;
    outputZone?: unknown;
    trackId?: unknown;
  }): MediaState {
    const action = String(payload.action ?? "").trim().toLowerCase();
    if (action === "play") this.playing = true;
    else if (action === "pause") this.playing = false;
    else if (action === "toggle" || action === "play_pause") this.playing = !this.playing;
    else if (action === "next") {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
      this.positionSec = 0;
      this.playing = true;
    } else if (action === "prev" || action === "previous") {
      this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
      this.positionSec = 0;
      this.playing = true;
    } else if (action === "shuffle") {
      this.shuffle = !this.shuffle;
    } else if (action === "repeat") {
      this.repeat = this.repeat === "off" ? "all" : this.repeat === "all" ? "one" : "off";
    } else if (action === "volume") {
      const vol = Number(payload.volume);
      if (!Number.isFinite(vol)) throw new ValidationError("Volume must be a number");
      this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    } else if (action === "seek") {
      const pos = Number(payload.positionSec);
      if (!Number.isFinite(pos)) throw new ValidationError("Position must be a number");
      const max = this.queue[this.currentIndex]?.durationSec ?? 0;
      this.positionSec = Math.max(0, Math.min(max, Math.round(pos)));
    } else if (action === "output") {
      const zone = String(payload.outputZone ?? "");
      if (zone !== "airpods" && zone !== "monitors" && zone !== "mac") {
        throw new ValidationError("Unknown output zone");
      }
      this.outputZone = zone;
    } else if (action === "select_track") {
      const trackId = String(payload.trackId ?? "");
      const idx = this.queue.findIndex((t) => t.id === trackId);
      if (idx === -1) throw new NotFoundError("Track not found in queue");
      this.currentIndex = idx;
      this.positionSec = 0;
      this.playing = true;
    } else {
      throw new ValidationError("Unsupported media control action");
    }
    return this.state();
  }
}

export class ScheduleStore {
  private events: ScheduleEvent[];

  constructor(seed: ScheduleEvent[] = DEFAULT_EVENTS) {
    this.events = seed.map((e) => ({ ...e }));
  }

  list(): ScheduleEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  addEvent(payload: {
    title?: unknown;
    dayOffset?: unknown;
    startHour?: unknown;
    durationHours?: unknown;
    category?: unknown;
    subtitle?: unknown;
  }): ScheduleEvent {
    const title = String(payload.title ?? "").trim();
    if (!title) throw new ValidationError("Enter an event title");
    const dayOffset = Math.max(0, Math.min(6, Math.round(Number(payload.dayOffset ?? 0))));
    const startHour = Number(payload.startHour ?? 10);
    if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23.5) {
      throw new ValidationError("Start hour must be between 0 and 23.5");
    }
    const durationHours = Math.max(0.5, Math.min(12, Number(payload.durationHours ?? 1)));
    const rawCat = String(payload.category ?? "studio");
    const category: ScheduleEvent["category"] =
      rawCat === "shift" || rawCat === "system" || rawCat === "climate" || rawCat === "personal"
        ? rawCat
        : "studio";
    const event: ScheduleEvent = {
      id: makeId("evt"),
      title: title.slice(0, 80),
      dayOffset,
      startHour,
      durationHours,
      category,
      subtitle: String(payload.subtitle ?? "").trim().slice(0, 120) || "Scheduled in DockSpace",
      source: "studio",
    };
    this.events.push(event);
    return { ...event };
  }

  removeEvent(id: string): void {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundError("Schedule event not found");
    this.events.splice(idx, 1);
  }
}

export class DockConfigStore {
  private config: DockConfig;

  constructor(seed: DockConfig = DEFAULT_DOCK_CONFIG) {
    this.config = {
      ...seed,
      worldClocks: seed.worldClocks.map((c) => ({ ...c })),
      homeQuickDeviceIds: [...seed.homeQuickDeviceIds],
    };
  }

  get(): DockConfig {
    return {
      ...this.config,
      worldClocks: this.config.worldClocks.map((c) => ({ ...c })),
      homeQuickDeviceIds: [...this.config.homeQuickDeviceIds],
    };
  }

  update(patch: Record<string, unknown>): DockConfig {
    if (patch.userName !== undefined) {
      const value = String(patch.userName).trim();
      if (!value) throw new ValidationError("User name cannot be empty");
      this.config.userName = value.slice(0, 40);
    }
    if (patch.studioName !== undefined) {
      const value = String(patch.studioName).trim();
      if (!value) throw new ValidationError("Studio name cannot be empty");
      this.config.studioName = value.slice(0, 40);
    }
    if (patch.autoHideDock !== undefined) {
      this.config.autoHideDock = Boolean(patch.autoHideDock);
    }
    if (patch.activeMacTarget !== undefined) {
      const value = String(patch.activeMacTarget).trim();
      if (value) this.config.activeMacTarget = value.slice(0, 60);
    }
    if (patch.workShiftHours !== undefined) {
      const value = String(patch.workShiftHours).trim();
      if (value) this.config.workShiftHours = value.slice(0, 40);
    }
    if (patch.clockFormat === "12-hour" || patch.clockFormat === "24-hour") {
      this.config.clockFormat = patch.clockFormat;
    }
    if (patch.cloudSync !== undefined) {
      this.config.cloudSync = Boolean(patch.cloudSync);
    }
    if (patch.dockOpacity !== undefined) {
      const op = Number(patch.dockOpacity);
      if (!Number.isFinite(op)) throw new ValidationError("Dock opacity must be a number");
      this.config.dockOpacity = Math.max(20, Math.min(100, Math.round(op)));
    }
    if (patch.showWeatherOverlay !== undefined) {
      this.config.showWeatherOverlay = Boolean(patch.showWeatherOverlay);
    }
    if (patch.widgetDisplayName !== undefined) {
      const value = String(patch.widgetDisplayName).trim();
      if (!value) throw new ValidationError("Widget display name cannot be empty");
      this.config.widgetDisplayName = value.slice(0, 60);
    }
    if (patch.widgetGridSpan !== undefined) {
      const value = String(patch.widgetGridSpan).trim();
      if (value) this.config.widgetGridSpan = value.slice(0, 40);
    }
    if (patch.weatherCity !== undefined) {
      const value = String(patch.weatherCity).trim();
      if (value) this.config.weatherCity = value.slice(0, 60);
    }
    if (patch.weatherLat !== undefined && Number.isFinite(Number(patch.weatherLat))) {
      this.config.weatherLat = Number(patch.weatherLat);
    }
    if (patch.weatherLon !== undefined && Number.isFinite(Number(patch.weatherLon))) {
      this.config.weatherLon = Number(patch.weatherLon);
    }
    if (patch.stockSymbols !== undefined) {
      const cleaned = String(patch.stockSymbols)
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.-]{1,10}$/.test(s));
      if (cleaned.length > 0) this.config.stockSymbols = cleaned.join(",");
    }
    if (Array.isArray(patch.worldClocks)) {
      const parsed = patch.worldClocks
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const label = String((item as Record<string, unknown>).label ?? "").trim().slice(0, 32);
          const timeZone = String((item as Record<string, unknown>).timeZone ?? "").trim().slice(0, 64);
          if (!label || !timeZone) return null;
          try {
            new Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
          } catch {
            return null;
          }
          return { label, timeZone };
        })
        .filter((c): c is WorldClockItem => c !== null)
        .slice(0, 5);
      if (parsed.length === 0) {
        throw new ValidationError("Provide at least one valid world clock timezone");
      }
      this.config.worldClocks = parsed;
    }
    if (Array.isArray(patch.homeQuickDeviceIds)) {
      this.config.homeQuickDeviceIds = [
        ...new Set(
          patch.homeQuickDeviceIds
            .map((id) => String(id ?? "").trim())
            .filter(Boolean)
            .slice(0, 32)
        ),
      ];
    }
    return this.get();
  }

  reset(): DockConfig {
    this.config = {
      ...DEFAULT_DOCK_CONFIG,
      worldClocks: DEFAULT_WORLD_CLOCKS.map((c) => ({ ...c })),
      homeQuickDeviceIds: [],
    };
    return this.get();
  }
}
