const API_ORIGIN = (window.HOME_DASHBOARD_API_ORIGIN || window.location.origin).replace(/\/$/, "");
const STORAGE_KEY = "dockspace.preferences.v1";
const CCTV_ORIGIN_KEY = "dockspace.cctvOrigin";
const rawFeatures = window.HOME_DASHBOARD_FEATURES || {};
export const features = {
  devices: rawFeatures.devices !== false,
  media: rawFeatures.media !== false,
  schedule: rawFeatures.schedule !== false,
};
const runtimeDefaults =
  window.HOME_DASHBOARD_DEFAULTS && typeof window.HOME_DASHBOARD_DEFAULTS === "object"
    ? window.HOME_DASHBOARD_DEFAULTS
    : {};

export function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Feed URL must start with http:// or https://");
  }
  return url.origin;
}

export function getCctvOrigin() {
  try {
    const saved = localStorage.getItem(CCTV_ORIGIN_KEY);
    if (saved) return normalizeOrigin(saved);
  } catch {
    // ignore invalid or unavailable storage
  }
  return API_ORIGIN;
}

export function getCctvOriginOverride() {
  try {
    return localStorage.getItem(CCTV_ORIGIN_KEY) || "";
  } catch {
    return "";
  }
}

export function setCctvOrigin(value) {
  const normalized = normalizeOrigin(value);
  try {
    if (normalized) localStorage.setItem(CCTV_ORIGIN_KEY, normalized);
    else localStorage.removeItem(CCTV_ORIGIN_KEY);
  } catch {
    // ignore storage errors
  }
  store.cctvOrigin = getCctvOrigin();
  return store.cctvOrigin;
}

export function getCctvWsOrigin() {
  const origin = getCctvOrigin() || window.location.origin;
  return origin.replace(/^http/, "ws");
}

export const store = {
  route: "/",
  config: {
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
    worldClocks: [
      { label: "San Francisco", timeZone: "America/Los_Angeles" },
      { label: "New York", timeZone: "America/New_York" },
      { label: "London", timeZone: "Europe/London" },
      { label: "Bengaluru", timeZone: "Asia/Kolkata" },
      { label: "Tokyo", timeZone: "Asia/Tokyo" },
    ],
    homeQuickDeviceIds: [],
    ...runtimeDefaults,
  },
  home: { rooms: [], items: [], groups: [], music_reactive_lights: [] },
  automations: {
    rules: [],
    stats: { activeCount: 0, totalRules: 0 },
  },
  media: null,
  schedule: [],
  calendar: { configured: false, unread: 0, upcoming: [], updates: [] },
  stocks: { items: [], stale: false },
  weather: null,
  events: [],
  streams: {},
  streamsOnline: false,
  cctvOrigin: "",
  health: {},
  activityLog: [
    {
      id: "act-1",
      title: "Smart Vent Cool-Down armed",
      detail: "Interior threshold set to 72°F · Studio Vents",
      time: "Just now",
      level: "info",
      read: false,
    },
    {
      id: "act-2",
      title: "Mac Studio M2 telemetry synced",
      detail: "Workstation bridge nominal · 12 cores active",
      time: "14m ago",
      level: "ok",
      read: false,
    },
  ],
  listeners: new Set(),
};

export function subscribe(fn) {
  store.listeners.add(fn);
  return () => store.listeners.delete(fn);
}

export function notify(reason = "update") {
  for (const fn of store.listeners) {
    try {
      fn(reason);
    } catch (err) {
      console.error("Subscriber error", err);
    }
  }
}

