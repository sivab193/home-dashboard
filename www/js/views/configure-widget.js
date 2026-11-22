import {
  escapeHtml,
  fetchStocks,
  formatTime,
  resetConfig,
  showToast,
  store,
  updateConfig,
} from "../api.js";

let draft = null;

function ensureDraft() {
  if (!draft) {
    draft = {
      showWeatherOverlay: store.config.showWeatherOverlay,
      clockFormat: store.config.clockFormat,
      workShiftHours: store.config.workShiftHours,
      widgetDisplayName: store.config.widgetDisplayName,
      widgetGridSpan: store.config.widgetGridSpan,
      stockSymbols: store.config.stockSymbols,
    };
  }
  return draft;
}

export function clearWidgetDraft() {
  draft = null;
}

function previewCardHtml(d) {
  const weather = store.weather;
  const temp = weather ? `${weather.tempF}°F` : "64°F";
  const nowStr = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: d.clockFormat !== "24-hour",
  }).format(new Date());

  return `
    <div class="rounded-lg bg-surface-container-lowest border border-outline p-4 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2 h-2 rounded-full bg-tertiary shrink-0"></span>
          <span id="previewWidgetName" class="font-headline text-sm font-semibold text-on-surface truncate">${escapeHtml(d.widgetDisplayName || "Mac Studio M2")}</span>
        </div>
        ${
          d.showWeatherOverlay
            ? `<span id="previewWeatherBadge" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high border border-outline font-mono text-[11px] text-on-surface tabular-nums shrink-0">
                <span class="material-symbols-outlined text-[13px] text-tertiary">partly_cloudy_day</span>
                <span>${temp}</span>
              </span>`
            : `<span id="previewWeatherBadge" class="font-mono text-[10px] text-on-surface-variant">Weather hidden</span>`
        }
      </div>

      <div class="flex items-baseline justify-between gap-2">
        <p id="previewClockValue" class="font-mono text-2xl font-medium text-on-surface tabular-nums">${nowStr}</p>
        <span class="font-mono text-[11px] text-primary">${escapeHtml(d.workShiftHours)}</span>
      </div>

      <!-- Mini Telemetry Area Chart -->
      <svg viewBox="0 0 260 56" class="w-full h-14 overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="previewArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff6370" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#ff6370" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M4 44 L44 38 L82 28 L116 32 L152 20 L188 26 L224 14 L256 22 L256 54 L4 54 Z" fill="url(#previewArea)" />
        <polyline fill="none" stroke="#ff6370" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="4,44 44,38 82,28 116,32 152,20 188,26 224,14 256,22" />
      </svg>

      <!-- Span Segments -->
      <div class="grid grid-cols-4 gap-1.5">
        <div class="h-1.5 rounded-full bg-primary-container"></div>
        <div class="h-1.5 rounded-full bg-primary-container"></div>
        <div class="h-1.5 rounded-full ${d.widgetGridSpan.includes("3x") || d.widgetGridSpan.includes("4x") ? "bg-primary-container" : "bg-surface-container-high"}"></div>
        <div class="h-1.5 rounded-full ${d.widgetGridSpan.includes("4x") ? "bg-primary-container" : "bg-surface-container-high"}"></div>
      </div>
    </div>
  `;
}

