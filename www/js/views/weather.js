import {
  escapeHtml,
  fetchWeather,
  geocodeCity,
  showToast,
  sparklineSvg,
  store,
  updateConfig,
} from "../api.js";

let selectedHourIndex = 0;
let radarLayer = "precip"; // precip | wind | temp

function hourlyCurveSvg(hourly, activeIndex) {
  const temps = hourly.map((h) => h.temp);
  const min = Math.min(...temps) - 2;
  const max = Math.max(...temps) + 2;
  const span = max - min || 1;
  const W = 560;
  const H = 112;
  const padX = 24;
  const pts = hourly.map((h, i) => {
    const x = padX + (i / Math.max(1, hourly.length - 1)) * (W - padX * 2);
    const y = H - 16 - ((h.temp - min) / span) * (H - 34);
    return { x, y };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
  const active = pts[activeIndex] || pts[0];

  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-32 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="tempCurveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff6370" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#ff6370" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#tempCurveFill)" />
      <path d="${linePath}" fill="none" stroke="#ffb3b4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="${active.x.toFixed(1)}" y1="${active.y.toFixed(1)}" x2="${active.x.toFixed(1)}" y2="${H}" stroke="#ff6370" stroke-opacity="0.45" stroke-dasharray="3 3" />
      <circle cx="${active.x.toFixed(1)}" cy="${active.y.toFixed(1)}" r="4.5" fill="#ff6370" stroke="#1a1c1e" stroke-width="2" />
    </svg>
  `;
}

function radarSvg(weather, layer) {
  const palette =
    layer === "wind"
      ? { glow: "#82d8a6", stroke: "#82d8a6", badge: "WIND LAYER", metric: `${weather.windMph} mph ${weather.windDir}` }
      : layer === "temp"
      ? { glow: "#f5bb5c", stroke: "#f5bb5c", badge: "THERMAL LAYER", metric: `${weather.tempF}°F surface` }
      : { glow: "#ff6370", stroke: "#ff6370", badge: "PRECIP LAYER", metric: weather.precipRate };

  return `
    <div class="relative rounded-md overflow-hidden border border-outline bg-[#0e1217] h-56 select-none">
      <svg viewBox="0 0 420 220" class="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="radarCell1" cx="46%" cy="48%" r="42%">
            <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.46" />
            <stop offset="60%" stop-color="${palette.glow}" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#0e1217" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="radarCell2" cx="72%" cy="32%" r="30%">
            <stop offset="0%" stop-color="#82d8a6" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#0e1217" stop-opacity="0" />
          </radialGradient>
        </defs>
        <!-- Stylized dark topo / coastline grid -->
        <rect width="420" height="220" fill="#10151c" />
        <path d="M0 155 Q70 130 135 148 T270 120 T420 142 L420 220 L0 220 Z" fill="#161d26" />
        <path d="M120 0 L150 65 L125 135 L165 220 L0 220 L0 0 Z" fill="#131922" opacity="0.8" />
        <!-- Latitude / Longitude telemetry grid -->
        <g stroke="#2a323d" stroke-width="0.7" opacity="0.65">
          <line x1="0" y1="55" x2="420" y2="55" />
          <line x1="0" y1="110" x2="420" y2="110" />
          <line x1="0" y1="165" x2="420" y2="165" />
          <line x1="105" y1="0" x2="105" y2="220" />
          <line x1="210" y1="0" x2="210" y2="220" />
          <line x1="315" y1="0" x2="315" y2="220" />
        </g>
        <!-- Concentric Doppler Range Rings -->
        <g stroke="${palette.stroke}" stroke-opacity="0.25" fill="none" stroke-dasharray="3 4">
          <circle cx="210" cy="110" r="34" />
          <circle cx="210" cy="110" r="68" />
          <circle cx="210" cy="110" r="102" />
        </g>
        <!-- Atmospheric Layer Cells -->
        <rect width="420" height="220" fill="url(#radarCell1)" />
        <rect width="420" height="220" fill="url(#radarCell2)" />
        ${
          layer === "wind"
            ? `<g stroke="#82d8a6" stroke-width="1.4" stroke-opacity="0.75" fill="none">
                <path d="M40 70 Q110 55 180 72 T330 62" />
                <path d="M60 120 Q150 104 235 122 T380 112" />
                <path d="M35 168 Q130 152 220 166 T365 156" />
              </g>`
            : ""
        }
        <!-- Station Pin -->
        <circle cx="210" cy="110" r="5" fill="${palette.glow}" />
        <circle cx="210" cy="110" r="11" fill="none" stroke="${palette.glow}" stroke-opacity="0.55" />
        <text x="210" y="94" text-anchor="middle" fill="#e2e2e5" font-family="Geist, Inter, sans-serif" font-size="13" font-weight="600">${escapeHtml(weather.city)}</text>
        <text x="210" y="132" text-anchor="middle" fill="#a8abb0" font-family="JetBrains Mono, monospace" font-size="9.5">${Number(weather.lat).toFixed(2)}°N, ${Math.abs(Number(weather.lon)).toFixed(2)}°${weather.lon < 0 ? "W" : "E"}</text>
      </svg>
      <div class="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 border border-outline font-mono text-[10px] tracking-wider uppercase text-on-surface">
          <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          <span>LIVE · ${palette.badge}</span>
        </span>
        <span class="px-2.5 py-1 rounded bg-black/75 border border-outline font-mono text-[10px] text-on-surface tabular-nums">${palette.metric}</span>
      </div>
    </div>
  `;
}

export function renderWeatherView(container, { openQuickFind, openAlerts, openModal }) {
  const weather = store.weather;
  if (!weather) {
    container.innerHTML = `<div class="py-16 text-center font-mono text-xs text-on-surface-variant">Fetching Open-Meteo telemetry…</div>`;
    return;
  }

  const cfg = store.config;
  const activeHour = weather.hourly[selectedHourIndex] || weather.hourly[0];
  const minWeek = Math.min(...weather.daily.map((d) => d.low));
  const maxWeek = Math.max(...weather.daily.map((d) => d.high));
  const weekSpan = Math.max(1, maxWeek - minWeek);

  const uvLabel =
    weather.uvIndex <= 2 ? "Low" : weather.uvIndex <= 5 ? "Mod" : weather.uvIndex <= 7 ? "High" : "Very High";
  const aqiLabel = weather.aqi <= 50 ? "good standing" : weather.aqi <= 100 ? "moderate" : "elevated";

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-tertiary">STUDIO TELEMETRY</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span class="tabular-nums">${Number(weather.lat).toFixed(4)}° N, ${Math.abs(Number(weather.lon)).toFixed(4)}° ${weather.lon < 0 ? "W" : "E"}</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Weather</h1>
        </div>
        <div class="flex items-center gap-2 shrink-0 flex-wrap">
          <button id="weatherLocationBtn" type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline font-mono text-xs text-on-surface hover:bg-surface-container-high transition-colors">
            <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            <span>${escapeHtml(weather.city.toUpperCase())}</span>
            <span class="text-on-surface-variant">${weather.tempF}°F</span>
          </button>
          <button id="weatherQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="weatherAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- 4 Atmospheric KPI Tiles -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-2.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">HUMIDITY</span>
            <span class="px-1.5 py-0.5 rounded bg-primary-soft text-primary font-mono text-[10px]">+4%</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-2xl font-medium text-on-surface tabular-nums">${weather.humidity}%</span>
            ${sparklineSvg([68, 70, 72, 71, 75, 76, weather.humidity], "#ffb3b4", 76, 24)}
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span>vs yesterday</span>
            <span>dew point ${weather.dewPointF}°F</span>
          </div>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-2.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">WIND SPEED</span>
            <span class="px-1.5 py-0.5 rounded bg-tertiary-container/20 text-tertiary font-mono text-[10px]">${weather.windDir}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-2xl font-medium text-on-surface tabular-nums">${weather.windMph} mph</span>
            ${sparklineSvg(weather.hourly.slice(0, 7).map((h) => h.windSpeed), "#82d8a6", 76, 24)}
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span>gusts to ${weather.windGustMph} mph</span>
            <span>${weather.windDir} flow</span>
          </div>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-2.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">UV INDEX</span>
            <span class="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono text-[10px]">${weather.uvIndex}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-2xl font-medium text-on-surface tabular-nums">${weather.uvIndex} ${uvLabel}</span>
            ${sparklineSvg([0, 1, 3, 5, 4, 2, 1], "#c3c7cc", 76, 24)}
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span>peak at 1 PM</span>
            <span>max 6 index</span>
          </div>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-2.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">AIR QUALITY</span>
            <span class="px-1.5 py-0.5 rounded bg-tertiary-container/20 text-tertiary font-mono text-[10px]">US AQI</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-2xl font-medium text-tertiary tabular-nums">${weather.aqi} AQI</span>
            ${sparklineSvg([28, 26, 25, 22, 20, weather.aqi], "#82d8a6", 76, 24)}
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span class="text-tertiary">${aqiLabel}</span>
            <span>target under 50</span>
          </div>
        </div>
      </section>

      <!-- Hourly Forecast + Doppler Radar -->
      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div class="xl:col-span-7 dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary-container">schedule</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Hourly Forecast</h2>
            </div>
            <span id="weatherHourlySummary" class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant tabular-nums">
              ${escapeHtml(activeHour.label)} · ${activeHour.temp}°F · ${activeHour.precipProb}% PRECIP
            </span>
          </div>

          <div class="rounded-md bg-surface-container-lowest/75 border border-outline/60 px-3 pt-4 pb-1">
            ${hourlyCurveSvg(weather.hourly, selectedHourIndex)}
          </div>

          <div class="grid grid-cols-4 sm:grid-cols-8 gap-2" role="tablist" aria-label="Hourly forecast slots">
            ${weather.hourly
              .map((h, i) => {
                const active = i === selectedHourIndex;
                return `
                <button type="button" role="tab" aria-selected="${active}" data-hour-index="${i}" class="flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-md border transition-colors ${
                  active
                    ? "bg-primary-container border-primary-container text-on-primary-container font-semibold"
                    : "bg-surface-container-lowest/80 border-outline/70 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }">
                  <span class="font-mono text-[10px]">${escapeHtml(h.label)}</span>
                  <span class="material-symbols-outlined text-[18px]">${escapeHtml(h.icon)}</span>
                  <span class="font-mono text-xs tabular-nums ${active ? "text-on-primary-container" : "text-on-surface"}">${h.temp}°</span>
                </button>
              `;
              })
              .join("")}
          </div>
        </div>

        <div class="xl:col-span-5 dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-tertiary">radar</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Doppler Radar</h2>
            </div>
            <div class="inline-flex items-center rounded bg-surface-container-lowest border border-outline p-0.5" role="tablist" aria-label="Radar layers">
              ${[
                { id: "precip", label: "Precip" },
                { id: "wind", label: "Wind" },
                { id: "temp", label: "Temp" },
              ]
                .map((l) => {
                  const active = radarLayer === l.id;
                  return `
                  <button type="button" role="tab" aria-selected="${active}" data-radar-layer="${l.id}" class="px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-primary-container text-on-primary-container font-semibold"
                      : "text-on-surface-variant hover:text-on-surface"
                  }">${l.label}</button>
                `;
                })
                .join("")}
            </div>
          </div>

          <div id="weatherRadarCanvas">${radarSvg(weather, radarLayer)}</div>
        </div>
      </section>

      <!-- Atmospheric Readings + 7-Day Studio Outlook -->
      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div class="xl:col-span-5 dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary-container">speed</span>
            <h2 class="font-headline text-[15px] font-semibold text-on-surface">Atmospheric Readings</h2>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 p-3.5">
              <p class="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">PRESSURE</p>
              <p class="font-mono text-lg font-medium text-on-surface mt-1 tabular-nums">${weather.pressureHpa} hPa</p>
              <p class="font-mono text-[11px] text-tertiary mt-1">Steady</p>
            </div>
            <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 p-3.5">
              <p class="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">VISIBILITY</p>
              <p class="font-mono text-lg font-medium text-on-surface mt-1 tabular-nums">${weather.visibilityMi} mi</p>
              <p class="font-mono text-[11px] text-on-surface-variant mt-1">Clear</p>
            </div>
            <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 p-3.5">
              <p class="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">CLOUD COVER</p>
              <p class="font-mono text-lg font-medium text-on-surface mt-1 tabular-nums">${weather.cloudCover}%</p>
              <p class="font-mono text-[11px] text-on-surface-variant mt-1">${weather.cloudCover < 30 ? "Clear" : weather.cloudCover < 70 ? "Scattered" : "Overcast"}</p>
            </div>
            <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 p-3.5">
              <p class="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">SOLAR DAY</p>
              <p class="font-mono text-lg font-medium text-on-surface mt-1 tabular-nums">${escapeHtml(weather.daylightLabel)}</p>
              <p class="font-mono text-[11px] text-on-surface-variant mt-1">Sunset ${escapeHtml(weather.sunsetLabel)}</p>
            </div>
          </div>
        </div>

        <div class="xl:col-span-7 dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-tertiary">calendar_view_week</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">7-Day Studio Outlook</h2>
            </div>
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">${escapeHtml(weather.city.toUpperCase())}</span>
          </div>

          <div class="divide-y divide-outline/50">
            ${weather.daily
              .map((d) => {
                const leftPct = Math.round(((d.low - minWeek) / weekSpan) * 100);
                const widthPct = Math.max(12, Math.round(((d.high - d.low) / weekSpan) * 100));
                const barColor = d.high >= 70 ? "bg-tertiary" : "bg-primary-container";
                return `
                <div class="grid grid-cols-12 items-center gap-2 py-2.5 text-xs">
                  <span class="col-span-3 font-medium text-on-surface">${escapeHtml(d.day)}</span>
                  <div class="col-span-3 flex items-center gap-2 font-mono text-[11px] text-on-surface-variant">
                    <span class="material-symbols-outlined text-[17px] ${d.icon === "sunny" ? "text-tertiary" : "text-primary"}">${escapeHtml(d.icon)}</span>
                    <span class="tabular-nums">${d.precip}%</span>
                  </div>
                  <div class="col-span-6 flex items-center gap-3 font-mono tabular-nums">
                    <span class="w-8 text-right text-on-surface-variant">${d.low}°</span>
                    <div class="flex-1 h-1.5 rounded-full bg-surface-container-high relative overflow-hidden">
                      <div class="absolute top-0 bottom-0 rounded-full ${barColor}" style="left:${leftPct}%;width:${Math.min(100 - leftPct, widthPct)}%"></div>
                    </div>
                    <span class="w-8 text-on-surface">${d.high}°</span>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </section>
    </div>
  `;

  container.querySelector("#weatherQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#weatherAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelectorAll("[data-hour-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedHourIndex = Number(btn.getAttribute("data-hour-index")) || 0;
      renderWeatherView(container, { openQuickFind, openAlerts, openModal });
    });
  });

  container.querySelectorAll("[data-radar-layer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      radarLayer = btn.getAttribute("data-radar-layer") || "precip";
      renderWeatherView(container, { openQuickFind, openAlerts, openModal });
    });
  });

  container.querySelector("#weatherLocationBtn")?.addEventListener("click", () => {
    openModal({
      title: "Change Weather Location",
      submitLabel: "Update Location",
      bodyHtml: `
        <div class="space-y-2">
          <label for="weatherCityInput" class="block text-xs font-medium text-on-surface-variant">City name</label>
          <input id="weatherCityInput" name="city" type="text" required value="${escapeHtml(cfg.weatherCity)}" placeholder="e.g. San Francisco, Tokyo, London" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          <p class="text-[11px] text-on-surface-variant">Powered by live Open-Meteo geocoding and atmospheric feeds.</p>
        </div>
      `,
      onSubmit: async (formData) => {
        const query = String(formData.get("city") || "").trim();
        if (!query) throw new Error("Enter a city name");
        const results = await geocodeCity(query);
        if (!results.length) throw new Error(`No city found matching "${query}"`);
        const match = results[0];
        const label = match.admin1 ? `${match.name}, ${match.admin1}` : match.name;
        await updateConfig({ weatherCity: label, weatherLat: match.latitude, weatherLon: match.longitude });
        await fetchWeather(match.latitude, match.longitude, label);
        showToast(`Weather synced to ${label}`, "ok");
      },
    });
  });
}
