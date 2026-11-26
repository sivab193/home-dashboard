import {
  addScheduleEvent,
  commandHomeEntity,
  controlMedia,
  escapeHtml,
  features,
  fToC,
  formatDuration,
  logActivity,
  showToast,
  sparklineSvg,
  store,
  updateConfig,
} from "../api.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORLD_CLOCK_PRESETS = [
  { label: "West Lafayette", timeZone: "America/New_York" },
  { label: "San Francisco", timeZone: "America/Los_Angeles" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "Chicago", timeZone: "America/Chicago" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Paris", timeZone: "Europe/Paris" },
  { label: "Dubai", timeZone: "Asia/Dubai" },
  { label: "Hosur", timeZone: "Asia/Kolkata" },
  { label: "Bengaluru", timeZone: "Asia/Kolkata" },
  { label: "Singapore", timeZone: "Asia/Singapore" },
  { label: "Tokyo", timeZone: "Asia/Tokyo" },
  { label: "Sydney", timeZone: "Australia/Sydney" },
  { label: "Toronto", timeZone: "America/Toronto" },
  { label: "UTC", timeZone: "UTC" },
];

let selectedCalDay = new Date().getDate();

function formatClockZone(tz, clockFormat) {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: clockFormat !== "24-hour",
  }).format(now);
  const localDay = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const zoneDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const dayTag = zoneDay === localDay ? "Today" : zoneDay > localDay ? "Tomorrow" : "Yesterday";
  const tzShort =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value || "";
  return { timeStr, dayTag, tzShort };
}