export function logActivity(title, detail, level = "info") {
  store.activityLog.unshift({
    id: `act-${Date.now().toString(36)}`,
    title,
    detail,
    time: formatTime(new Date()),
    level,
    read: false,
  });
  store.activityLog = store.activityLog.slice(0, 20);
  notify("activity");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatTime(date, includeSeconds = false) {
  const is24 = store.config.clockFormat === "24-hour";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: !is24,
  }).format(date);
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function showToast(message, tone = "info") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const el = document.createElement("div");
  const borderClass =
    tone === "error"
      ? "border-danger/60 bg-[#2d181a] text-on-surface"
      : tone === "ok"
      ? "border-tertiary/50 bg-[#17231e] text-on-surface"
      : "border-outline bg-surface-container text-on-surface";
  const icon = tone === "error" ? "error" : tone === "ok" ? "check_circle" : "info";
  const iconColor =
    tone === "error" ? "text-danger" : tone === "ok" ? "text-tertiary" : "text-primary-container";
  el.className = `pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border ${borderClass} shadow-xl text-xs font-medium transition-all duration-200`;
  el.innerHTML = `<span class="material-symbols-outlined text-[18px] ${iconColor}">${icon}</span><span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 220);
  }, 2800);
}

export async function apiFetch(path, options = {}) {
  const url = `${API_ORIGIN}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function applyDockVisualPrefs() {
  const opacity = Math.max(20, Math.min(100, Number(store.config.dockOpacity ?? 85)));
  document.documentElement.style.setProperty("--dock-opacity", (opacity / 100).toFixed(2));
  const hostEl = document.getElementById("sidebarHostLabel");
  if (hostEl) hostEl.textContent = (store.config.activeMacTarget || "MAC STUDIO").toUpperCase();
  const profileEl = document.getElementById("topProfileBtn");
  if (profileEl) {
    const name = String(store.config.userName || "Alex").trim();
    profileEl.textContent = name.slice(0, 2).toUpperCase();
    profileEl.title = `${name} · Config`;
  }
}

function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const prefs = JSON.parse(raw);
    if (
      prefs.weatherCity === "San Francisco"
      || (prefs.weatherLat === 37.7749 && prefs.weatherLon === -122.4194)
    ) {
      prefs.weatherCity = "West Lafayette, Indiana";
      prefs.weatherLat = 40.4259;
      prefs.weatherLon = -86.9081;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
    return prefs;
  } catch {
    return null;
  }
}

function saveLocalPrefs(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore quota errors
  }
}

export async function fetchConfig() {
  const local = loadLocalPrefs();
  let serverCfg = {};
  if (features.devices || features.media || features.schedule) {
    try {
      serverCfg = await apiFetch("/api/config");
    } catch {
      serverCfg = {};
    }
  }
  store.config = { ...store.config, ...runtimeDefaults, ...(local || {}), ...serverCfg };
  applyDockVisualPrefs();
  notify("config");
  return store.config;
}

