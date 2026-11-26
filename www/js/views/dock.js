import { controlMedia, escapeHtml, features, fToC, showToast, store } from "../api.js";

let clockTimer = null;
const WEST_LAFAYETTE_TIME_ZONE = "America/Indiana/Indianapolis";
const HOSUR_TIME_ZONE = "Asia/Kolkata";

function formatDockTime(date, timeZone) {
  const hour12 = store.config.clockFormat !== "24-hour";
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  }).formatToParts(date);
  return {
    time: parts.filter((part) => part.type === "hour" || part.type === "minute" || part.type === "literal")
      .map((part) => part.value)
      .join("")
      .trim(),
    period: parts.find((part) => part.type === "dayPeriod")?.value || "",
  };
}

function updateDockClock() {
  const now = new Date();
  const primary = formatDockTime(now, WEST_LAFAYETTE_TIME_ZONE);
  const hosur = formatDockTime(now, HOSUR_TIME_ZONE);
  const timeEl = document.getElementById("dockClockTime");
  const periodEl = document.getElementById("dockClockPeriod");
  const hosurTimeEl = document.getElementById("dockHosurTime");
  const hosurPeriodEl = document.getElementById("dockHosurPeriod");
  const dateEl = document.getElementById("dockClockDate");
  if (timeEl) {
    timeEl.textContent = primary.time;
    timeEl.dateTime = now.toISOString();
  }
  if (periodEl) periodEl.textContent = primary.period;
  if (hosurTimeEl) {
    hosurTimeEl.textContent = hosur.time;
    hosurTimeEl.dateTime = now.toISOString();
  }
  if (hosurPeriodEl) hosurPeriodEl.textContent = hosur.period;
  if (dateEl) {
    dateEl.textContent = new Intl.DateTimeFormat(undefined, {
      timeZone: WEST_LAFAYETTE_TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
  }
}

export function stopDockScreen() {
  if (clockTimer) window.clearInterval(clockTimer);
  clockTimer = null;
}

export function renderDockScreen(container, { navigate, toggleFullscreen }) {
  stopDockScreen();
  const devices = store.home?.items || [];
  const controllable = devices.filter((item) => !item.read_only);
  const activeDevices = controllable.filter((item) => item.state === "on");
  const weather = store.weather;
  const tempC = weather?.tempC ?? (typeof weather?.tempF === "number" ? fToC(weather.tempF) : "--");
  const primaryWeekday = new Intl.DateTimeFormat("en-US", {
    timeZone: WEST_LAFAYETTE_TIME_ZONE,
    weekday: "short",
  }).format(new Date());
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(primaryWeekday);
  const events = (store.schedule || [])
    .filter((event) => event.dayOffset === weekdayIndex || event.dayOffset === 0)
    .slice(0, 3);
  const media = store.media;
  const isPlaying = Boolean(media?.playing && media?.track?.title);

  container.innerHTML = `
    <section class="dock-screen" aria-labelledby="dockScreenTitle">
      <header class="dock-screen-toolbar">
        <h1 id="dockScreenTitle" class="dock-screen-brand">DockSpace</h1>
        <div class="flex items-center gap-2">
          <button id="dockFullscreenBtn" type="button" class="dock-screen-action">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">fullscreen</span>
            <span>Full screen</span>
          </button>
          <button id="dockBackBtn" type="button" class="dock-screen-action" aria-label="Return to dashboard">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
      </header>

      <div class="dock-screen-stage">
        <div class="dock-clock-block">
          <p id="dockClockDate" class="dock-clock-date"></p>
          <div class="dock-clock-pair">
            <section class="dock-clock-city" aria-labelledby="dockWestLafayetteLabel">
              <h2 id="dockWestLafayetteLabel" class="dock-city-label">West Lafayette</h2>
              <div class="flex items-end gap-3">
                <time id="dockClockTime" class="dock-clock-time tabular-nums"></time>
                <span id="dockClockPeriod" class="dock-clock-period"></span>
              </div>
            </section>
            <section class="dock-clock-city dock-clock-secondary" aria-labelledby="dockHosurLabel">
              <h2 id="dockHosurLabel" class="dock-city-label">Hosur</h2>
              <div class="flex items-end gap-3">
                <time id="dockHosurTime" class="dock-clock-time dock-clock-time-secondary tabular-nums"></time>
                <span id="dockHosurPeriod" class="dock-clock-period dock-clock-period-secondary"></span>
              </div>
            </section>
          </div>
          <p class="dock-clock-location">Indiana · Eastern Time <span aria-hidden="true">/</span> Tamil Nadu · IST</p>
        </div>

        <div class="dock-glance-panel">
          <section class="dock-glance-row" aria-labelledby="dockWeatherTitle">
            <div>
              <h2 id="dockWeatherTitle" class="dock-glance-label">Weather</h2>
              <p class="dock-glance-value">${escapeHtml(tempC)}°C</p>
              <p class="dock-glance-detail">${escapeHtml(weather?.condition || "Weather unavailable")} · ${escapeHtml(weather?.city || store.config.weatherCity)}</p>
            </div>
            <span class="material-symbols-outlined dock-weather-icon" aria-hidden="true">${escapeHtml(weather?.icon || "partly_cloudy_day")}</span>
          </section>

          ${
            features.devices
              ? `<section class="dock-glance-row" aria-labelledby="dockHomeTitle">
            <div>
              <h2 id="dockHomeTitle" class="dock-glance-label">Smart home</h2>
              <p class="dock-glance-value">${activeDevices.length}<span class="dock-glance-unit"> on</span></p>
              <p class="dock-glance-detail">${controllable.length} connected devices</p>
            </div>
            <span class="material-symbols-outlined dock-glance-icon" aria-hidden="true">home_iot_device</span>
          </section>`
              : ""
          }

          ${
            features.media
              ? `<section class="dock-glance-row" aria-labelledby="dockMediaTitle">
            <div class="min-w-0">
              <h2 id="dockMediaTitle" class="dock-glance-label">${isPlaying ? "Now playing" : "Media"}</h2>
              <p class="dock-media-title">${escapeHtml(isPlaying ? media.track.title : "Nothing playing")}</p>
              <p class="dock-glance-detail truncate">${escapeHtml(isPlaying ? media.track.artist : "Ready on this Mac")}</p>
              <div class="dock-media-controls" aria-label="Mac media controls">
                <button type="button" data-dock-media="prev" aria-label="Previous track">
                  <span class="material-symbols-outlined" aria-hidden="true">skip_previous</span>
                </button>
                <button type="button" data-dock-media="toggle" aria-label="${isPlaying ? "Pause" : "Play"}">
                  <span class="material-symbols-outlined is-filled" aria-hidden="true">${isPlaying ? "pause" : "play_arrow"}</span>
                </button>
                <button type="button" data-dock-media="next" aria-label="Next track">
                  <span class="material-symbols-outlined" aria-hidden="true">skip_next</span>
                </button>
              </div>
            </div>
            <span class="material-symbols-outlined dock-glance-icon" aria-hidden="true">${isPlaying ? "graphic_eq" : "music_note"}</span>
          </section>`
              : ""
          }
        </div>
      </div>

      <footer class="dock-screen-footer">
        ${
          features.schedule
            ? `<section aria-labelledby="dockNextTitle" class="min-w-0">
          <h2 id="dockNextTitle" class="dock-glance-label">Coming up</h2>
          ${events.length ? `
            <div class="dock-event-list">
              ${events.map((event) => `
                <div class="dock-event-item">
                  <span class="dock-event-time tabular-nums">${escapeHtml(event.time || event.timeLabel || "Today")}</span>
                  <span class="dock-event-title">${escapeHtml(event.title)}</span>
                </div>`).join("")}
            </div>` : `<p class="dock-event-empty">No more scheduled events today</p>`}
        </section>`
            : `<span></span>`
        }
        <p class="dock-screen-hint">Press Esc to leave full screen</p>
      </footer>
    </section>`;

  container.querySelector("#dockFullscreenBtn")?.addEventListener("click", toggleFullscreen);
  container.querySelector("#dockBackBtn")?.addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    navigate("/");
  });
  container.querySelectorAll("[data-dock-media]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await controlMedia({ action: button.getAttribute("data-dock-media") });
      } catch (err) {
        showToast(err.message || "Mac media controls are unavailable", "error");
      }
    });
  });
  updateDockClock();
  clockTimer = window.setInterval(updateDockClock, 1_000);
}