function formatEventTime(startHour, durationHours, clockFormat) {
  const fmt = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    if (clockFormat === "24-hour") {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    const suffix = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(startHour)} – ${fmt(startHour + durationHours)}`;
}

function renderMiniCalendar(events) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthTitle = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Map day-of-week offsets (0=Sun..6=Sat) that have scheduled events
  const activeDows = new Set(events.map((e) => e.dayOffset));
  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(`<div class="h-8"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = (firstDow + day - 1) % 7;
    const isToday = day === todayDate;
    const isSelected = day === selectedCalDay;
    const hasEvent = activeDows.has(dow);
    cells.push(`
      <button type="button" data-cal-day="${day}" aria-pressed="${isSelected}" class="relative h-8 rounded text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
        isToday
          ? "bg-primary-container text-on-primary-container font-semibold"
          : isSelected
          ? "bg-primary-soft border border-primary-container/50 text-primary font-semibold"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      }">
        <span>${day}</span>
        ${
          hasEvent
            ? `<span class="w-1 h-1 rounded-full ${
                isToday ? "bg-on-primary-container" : "bg-tertiary"
              } absolute bottom-1"></span>`
            : ""
        }
      </button>
    `);
  }

  return `
    <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="font-headline text-xs font-semibold text-on-surface">${monthTitle}</span>
        <span class="font-mono text-[10px] text-on-surface-variant uppercase">${DAY_NAMES[now.getDay()]} · Day ${selectedCalDay}</span>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-on-surface-variant mb-1">
        ${DAY_NAMES.map((d) => `<span>${d[0]}</span>`).join("")}
      </div>
      <div class="grid grid-cols-7 gap-1">${cells.join("")}</div>
    </div>
  `;
}

export function renderHomeView(container, { navigate, openQuickFind, openAlerts, openModal }) {
  const cfg = store.config;
  const allItems = store.home?.items || [];
  const controllableDevices = allItems.filter((item) => !item.read_only && item.type !== "sensor");
  const configuredIds = Array.isArray(cfg.homeQuickDeviceIds) ? cfg.homeQuickDeviceIds : [];
  const quickDevices =
    configuredIds.length > 0
      ? controllableDevices.filter((d) => configuredIds.includes(d.id))
      : controllableDevices;
  const activeDevices = controllableDevices.filter((d) => d.state === "on");

  const weather = store.weather;
  const tempF = weather ? weather.tempF : 64;
  const tempC = weather?.tempC ?? fToC(tempF);
  const feelsF = weather?.feelsLikeF ?? tempF;
  const feelsC = weather?.feelsLikeC ?? fToC(feelsF);
  const todayDaily = weather?.daily?.[0];
  const highC = todayDaily ? fToC(todayDaily.high) : tempC + 3;
  const lowC = todayDaily ? fToC(todayDaily.low) : tempC - 4;
  const highF = todayDaily ? todayDaily.high : tempF + 5;
  const lowF = todayDaily ? todayDaily.low : tempF - 7;

  const media = store.media;
  const track = media?.track;
  const mediaPct =
    track && track.durationSec ? Math.min(100, (media.positionSec / track.durationSec) * 100) : 0;

  const worldClocks = (Array.isArray(cfg.worldClocks) && cfg.worldClocks.length
    ? cfg.worldClocks
    : WORLD_CLOCK_PRESETS.slice(0, 5)
  ).slice(0, 5);

  const now = new Date();
  const selectedDateObj = new Date(now.getFullYear(), now.getMonth(), selectedCalDay);
  const selectedDow = selectedDateObj.getDay();
  const allEvents = store.schedule || [];
  const dayEvents = allEvents.filter((e) => e.dayOffset === selectedDow);
  const displayEvents = dayEvents.length ? dayEvents : allEvents.slice(0, 4);

  const unreadAlerts =
    (store.activityLog?.filter((a) => !a.read).length || 0) +
    (store.calendar?.unread || 0) +
    (store.events?.length || 0);
  const stocks = store.stocks?.items || [];

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">DOCKSPACE</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${escapeHtml(cfg.userName)}</span>
            ${
              features.devices
                ? `<span class="mx-1.5 text-outline-strong">·</span>
            <span id="homeHeaderActiveCount" class="text-tertiary">${activeDevices.length} Active Devices</span>`
                : `<span class="mx-1.5 text-outline-strong">·</span>
            <span class="text-tertiary">${escapeHtml(cfg.studioName || "Home")}</span>`
            }
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Home</h1>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="homeQuickFindBtn" type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
            <span>Quick Find</span>
            <kbd class="ml-1 font-mono text-[10px] text-on-surface-variant">⌘K</kbd>
          </button>
          <button id="homeAlertsBtn" type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">notifications</span>
            <span>Alerts</span>
            ${unreadAlerts > 0 ? `<span class="w-2 h-2 rounded-full bg-primary-container"></span>` : ""}
          </button>
        </div>
      </div>

      <!-- Row 1: Live Weather (°C with small °F) + Optional Now Playing Media Deck -->
      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4" aria-label="Weather and Media overview">
        <!-- Live Weather Card -->
        <article class="${features.media ? "xl:col-span-6" : "xl:col-span-12"} dock-surface-card rounded-lg p-5 flex flex-col justify-between gap-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[22px] text-primary-container">${escapeHtml(weather?.icon || "partly_cloudy_day")}</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="font-headline text-[15px] font-semibold text-on-surface">${escapeHtml(weather?.city || cfg.weatherCity)}</h2>
                  <span class="px-1.5 py-0.5 rounded bg-primary-soft text-primary border border-primary-container/30 font-mono text-[10px] uppercase">${weather?.live ? "Live" : "Cached"}</span>
                </div>
                <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(weather?.condition || "Partly Cloudy")} · Feels ${feelsC}°C <span class="opacity-70">(${feelsF}°F)</span></p>
              </div>
            </div>
            <button type="button" data-go="/weather" class="inline-flex items-center gap-1 text-xs font-medium text-primary-container hover:text-primary transition-colors shrink-0">
              <span>Forecast</span>
              <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>

          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="flex items-baseline gap-2.5">
              <span id="homeTempC" class="font-mono text-4xl font-semibold text-on-surface tracking-tight tabular-nums">${tempC}°C</span>
              <span id="homeTempF" class="font-mono text-sm text-on-surface-variant tabular-nums">${tempF}°F</span>
            </div>
            ${sparklineSvg((weather?.hourly || []).slice(0, 7).map((h) => h.temp), "#82d8a6", 112, 32)}
          </div>

          <div class="grid grid-cols-4 gap-2 pt-1 border-t border-outline/60 font-mono text-[11px] tabular-nums">
            <div>
              <p class="text-[10px] text-on-surface-variant uppercase">High / Low</p>
              <p class="text-on-surface mt-0.5">${highC}°/${lowC}°C <span class="text-[10px] text-on-surface-variant">${highF}°/${lowF}°F</span></p>
            </div>
            <div>
              <p class="text-[10px] text-on-surface-variant uppercase">Humidity</p>
              <p class="text-on-surface mt-0.5">${weather?.humidity ?? 78}%</p>
            </div>
            <div>
              <p class="text-[10px] text-on-surface-variant uppercase">Wind</p>
              <p class="text-on-surface mt-0.5">${weather?.windMph ?? 12} mph ${weather?.windDir || "NW"}</p>
            </div>
            <div>
              <p class="text-[10px] text-on-surface-variant uppercase">Air Quality</p>
              <p class="text-tertiary mt-0.5">${weather?.aqi ?? 18} AQI</p>
            </div>
          </div>
        </article>

        ${
          features.media
            ? `<!-- Now Playing & Media Controls Card -->
        <article class="xl:col-span-6 dock-surface-card rounded-lg p-5 flex flex-col justify-between gap-4" style="background-image: radial-gradient(circle at 18% 45%, rgba(255, 99, 112, 0.1), transparent 58%);">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="w-12 h-12 rounded-md bg-surface-container-lowest border border-outline flex items-center justify-center shrink-0 overflow-hidden">
                <div class="flex items-center gap-[3px] h-6 ${media?.playing ? "eq-playing" : "eq-paused"}" aria-hidden="true">
                  <span class="eq-bar w-[3px] h-4 rounded-full bg-primary-container" style="--eq-dur:0.85s;--eq-delay:0s"></span>
                  <span class="eq-bar w-[3px] h-6 rounded-full bg-primary-container" style="--eq-dur:1.05s;--eq-delay:0.12s"></span>
                  <span class="eq-bar w-[3px] h-3 rounded-full bg-primary-container" style="--eq-dur:0.78s;--eq-delay:0.24s"></span>
                  <span class="eq-bar w-[3px] h-5 rounded-full bg-primary-container" style="--eq-dur:0.95s;--eq-delay:0.18s"></span>
                </div>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px] uppercase tracking-wider ${media?.playing ? "text-tertiary" : "text-on-surface-variant"}">${
                    media?.playing ? "NOW PLAYING" : "PAUSED"
                  }</span>
                  <span class="font-mono text-[10px] text-on-surface-variant">· ${escapeHtml(media?.outputLabel || "AirPods Pro")}</span>
                </div>
                <h2 id="homeMediaTitle" class="font-headline text-lg font-semibold text-on-surface truncate mt-0.5">${escapeHtml(track?.title || "No Track Selected")}</h2>
                <p class="text-xs text-on-surface-variant truncate">${escapeHtml(track?.artist || "Studio Ambient")} · ${escapeHtml(track?.album || "Lossless")}</p>
              </div>
            </div>
            <button type="button" data-go="/media" class="inline-flex items-center gap-1 text-xs font-medium text-primary-container hover:text-primary transition-colors shrink-0">
              <span>Queue</span>
              <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>

          <!-- Progress + Inline Transport Controls -->
          <div class="space-y-3">
            <div class="space-y-1">
              <div class="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full bg-primary-container transition-all" style="width:${mediaPct.toFixed(1)}%"></div>
              </div>
              <div class="flex items-center justify-between font-mono text-[10.5px] text-on-surface-variant tabular-nums">
                <span>${formatDuration(media?.positionSec || 0)}</span>
                <span>${formatDuration(track?.durationSec || 0)}</span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <button id="homeMediaPrevBtn" type="button" class="w-9 h-9 rounded-md bg-surface-container-high border border-outline text-on-surface hover:bg-surface-bright flex items-center justify-center transition-colors" aria-label="Previous track">
                  <span class="material-symbols-outlined text-[20px]">skip_previous</span>
                </button>
                <button id="homeMediaPlayBtn" type="button" class="w-10 h-9 rounded-md bg-primary-container text-on-primary-container hover:brightness-110 flex items-center justify-center transition-all" aria-label="${
                  media?.playing ? "Pause playback" : "Play playback"
                }">
                  <span class="material-symbols-outlined is-filled text-[22px]">${media?.playing ? "pause" : "play_arrow"}</span>
                </button>
                <button id="homeMediaNextBtn" type="button" class="w-9 h-9 rounded-md bg-surface-container-high border border-outline text-on-surface hover:bg-surface-bright flex items-center justify-center transition-colors" aria-label="Next track">
                  <span class="material-symbols-outlined text-[20px]">skip_next</span>
                </button>
              </div>

              <div class="flex items-center gap-2 font-mono text-[11px] text-on-surface-variant">
                <span class="material-symbols-outlined text-[16px]">volume_up</span>
                <span class="tabular-nums text-on-surface">${media?.volume ?? 68}%</span>
              </div>
            </div>
          </div>
        </article>` : ""
        }
      </section>

      <!-- Row 2: 5 World Clocks -->
      <section class="dock-surface-card rounded-lg p-4 space-y-3" aria-label="World clocks">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary">public</span>
            <h2 class="font-headline text-sm font-semibold text-on-surface">World Clocks</h2>
            <span class="font-mono text-[10.5px] text-on-surface-variant">· 5 ZONES</span>
          </div>
          <button id="homeEditClocksBtn" type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high border border-outline text-[11px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors">
            <span class="material-symbols-outlined text-[14px]">edit</span>
            <span>Edit Clocks</span>
          </button>
        </div>

        <div id="homeWorldClocksGrid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          ${worldClocks
            .map((clock) => {
              const formatted = formatClockZone(clock.timeZone, cfg.clockFormat);
              return `
              <div class="rounded-md bg-surface-container-lowest/85 border border-outline/75 px-3.5 py-3 flex flex-col justify-between gap-1.5">
                <div class="flex items-center justify-between gap-1">
                  <span class="text-xs font-medium text-on-surface truncate">${escapeHtml(clock.label)}</span>
                  <span class="font-mono text-[10px] text-on-surface-variant shrink-0">${escapeHtml(formatted.tzShort)}</span>
                </div>
                <p class="font-mono text-lg font-medium text-on-surface tabular-nums">${formatted.timeStr}</p>
                <span class="font-mono text-[10px] ${
                  formatted.dayTag === "Today" ? "text-tertiary" : "text-primary"
                }">${formatted.dayTag}</span>
              </div>
            `;
            })
            .join("")}
        </div>
      </section>

      ${
        features.devices || features.schedule
          ? `<!-- Row 3: Configurable Device Quick-Switch Board + Calendar & Schedule -->
      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        ${
          features.devices
            ? `<!-- Quick Device Controls (Configurable On/Off Buttons) -->
        <div class="${features.schedule ? "xl:col-span-7" : "xl:col-span-12"} dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[19px] text-primary-container">power_settings_new</span>
              <div>
                <h2 class="font-headline text-[15px] font-semibold text-on-surface">Device Controls</h2>
                <p class="text-xs text-on-surface-variant">${quickDevices.filter((d) => d.state === "on").length} of ${quickDevices.length} selected devices active</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <button id="homeDevicesAllOn" type="button" class="px-2.5 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-tertiary hover:bg-surface-bright transition-colors">All On</button>
              <button id="homeDevicesAllOff" type="button" class="px-2.5 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors">All Off</button>
              <button id="homeConfigureDevicesBtn" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary-soft border border-primary-container/40 text-xs font-medium text-primary hover:bg-primary-container hover:text-on-primary-container transition-colors">
                <span class="material-symbols-outlined text-[14px]">tune</span>
                <span>Configure</span>
              </button>
            </div>
          </div>

          <div id="homeDeviceSwitchGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            ${
              quickDevices.length
                ? quickDevices
                    .map((dev) => {
                      const isOn = dev.state === "on";
                      const icon = dev.type === "light" ? "lightbulb" : dev.type === "fan" ? "mode_fan" : "power";
                      const detail =
                        dev.type === "light"
                          ? isOn
                            ? `${dev.attributes?.brightness_pct ?? 80}% · ${dev.attributes?.color_temp_kelvin ?? 3200}K`
                            : "Off"
                          : typeof dev.attributes?.power === "number" && isOn
                          ? `${dev.attributes.power.toFixed(1)}W`
                          : isOn
                          ? "Active"
                          : "Standby";
                      return `
                      <button type="button" data-quick-device="${escapeHtml(dev.id)}" data-quick-state="${escapeHtml(dev.state)}" aria-pressed="${isOn}" class="rounded-lg p-3.5 text-left border transition-all flex flex-col justify-between gap-3 ${
                        isOn
                          ? "bg-primary-soft/45 border-primary-container/60 hover:bg-primary-soft/60"
                          : "bg-surface-container-lowest/85 border-outline hover:border-outline-strong hover:bg-surface-container-high/50"
                      }">
                        <div class="flex items-center justify-between gap-2 w-full">
                          <span class="w-8 h-8 rounded-md border flex items-center justify-center shrink-0 ${
                            isOn
                              ? "bg-primary-container border-primary-container text-on-primary-container"
                              : "bg-surface-container-high border-outline text-on-surface-variant"
                          }">
                            <span class="material-symbols-outlined text-[18px]">${icon}</span>
                          </span>
                          <span class="px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase ${
                            isOn
                              ? "bg-tertiary-container/25 text-tertiary border border-tertiary/35"
                              : "bg-surface-container-high text-on-surface-variant border border-outline"
                          }">${isOn ? "ON" : "OFF"}</span>
                        </div>
                        <div class="min-w-0">
                          <p class="text-[13px] font-semibold text-on-surface truncate">${escapeHtml(dev.name)}</p>
                          <p class="font-mono text-[10.5px] text-on-surface-variant truncate mt-0.5">${escapeHtml(dev.room)} · ${escapeHtml(detail)}</p>
                        </div>
                      </button>
                    `;
                    })
                    .join("")
                : `<div class="col-span-full py-8 text-center space-y-2">
                    <p class="text-xs text-on-surface-variant">No devices selected for quick controls.</p>
                    <button type="button" id="homeEmptyConfigBtn" class="px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-xs font-semibold">Choose Devices</button>
                  </div>`
            }
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-outline/60 text-xs">
            <button type="button" data-go="/floorplan" class="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors">
              <span class="material-symbols-outlined text-[15px]">view_in_ar</span>
              <span>Open 3D Floorplan</span>
            </button>
            <button type="button" data-go="/controls" class="inline-flex items-center gap-1 text-primary-container hover:text-primary font-medium transition-colors">
              <span>All Room Controls</span>
              <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
        </div>` : ""
        }

        ${
          features.schedule
            ? `<!-- Calendar & Schedule Panel -->
        <div class="${features.devices ? "xl:col-span-5" : "xl:col-span-12"} dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[19px] text-primary-container">calendar_month</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Calendar &amp; Schedule</h2>
            </div>
            <div class="flex items-center gap-2">
              <button id="homeAddEventBtn" type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">
                <span class="material-symbols-outlined text-[14px]">add</span>
                <span>Event</span>
              </button>
              <button type="button" data-go="/schedule" class="inline-flex items-center gap-1 text-xs font-medium text-primary-container hover:text-primary">
                <span>Week</span>
                <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            </div>
          </div>

          ${renderMiniCalendar(allEvents)}

          <div class="space-y-2">
            <div class="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-wider text-on-surface-variant">
              <span>${dayEvents.length ? `${DAY_NAMES[selectedDow]} SCHEDULE` : "UPCOMING SCHEDULE"}</span>
              <span>${displayEvents.length} ITEMS</span>
            </div>

            <div class="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              ${displayEvents
                .map((ev) => {
                  const accent =
                    ev.category === "climate"
                      ? "border-l-tertiary"
                      : ev.category === "shift"
                      ? "border-l-primary-container"
                      : "border-l-secondary";
                  return `
                  <div class="rounded bg-surface-container-lowest/85 border border-outline/70 border-l-2 ${accent} px-3 py-2 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-on-surface truncate">${escapeHtml(ev.title)}</p>
                      <p class="font-mono text-[10.5px] text-on-surface-variant truncate">${escapeHtml(ev.subtitle)}</p>
                    </div>
                    <span class="font-mono text-[10.5px] text-primary shrink-0 tabular-nums">${formatEventTime(
                      ev.startHour,
                      ev.durationHours,
                      cfg.clockFormat
                    )}</span>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>
        </div>` : ""
        }
      </section>` : ""
      }

      <!-- Row 4: Compact Market Watchlist -->
      <section class="dock-surface-card rounded-lg p-4" aria-label="Market watchlist">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[17px] text-primary-container">show_chart</span>
            <h2 class="font-headline text-sm font-semibold text-on-surface">Market Watchlist</h2>
          </div>
          <button type="button" data-go="/configure-widget" class="font-mono text-[11px] text-on-surface-variant hover:text-on-surface">Edit Symbols</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          ${
            stocks.length
              ? stocks
                  .slice(0, 6)
                  .map((s) => {
                    const available = s.available !== false && typeof s.price === "number";
                    const up = Number(s.change_pct ?? 0) >= 0;
                    return `
                    <div class="rounded bg-surface-container-lowest/80 border border-outline/70 px-3 py-2">
                      <div class="flex items-center justify-between gap-1">
                        <span class="font-mono text-xs font-semibold text-on-surface">${escapeHtml(s.symbol)}</span>
                        <span class="font-mono text-[10px] ${
                          available ? (up ? "text-tertiary" : "text-primary-container") : "text-on-surface-variant"
                        } tabular-nums">${available ? `${up ? "+" : ""}${Number(s.change_pct ?? 0).toFixed(2)}%` : "—"}</span>
                      </div>
                      <p class="font-mono text-sm text-on-surface mt-0.5 tabular-nums">${
                        available ? `$${Number(s.price).toFixed(2)}` : "Offline"
                      }</p>
                    </div>
                  `;
                  })
                  .join("")
              : `<div class="col-span-full text-xs font-mono text-on-surface-variant py-1">${
                  store.stocks?.loaded ? "Market feed unavailable" : "Fetching live market quotes…"
                }</div>`
          }
        </div>
      </section>
    </div>
  `;

  // Navigation & shell actions
  container.querySelector("#homeQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#homeAlertsBtn")?.addEventListener("click", openAlerts);
  container.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.getAttribute("data-go")));
  });

  // Inline Media Controls
  const runMedia = async (action) => {
    try {
      await controlMedia({ action });
    } catch (err) {
      showToast(err.message || "Media control failed", "error");
    }
  };
  container.querySelector("#homeMediaPrevBtn")?.addEventListener("click", () => runMedia("prev"));
  container.querySelector("#homeMediaPlayBtn")?.addEventListener("click", () => runMedia("toggle"));
  container.querySelector("#homeMediaNextBtn")?.addEventListener("click", () => runMedia("next"));

  // Quick Device Switchboard
  container.querySelectorAll("[data-quick-device]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-quick-device");
      const current = btn.getAttribute("data-quick-state");
      const nextAction = current === "on" ? "turn_off" : "turn_on";
      const dev = controllableDevices.find((d) => d.id === id);
      try {
        await commandHomeEntity(id, nextAction);
        logActivity(
          `${dev?.name || id} turned ${nextAction === "turn_on" ? "on" : "off"}`,
          `${dev?.room || "Home"} quick switch`,
          "ok"
        );
        showToast(`${dev?.name || "Device"} ${nextAction === "turn_on" ? "turned on" : "turned off"}`, "ok");
      } catch (err) {
        showToast(err.message || "Device toggle failed", "error");
      }
    });
  });

  container.querySelector("#homeDevicesAllOn")?.addEventListener("click", async () => {
    if (!quickDevices.length) return;
    try {
      await Promise.all(quickDevices.map((d) => commandHomeEntity(d.id, "turn_on")));
      showToast(`Turned on ${quickDevices.length} configured devices`, "ok");
    } catch (err) {
      showToast(err.message || "Could not switch devices on", "error");
    }
  });

  container.querySelector("#homeDevicesAllOff")?.addEventListener("click", async () => {
    if (!quickDevices.length) return;
    try {
      await Promise.all(quickDevices.map((d) => commandHomeEntity(d.id, "turn_off")));
      showToast(`Turned off ${quickDevices.length} configured devices`, "ok");
    } catch (err) {
      showToast(err.message || "Could not switch devices off", "error");
    }
  });

  // Configure Devices Modal
  const openConfigureDevices = () => {
    const activeSelection = new Set(
      configuredIds.length > 0 ? configuredIds : controllableDevices.map((d) => d.id)
    );
    openModal({
      title: "Configure Homepage Devices",
      submitLabel: "Save Devices",
      bodyHtml: `
        <div class="space-y-2.5">
          <p class="text-xs text-on-surface-variant">Select which devices show quick On/Off switches on your Home dashboard:</p>
          <div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            ${controllableDevices
              .map(
                (dev) => `
              <label class="flex items-center justify-between gap-3 px-3 py-2.5 rounded bg-surface-container-lowest border border-outline cursor-pointer hover:border-outline-strong">
                <div class="flex items-center gap-2.5 min-w-0">
                  <input type="checkbox" name="deviceIds" value="${escapeHtml(dev.id)}" ${
                  activeSelection.has(dev.id) ? "checked" : ""
                } class="w-4 h-4 accent-[#ff6370]" />
                  <div class="min-w-0">
                    <p class="text-xs font-medium text-on-surface truncate">${escapeHtml(dev.name)}</p>
                    <p class="font-mono text-[10px] text-on-surface-variant">${escapeHtml(dev.room)} · ${escapeHtml(dev.type)}</p>
                  </div>
                </div>
                <span class="font-mono text-[10px] uppercase ${
                  dev.state === "on" ? "text-tertiary" : "text-on-surface-variant"
                }">${dev.state}</span>
              </label>
            `
              )
              .join("")}
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        const picked = formData.getAll("deviceIds").map(String);
        if (!picked.length) {
          throw new Error("Select at least one device to display");
        }
        await updateConfig({ homeQuickDeviceIds: picked });
        showToast(`Configured ${picked.length} homepage devices`, "ok");
      },
    });
  };
  container.querySelector("#homeConfigureDevicesBtn")?.addEventListener("click", openConfigureDevices);
  container.querySelector("#homeEmptyConfigBtn")?.addEventListener("click", openConfigureDevices);

  // Edit 5 World Clocks Modal
  container.querySelector("#homeEditClocksBtn")?.addEventListener("click", () => {
    openModal({
      title: "Configure 5 World Clocks",
      submitLabel: "Save Clocks",
      bodyHtml: `
        <div class="space-y-3">
          ${Array.from({ length: 5 }, (_, idx) => {
            const cur = worldClocks[idx] || WORLD_CLOCK_PRESETS[idx];
            return `
              <div class="grid grid-cols-12 gap-2 items-center">
                <span class="col-span-1 font-mono text-xs text-on-surface-variant">#${idx + 1}</span>
                <input name="clockLabel_${idx}" type="text" required value="${escapeHtml(cur.label)}" aria-label="Clock ${idx + 1} label" class="col-span-5 px-2.5 py-1.5 rounded bg-surface-container-lowest border border-outline text-xs text-on-surface focus:border-primary-container focus:outline-none" />
                <select name="clockTz_${idx}" aria-label="Clock ${idx + 1} timezone" class="col-span-6 px-2.5 py-1.5 rounded bg-surface-container-lowest border border-outline font-mono text-xs text-on-surface focus:border-primary-container focus:outline-none">
                  ${WORLD_CLOCK_PRESETS.map(
                    (p) =>
                      `<option value="${p.timeZone}" ${p.timeZone === cur.timeZone ? "selected" : ""}>${p.label} (${p.timeZone})</option>`
                  ).join("")}
                </select>
              </div>
            `;
          }).join("")}
        </div>
      `,
      onSubmit: async (formData) => {
        const nextClocks = Array.from({ length: 5 }, (_, idx) => ({
          label: String(formData.get(`clockLabel_${idx}`) || "").trim() || WORLD_CLOCK_PRESETS[idx].label,
          timeZone: String(formData.get(`clockTz_${idx}`) || WORLD_CLOCK_PRESETS[idx].timeZone),
        }));
        await updateConfig({ worldClocks: nextClocks });
        showToast("5 world clocks updated", "ok");
      },
    });
  });

  // Mini Calendar day selection
  container.querySelectorAll("[data-cal-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCalDay = Number(btn.getAttribute("data-cal-day")) || now.getDate();
      renderHomeView(container, { navigate, openQuickFind, openAlerts, openModal });
    });
  });

  // Quick Add Schedule Event from Homepage
  container.querySelector("#homeAddEventBtn")?.addEventListener("click", () => {
    openModal({
      title: "Add Calendar Event",
      submitLabel: "Add Event",
      bodyHtml: `
        <div class="space-y-3">
          <div>
            <label for="homeEvtTitle" class="block text-xs font-medium text-on-surface-variant mb-1">Event title</label>
            <input id="homeEvtTitle" name="title" type="text" required placeholder="e.g. Design Review" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="homeEvtDay" class="block text-xs font-medium text-on-surface-variant mb-1">Day</label>
              <select id="homeEvtDay" name="dayOffset" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface">
                ${DAY_NAMES.map((d, i) => `<option value="${i}" ${i === selectedDow ? "selected" : ""}>${d}</option>`).join("")}
              </select>
            </div>
            <div>
              <label for="homeEvtStart" class="block text-xs font-medium text-on-surface-variant mb-1">Start hour</label>
              <input id="homeEvtStart" name="startHour" type="number" min="7" max="22" step="0.5" value="15" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline font-mono text-sm text-on-surface" />
            </div>
          </div>
          <div>
            <label for="homeEvtNote" class="block text-xs font-medium text-on-surface-variant mb-1">Notes</label>
            <input id="homeEvtNote" name="subtitle" type="text" placeholder="Optional details" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface" />
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        await addScheduleEvent({
          title: formData.get("title"),
          dayOffset: Number(formData.get("dayOffset")),
          startHour: Number(formData.get("startHour")),
          durationHours: 1,
          category: "studio",
          subtitle: formData.get("subtitle"),
        });
        showToast("Added event to schedule", "ok");
      },
    });
  });
}