export function renderConfigureWidgetView(container, { openQuickFind, openAlerts }) {
  const cfg = store.config;
  const d = ensureDraft();
  const weather = store.weather;
  const tempCond = weather ? `${weather.tempF}°F ${weather.condition}` : "64°F Part Cloudy";

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">06 / STUDIO DOCK</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${escapeHtml(cfg.userName)} in ${escapeHtml(cfg.studioName)}</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Configure Widget</h1>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="cwQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="cwAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- Main Two-Column Layout -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <!-- Left: Display Parameters & Configure Form -->
        <div class="xl:col-span-7 space-y-4">
          <!-- Display Parameters Card -->
          <section class="dock-surface-card rounded-lg p-5 space-y-3">
            <div class="flex items-center justify-between pb-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary-container">tune</span>
                <h2 class="font-headline text-[15px] font-semibold text-on-surface">Display Parameters</h2>
              </div>
              <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">3 ACTIVE RULES</span>
            </div>

            <!-- Show Weather Overlay -->
            <div class="rounded-md bg-surface-container-lowest/70 border border-outline/70 px-4 py-3 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[18px] text-tertiary">partly_cloudy_day</span>
                </div>
                <div class="min-w-0">
                  <p class="text-[13px] font-medium text-on-surface">Show Weather Overlay</p>
                  <p class="text-xs text-on-surface-variant truncate">Display ${escapeHtml(tempCond)} badge on module</p>
                </div>
              </div>
              <button id="cwWeatherToggle" type="button" role="switch" aria-checked="${d.showWeatherOverlay}" aria-label="Show Weather Overlay" class="dock-switch">
                <span class="dock-switch-thumb"></span>
              </button>
            </div>

            <!-- Clock Format -->
            <div class="rounded-md bg-surface-container-lowest/70 border border-outline/70 px-4 py-3 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[18px] text-secondary">schedule</span>
                </div>
                <div class="min-w-0">
                  <p class="text-[13px] font-medium text-on-surface">Clock Format</p>
                  <p class="text-xs text-on-surface-variant">System clock display style</p>
                </div>
              </div>
              <button id="cwClockToggle" type="button" class="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-high border border-outline font-mono text-xs text-on-surface hover:bg-surface-bright shrink-0">
                <span>${d.clockFormat === "24-hour" ? "24-Hour" : "12-Hour"}</span>
                <span class="material-symbols-outlined text-[15px] text-on-surface-variant">chevron_right</span>
              </button>
            </div>

            <!-- Work Shift Indicator -->
            <div class="rounded-md bg-surface-container-lowest/70 border border-outline/70 px-4 py-3 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[18px] text-primary-container">work_history</span>
                </div>
                <div class="min-w-0">
                  <p class="text-[13px] font-medium text-on-surface">Work Shift Indicator</p>
                  <p class="text-xs text-on-surface-variant">Highlight active working hours</p>
                </div>
              </div>
              <select id="cwShiftSelect" aria-label="Work Shift Indicator" class="px-2.5 py-1.5 rounded bg-surface-container-high border border-outline font-mono text-xs text-on-surface focus:border-primary-container focus:outline-none">
                ${["8:00 AM - 4:00 PM", "9:00 AM - 5:00 PM", "10:00 AM - 6:00 PM", "Flexible Studio"]
                  .map((opt) => `<option value="${opt}" ${d.workShiftHours === opt ? "selected" : ""}>${opt}</option>`)
                  .join("")}
              </select>
            </div>
          </section>

          <!-- Configure Widget Form Card -->
          <section class="dock-surface-card rounded-lg p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary-container">dashboard_customize</span>
                <h2 class="font-headline text-[15px] font-semibold text-on-surface">Configure Widget</h2>
              </div>
              <span class="font-mono text-[11px] uppercase tracking-wider text-tertiary">MODULE #04</span>
            </div>

            <div class="space-y-4">
              <div>
                <label for="cwNameInput" class="block text-xs font-medium text-on-surface mb-1.5">Widget Display Name</label>
                <input id="cwNameInput" type="text" value="${escapeHtml(d.widgetDisplayName)}" class="w-full px-3 py-2.5 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
                <p class="text-[11px] text-on-surface-variant mt-1">Enter the name shown in your DockSpace header and Home node</p>
              </div>

              <div>
                <label for="cwSpanSelect" class="block text-xs font-medium text-on-surface mb-1.5">Grid Span Columns</label>
                <div class="flex items-center gap-2">
                  <select id="cwSpanSelect" class="flex-1 px-3 py-2.5 rounded bg-surface-container-lowest border border-outline font-mono text-xs text-on-surface focus:border-primary-container focus:outline-none">
                    ${["2x4 Medium", "3x4 Wide", "4x4 Full"]
                      .map((opt) => `<option value="${opt}" ${d.widgetGridSpan === opt ? "selected" : ""}>${opt}</option>`)
                      .join("")}
                  </select>
                  <span class="px-3 py-2.5 rounded bg-surface-container-high border border-outline font-mono text-xs text-on-surface-variant">cols</span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-1">Adjust module width for Studio smart dock</p>
              </div>

              <div>
                <label for="cwStocksInput" class="block text-xs font-medium text-on-surface mb-1.5">Market Watchlist Symbols</label>
                <input id="cwStocksInput" type="text" value="${escapeHtml(d.stockSymbols)}" placeholder="AAPL,NVDA,V,GOOG,META,TSLA" class="w-full px-3 py-2.5 rounded bg-surface-container-lowest border border-outline font-mono text-xs text-on-surface focus:border-primary-container focus:outline-none" />
                <p class="text-[11px] text-on-surface-variant mt-1">Comma-separated tickers shown on the Home watchlist bar</p>
              </div>

              <div class="flex justify-end pt-1">
                <button id="cwApplyBtn" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">
                  <span class="material-symbols-outlined text-[15px]">grid_view</span>
                  <span>Apply Layout</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Bottom Action Bar -->
          <div class="flex flex-wrap items-center justify-end gap-2.5">
            <button id="cwResetBtn" type="button" class="px-4 py-2 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">Reset Default</button>
            <button id="cwSaveBtn" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110">
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Save Layout · 8 modules</span>
            </button>
          </div>
        </div>

        <!-- Right: Live Dock Preview -->
        <aside class="xl:col-span-5 dock-surface-card rounded-lg p-5 space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">LIVE DOCK PREVIEW</span>
            <span id="previewSpanChip" class="px-2 py-0.5 rounded bg-primary-soft/60 border border-primary-container/30 font-mono text-[11px] text-primary">${escapeHtml(d.widgetGridSpan)}</span>
          </div>

          <div id="cwLivePreviewSlot">${previewCardHtml(d)}</div>

          <div class="flex items-center justify-between pt-2 border-t border-outline/60 font-mono text-[10.5px] uppercase tracking-wider">
            <span class="text-on-surface-variant">STUDIO DOCK TELEMETRY</span>
            <span class="text-tertiary">SYNCED · ${formatTime(new Date())}</span>
          </div>
        </aside>
      </div>
    </div>
  `;

  const syncPreview = () => {
    const slot = container.querySelector("#cwLivePreviewSlot");
    if (slot) slot.innerHTML = previewCardHtml(d);
    const chip = container.querySelector("#previewSpanChip");
    if (chip) chip.textContent = d.widgetGridSpan;
  };

  container.querySelector("#cwQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#cwAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelector("#cwWeatherToggle")?.addEventListener("click", () => {
    d.showWeatherOverlay = !d.showWeatherOverlay;
    renderConfigureWidgetView(container, { openQuickFind, openAlerts });
  });

  container.querySelector("#cwClockToggle")?.addEventListener("click", () => {
    d.clockFormat = d.clockFormat === "24-hour" ? "12-hour" : "24-hour";
    renderConfigureWidgetView(container, { openQuickFind, openAlerts });
  });

  container.querySelector("#cwShiftSelect")?.addEventListener("change", (e) => {
    d.workShiftHours = e.target.value;
    syncPreview();
  });

  container.querySelector("#cwNameInput")?.addEventListener("input", (e) => {
    d.widgetDisplayName = e.target.value;
    syncPreview();
  });

  container.querySelector("#cwSpanSelect")?.addEventListener("change", (e) => {
    d.widgetGridSpan = e.target.value;
    syncPreview();
  });

  container.querySelector("#cwStocksInput")?.addEventListener("input", (e) => {
    d.stockSymbols = e.target.value;
  });

  const persistDraft = async (msg) => {
    try {
      await updateConfig({ ...d });
      await fetchStocks();
      clearWidgetDraft();
      showToast(msg, "ok");
    } catch (err) {
      showToast(err.message || "Could not save widget layout", "error");
    }
  };

  container.querySelector("#cwApplyBtn")?.addEventListener("click", () => persistDraft("Layout preview applied"));
  container.querySelector("#cwSaveBtn")?.addEventListener("click", () => persistDraft("Saved 8-module DockSpace layout"));

  container.querySelector("#cwResetBtn")?.addEventListener("click", async () => {
    await resetConfig();
    clearWidgetDraft();
    showToast("Widget defaults restored", "ok");
  });
}