export async function updateConfig(patch) {
  let updated = {};
  try {
    updated = await apiFetch("/api/config", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch {
    updated = patch;
  }
  store.config = { ...store.config, ...updated };
  saveLocalPrefs(store.config);
  applyDockVisualPrefs();
  notify("config");
  return store.config;
}

export async function resetConfig() {
  const updated = await apiFetch("/api/config/reset", { method: "POST" });
  store.config = { ...updated };
  saveLocalPrefs(store.config);
  applyDockVisualPrefs();
  notify("config");
  return store.config;
}

export async function fetchHome() {
  const [states, cfg] = await Promise.all([
    apiFetch("/api/home/states"),
    apiFetch("/api/home/config").catch(() => ({ rooms: [] })),
  ]);
  const rawList = Array.isArray(states) ? states : states?.items || states?.entities || [];
  const items = rawList.map((item) => {
    const attrs = { ...(item.attributes || {}) };
    if (attrs.brightness_pct === undefined && typeof attrs.brightness === "number") {
      attrs.brightness_pct = Math.round((attrs.brightness / 255) * 100);
    }
    return { ...item, attributes: attrs };
  });
  const rooms =
    Array.isArray(cfg?.rooms) && cfg.rooms.length
      ? cfg.rooms
      : [...new Set(items.map((i) => i.room || "Home"))].sort((a, b) => a.localeCompare(b));
  const groups = Array.isArray(cfg?.groups) ? cfg.groups : [];
  store.home = { rooms, items, groups };
  notify("home");
  return store.home;
}

export async function commandHomeEntity(itemId, action, data = {}) {
  const res = await apiFetch(`/api/home/entities/${encodeURIComponent(itemId)}`, {
    method: "POST",
    body: JSON.stringify({ action, data }),
  });
  await fetchHome();
  return res;
}

export async function setRoomPower(room, action) {
  await apiFetch(`/api/home/rooms/${encodeURIComponent(room)}/${action}`, { method: "POST" });
  await fetchHome();
}

export async function updateHomeEntity(itemId, patch) {
  await apiFetch(`/api/home/entities/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fetchHome();
}

export async function saveHomeGroup(payload, groupId = null) {
  await apiFetch(groupId ? `/api/home/groups/${encodeURIComponent(groupId)}` : "/api/home/groups", {
    method: groupId ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  });
  return fetchHome();
}

export async function commandHomeGroup(groupId, action) {
  const result = await apiFetch(`/api/home/groups/${encodeURIComponent(groupId)}/${action}`, {
    method: "POST",
  });
  await fetchHome();
  return result;
}

export async function deleteHomeGroup(groupId) {
  await apiFetch(`/api/home/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
  return fetchHome();
}

export async function fetchAutomations() {
  const data = await apiFetch("/api/automations");
  store.automations = data;
  notify("automations");
  return data;
}

export async function toggleAutomation(id) {
  const data = await apiFetch(`/api/automations/${encodeURIComponent(id)}/toggle`, { method: "POST" });
  store.automations = { rules: data.rules, stats: data.stats };
  logActivity(
    `${data.rule.name} ${data.rule.status === "active" ? "activated" : "paused"}`,
    `${data.rule.condition} → ${data.rule.action}`,
    data.rule.status === "active" ? "ok" : "info"
  );
  notify("automations");
  return data;
}

export async function addAutomation(payload) {
  const data = await apiFetch("/api/automations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  store.automations = { rules: data.rules, stats: data.stats };
  logActivity(`Rule added: ${data.rule.name}`, `${data.rule.condition} → ${data.rule.action}`, "ok");
  notify("automations");
  return data;
}

export async function deleteAutomation(id) {
  const data = await apiFetch(`/api/automations/${encodeURIComponent(id)}`, { method: "DELETE" });
  store.automations = { rules: data.rules, stats: data.stats };
  notify("automations");
  return data;
}

export async function runAutomation(id) {
  const data = await apiFetch(`/api/automations/${encodeURIComponent(id)}/run`, { method: "POST" });
  store.automations = { rules: data.rules, stats: data.stats };
  notify("automations");
  return data;
}

export async function fetchMedia() {
  const data = await apiFetch("/api/media");
  store.media = data;
  notify("media");
  return data;
}

export async function controlMedia(payload) {
  const data = await apiFetch("/api/media/control", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  store.media = data;
  notify("media");
  return data;
}

export async function fetchSchedule() {
  const [sched, cal] = await Promise.all([
    apiFetch("/api/schedule"),
    apiFetch("/api/dashboard/calendar").catch(() => ({ configured: false, unread: 0, upcoming: [], updates: [] })),
  ]);
  store.schedule = sched.events || [];
  store.calendar = cal;
  notify("schedule");
  return store.schedule;
}

export async function addScheduleEvent(payload) {
  const data = await apiFetch("/api/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  store.schedule = data.events || [];
  logActivity(`Event scheduled: ${data.event.title}`, data.event.subtitle, "ok");
  notify("schedule");
  return data.event;
}

export async function deleteScheduleEvent(id) {
  const data = await apiFetch(`/api/schedule/${encodeURIComponent(id)}`, { method: "DELETE" });
  store.schedule = data.events || [];
  notify("schedule");
}

export async function fetchStocks() {
  try {
    const syms = encodeURIComponent(store.config.stockSymbols || "AAPL,NVDA,V,GOOG,META,TSLA");
    const data = await apiFetch(`/api/dashboard/stocks?symbols=${syms}`);
    const rawQuotes = Array.isArray(data?.quotes) ? data.quotes : Array.isArray(data?.items) ? data.items : [];
    const items = rawQuotes.map((q) => ({
      ...q,
      change_pct:
        typeof q.change_pct === "number"
          ? q.change_pct
          : q.available && q.previous
          ? ((q.change ?? 0) / q.previous) * 100
          : 0,
    }));
    store.stocks = { items, loaded: true, stale: items.some((i) => !i.available || i.stale) };
  } catch {
    store.stocks = { items: [], loaded: true, stale: true };
  }
  notify("stocks");
  return store.stocks;
}

export async function fetchSecurity() {
  const cctvOrigin = getCctvOrigin();
  store.cctvOrigin = cctvOrigin;
  const streamsUrl = `${cctvOrigin}/api/streams`;
  const [streamsRes, events, health] = await Promise.all([
    fetch(streamsUrl, { cache: "no-store" })
      .then(async (res) => (res.ok ? { ok: true, data: await res.json() } : { ok: false, data: {} }))
      .catch(() => ({ ok: false, data: {} })),
    apiFetch("/api/events").catch(() => []),
    apiFetch("/api/health").catch(() => ({})),
  ]);
  store.streams = streamsRes.data && typeof streamsRes.data === "object" ? streamsRes.data : {};
  store.streamsOnline = Boolean(streamsRes.ok);
  store.events = Array.isArray(events) ? events : [];
  store.health = health || {};
  notify("security");
}

const WMO_LABELS = {
  0: { label: "Clear Sky", icon: "sunny" },
  1: { label: "Mostly Clear", icon: "partly_cloudy_day" },
  2: { label: "Partly Cloudy", icon: "partly_cloudy_day" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "foggy" },
  48: { label: "Rime Fog", icon: "foggy" },
  51: { label: "Light Drizzle", icon: "rainy" },
  53: { label: "Drizzle", icon: "rainy" },
  55: { label: "Heavy Drizzle", icon: "rainy" },
  61: { label: "Light Rain", icon: "rainy" },
  63: { label: "Rain", icon: "rainy" },
  65: { label: "Heavy Rain", icon: "rainy" },
  71: { label: "Snow", icon: "weather_snowy" },
  80: { label: "Rain Showers", icon: "rainy" },
  95: { label: "Thunderstorm", icon: "thunderstorm" },
};

export function weatherMeta(code) {
  return WMO_LABELS[Number(code)] || { label: "Partly Cloudy", icon: "partly_cloudy_day" };
}

export function fToC(tempF) {
  return Math.round(((Number(tempF) - 32) * 5) / 9);
}

function buildFallbackWeather() {
  const nowHour = new Date().getHours();
  const temps = [64, 67, 68, 66, 63, 60, 58, 56];
  const icons = ["partly_cloudy_day", "sunny", "sunny", "air", "cloud", "cloud", "nights_stay", "nights_stay"];
  const hourly = temps.map((t, i) => ({
    label: i === 0 ? "NOW" : formatHourLabel((nowHour + i) % 24),
    temp: t,
    tempC: fToC(t),
    icon: icons[i],
    precipProb: i === 4 ? 15 : 5,
    windSpeed: 10 + (i % 4),
  }));
  return {
    live: false,
    city: store.config.weatherCity || "San Francisco",
    lat: store.config.weatherLat ?? 37.7749,
    lon: store.config.weatherLon ?? -122.4194,
    tempF: 64,
    tempC: fToC(64),
    feelsLikeF: 63,
    feelsLikeC: fToC(63),
    condition: "Partly Cloudy",
    icon: "partly_cloudy_day",
    humidity: 78,
    dewPointF: 58,
    windMph: 12,
    windGustMph: 18,
    windDir: "NW",
    uvIndex: 2,
    aqi: 18,
    pressureHpa: 1016,
    visibilityMi: 10.0,
    cloudCover: 34,
    daylightLabel: "12h 18m",
    sunsetLabel: "19:24",
    precipRate: "0.00 in/hr",
    hourly,
    daily: [
      { day: "Today", icon: "partly_cloudy_day", precip: 10, low: 54, high: 68 },
      { day: "Thu", icon: "sunny", precip: 0, low: 55, high: 71 },
      { day: "Fri", icon: "cloud", precip: 20, low: 53, high: 64 },
      { day: "Sat", icon: "sunny", precip: 5, low: 56, high: 72 },
      { day: "Sun", icon: "partly_cloudy_day", precip: 10, low: 55, high: 69 },
    ],
  };
}

function formatHourLabel(hour24) {
  if (store.config.clockFormat === "24-hour") {
    return `${String(hour24).padStart(2, "0")}:00`;
  }
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12 || 12;
  return `${h} ${suffix}`;
}

function windCompass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((Number(deg) || 0) % 360) / 45) % 8];
}

export async function fetchWeather(lat = store.config.weatherLat, lon = store.config.weatherLon, city = store.config.weatherCity) {
  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,visibility,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;

    const [fRes, aqRes] = await Promise.all([
      fetch(forecastUrl),
      fetch(aqUrl).catch(() => null),
    ]);
    if (!fRes.ok) throw new Error("Weather unavailable");
    const f = await fRes.json();
    const aq = aqRes && aqRes.ok ? await aqRes.json() : null;

    const cur = f.current || {};
    const meta = weatherMeta(cur.weather_code);
    const nowIdx = Math.max(
      0,
      (f.hourly?.time || []).findIndex((t) => new Date(t).getTime() >= Date.now() - 3600_000)
    );
    const hourly = [];
    for (let i = 0; i < 8; i++) {
      const idx = nowIdx + i;
      const tStr = f.hourly?.time?.[idx];
      const dt = tStr ? new Date(tStr) : new Date(Date.now() + i * 3600_000);
      const hMeta = weatherMeta(f.hourly?.weather_code?.[idx]);
      hourly.push({
        label: i === 0 ? "NOW" : formatHourLabel(dt.getHours()),
        temp: Math.round(Number(f.hourly?.temperature_2m?.[idx] ?? cur.temperature_2m ?? 64)),
        icon: hMeta.icon,
        precipProb: Math.round(Number(f.hourly?.precipitation_probability?.[idx] ?? 0)),
        windSpeed: Math.round(Number(f.hourly?.wind_speed_10m?.[idx] ?? cur.wind_speed_10m ?? 10)),
      });
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daily = (f.daily?.time || []).slice(0, 6).map((dateStr, idx) => {
      const d = new Date(`${dateStr}T12:00:00`);
      const dMeta = weatherMeta(f.daily?.weather_code?.[idx]);
      return {
        day: idx === 0 ? "Today" : dayNames[d.getDay()],
        icon: dMeta.icon,
        precip: Math.round(Number(f.daily?.precipitation_probability_max?.[idx] ?? 0)),
        low: Math.round(Number(f.daily?.temperature_2m_min?.[idx] ?? 52)),
        high: Math.round(Number(f.daily?.temperature_2m_max?.[idx] ?? 68)),
      };
    });

    const visMeters = Number(f.hourly?.visibility?.[nowIdx] ?? 16093);
    const sunrise = f.daily?.sunrise?.[0] ? new Date(f.daily.sunrise[0]) : null;
    const sunset = f.daily?.sunset?.[0] ? new Date(f.daily.sunset[0]) : null;
    let daylightLabel = "12h 18m";
    let sunsetLabel = "19:24";
    if (sunrise && sunset) {
      const mins = Math.max(0, Math.round((sunset.getTime() - sunrise.getTime()) / 60000));
      daylightLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      sunsetLabel = `${String(sunset.getHours()).padStart(2, "0")}:${String(sunset.getMinutes()).padStart(2, "0")}`;
    }

    const tempF = Math.round(Number(cur.temperature_2m ?? 64));
    const feelsLikeF = Math.round(Number(cur.apparent_temperature ?? tempF));
    const humidity = Math.round(Number(cur.relative_humidity_2m ?? 65));
    const dewPointF = Math.round(tempF - (100 - humidity) / 5);

    store.weather = {
      live: true,
      city: city || store.config.weatherCity,
      lat,
      lon,
      tempF,
      tempC: fToC(tempF),
      feelsLikeF,
      feelsLikeC: fToC(feelsLikeF),
      condition: meta.label,
      icon: meta.icon,
      humidity,
      dewPointF,
      windMph: Math.round(Number(cur.wind_speed_10m ?? 10)),
      windGustMph: Math.round(Number(cur.wind_gusts_10m ?? 15)),
      windDir: windCompass(cur.wind_direction_10m),
      uvIndex: Math.round(Number(f.hourly?.uv_index?.[nowIdx] ?? f.daily?.uv_index_max?.[0] ?? 2)),
      aqi: Math.round(Number(aq?.current?.us_aqi ?? 22)),
      pressureHpa: Math.round(Number(cur.surface_pressure ?? 1016)),
      visibilityMi: Number((visMeters / 1609.34).toFixed(1)),
      cloudCover: Math.round(Number(cur.cloud_cover ?? 30)),
      daylightLabel,
      sunsetLabel,
      precipRate: `${Number(cur.precipitation ?? 0).toFixed(2)} in/hr`,
      hourly,
      daily,
    };
  } catch {
    if (!store.weather) {
      store.weather = buildFallbackWeather();
    }
  }
  notify("weather");
  return store.weather;
}

export async function geocodeCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Location lookup failed");
  const data = await res.json();
  return data.results || [];
}

export function sparklineSvg(points, color = "#82d8a6", width = 88, height = 28) {
  const safe = Array.isArray(points) && points.length > 1 ? points : [50, 50, 50];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = max - min || 1;
  const coords = safe.map((v, i) => {
    const x = (i / (safe.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="shrink-0 overflow-visible" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(" ")}" />
    </svg>
  `;
}

export async function bootstrapData() {
  await fetchConfig().catch(() => {});
  const tasks = [fetchWeather(), fetchStocks(), fetchSecurity()];
  if (features.devices) tasks.push(fetchHome(), fetchAutomations());
  if (features.media) tasks.push(fetchMedia());
  if (features.schedule) tasks.push(fetchSchedule());
  await Promise.allSettled(tasks);
}
