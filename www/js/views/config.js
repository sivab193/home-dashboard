import { escapeHtml, showToast, store, updateConfig } from "../api.js";

export function renderConfigView(container, { openQuickFind, openAlerts, openModal }) {
  const cfg = store.config;
  const opacity = Math.max(20, Math.min(100, Number(cfg.dockOpacity ?? 85)));

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">07</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>SYSTEM PREFERENCES</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Config</h1>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="cfgQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="cfgAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- Two-Column Preferences + Appearance Opacity Panel -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div class="xl:col-span-8 space-y-5">
          <!-- Dock Behavior Group -->
          <section class="space-y-2.5">
            <div class="flex items-center justify-between px-1">
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Dock Behavior</h2>
              <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">3 ENTRIES</span>
            </div>

            <div class="dock-surface-card rounded-lg divide-y divide-outline/60 overflow-hidden">
              <!-- Auto-hide Dock -->
              <div class="px-4 py-3.5 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-primary">dock_to_bottom</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-on-surface">Auto-hide Dock</p>
                    <p class="text-xs text-on-surface-variant">Hide DockSpace when mouse leaves screen edge</p>
                  </div>
                </div>
                <button id="cfgAutoHideSwitch" type="button" role="switch" aria-checked="${cfg.autoHideDock}" aria-label="Auto-hide Dock" class="dock-switch">
                  <span class="dock-switch-thumb"></span>
                </button>
              </div>

              <!-- Active Mac Target -->
              <button id="cfgMacTargetBtn" type="button" class="w-full px-4 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-surface-container-high/45 transition-colors">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-tertiary">desktop_mac</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[13px] font-medium text-on-surface">Active Mac Target</span>
                      <span class="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono text-[11px]">${escapeHtml(cfg.activeMacTarget)}</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">Primary machine for media and shortcut bridge</p>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">chevron_right</span>
              </button>

              <!-- Work Shift Hours -->
              <button id="cfgShiftHoursBtn" type="button" class="w-full px-4 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-surface-container-high/45 transition-colors">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-secondary">schedule</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[13px] font-medium text-on-surface">Work Shift Hours</span>
                      <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline font-mono text-[11px] text-on-surface-variant">${escapeHtml(cfg.workShiftHours)}</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">Schedules focus clock and ambient lighting</p>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">chevron_right</span>
              </button>
            </div>
          </section>

          <!-- Studio Account Group -->
          <section class="space-y-2.5">
            <div class="flex items-center justify-between px-1">
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Studio Account</h2>
              <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">3 ENTRIES</span>
            </div>

            <div class="dock-surface-card rounded-lg divide-y divide-outline/60 overflow-hidden">
              <!-- Signed In User -->
              <button id="cfgUserBtn" type="button" class="w-full px-4 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-surface-container-high/45 transition-colors">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-primary-soft/70 border border-primary-container/30 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-primary">person</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[13px] font-medium text-on-surface">Signed In User</span>
                      <span class="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-mono text-[11px] font-semibold">${escapeHtml(cfg.userName)}</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">Active profile on ${escapeHtml(cfg.studioName)} smart dock</p>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">chevron_right</span>
              </button>

              <!-- System Clock Format -->
              <button id="cfgClockBtn" type="button" class="w-full px-4 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-surface-container-high/45 transition-colors">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-secondary">history_toggle_off</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[13px] font-medium text-on-surface">System Clock Format</span>
                      <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline font-mono text-[11px] text-on-surface">${escapeHtml(cfg.clockFormat)}</span>
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">Display time in ${cfg.clockFormat === "24-hour" ? "24-hour military" : "standard AM/PM"} format</p>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">chevron_right</span>
              </button>

              <!-- Cloud Sync -->
              <div class="px-4 py-3.5 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-surface-container-high border border-outline flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px] text-tertiary">cloud_sync</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-on-surface">Cloud Sync</p>
                    <p class="text-xs text-on-surface-variant">Sync widget layouts and stocks across devices</p>
                  </div>
                </div>
                <button id="cfgCloudSyncSwitch" type="button" role="switch" aria-checked="${cfg.cloudSync}" aria-label="Cloud Sync" class="dock-switch">
                  <span class="dock-switch-thumb"></span>
                </button>
              </div>
            </div>
          </section>
        </div>

        <!-- Right: Appearance / Dock Opacity Live Panel -->
        <aside class="xl:col-span-4 dock-surface-card rounded-lg p-5 space-y-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-mono text-[10.5px] uppercase tracking-[0.14em] text-primary">APPEARANCE</p>
              <h2 class="font-headline text-base font-semibold text-on-surface mt-0.5">Dock Opacity</h2>
            </div>
            <span id="cfgOpacityReadout" class="px-2.5 py-1 rounded bg-surface-container-high border border-outline font-mono text-sm font-medium text-on-surface tabular-nums">${opacity}%</span>
          </div>

          <!-- Translucency Visual Mockup -->
          <div class="relative rounded-lg border border-outline bg-[#0e1013] h-36 overflow-hidden flex items-end justify-center p-4">
            <div class="absolute -top-4 left-4 w-24 h-24 rounded-full bg-primary-container/20 blur-md pointer-events-none"></div>
            <div class="absolute -bottom-5 right-3 w-28 h-28 rounded-full bg-tertiary/15 blur-md pointer-events-none"></div>
            <div id="cfgDockPreviewBar" class="relative z-10 inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-outline/80 backdrop-blur-md transition-all" style="background-color: rgba(26, 28, 31, ${(opacity / 100).toFixed(2)});">
              <span class="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">home</span>
              </span>
              <span class="w-8 h-8 rounded bg-surface-container-high border border-outline text-on-surface-variant flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">play_circle</span>
              </span>
              <span class="w-8 h-8 rounded bg-surface-container-high border border-outline text-on-surface-variant flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">partly_cloudy_day</span>
              </span>
              <span class="w-8 h-8 rounded bg-surface-container-high border border-outline text-on-surface-variant flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">tune</span>
              </span>
            </div>
          </div>

          <!-- Opacity Slider -->
          <div class="space-y-2">
            <input id="cfgOpacitySlider" type="range" min="20" max="100" value="${opacity}" aria-label="Dock Opacity percentage" class="dock-slider w-full" style="background: linear-gradient(to right, #ff6370 ${((opacity - 20) / 80) * 100}%, #282a2c ${((opacity - 20) / 80) * 100}%);" />
            <div class="flex items-center justify-between font-mono text-[10.5px] text-on-surface-variant tabular-nums">
              <span>20%</span>
              <span>60%</span>
              <span>100%</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  container.querySelector("#cfgQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#cfgAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelector("#cfgAutoHideSwitch")?.addEventListener("click", async () => {
    await updateConfig({ autoHideDock: !cfg.autoHideDock });
    showToast(`Auto-hide Dock ${!cfg.autoHideDock ? "enabled" : "disabled"}`, "ok");
  });

  container.querySelector("#cfgCloudSyncSwitch")?.addEventListener("click", async () => {
    await updateConfig({ cloudSync: !cfg.cloudSync });
    showToast(`Cloud Sync ${!cfg.cloudSync ? "enabled" : "paused"}`, "ok");
  });

  container.querySelector("#cfgClockBtn")?.addEventListener("click", async () => {
    const next = cfg.clockFormat === "24-hour" ? "12-hour" : "24-hour";
    await updateConfig({ clockFormat: next });
    showToast(`Clock format switched to ${next}`, "ok");
  });

  container.querySelector("#cfgMacTargetBtn")?.addEventListener("click", () => {
    openModal({
      title: "Select Active Mac Target",
      submitLabel: "Save Target",
      bodyHtml: `
        <div>
          <label for="macTargetInput" class="block text-xs font-medium text-on-surface-variant mb-1">Workstation name</label>
          <input id="macTargetInput" name="activeMacTarget" type="text" required value="${escapeHtml(cfg.activeMacTarget)}" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
        </div>
      `,
      onSubmit: async (formData) => {
        await updateConfig({ activeMacTarget: formData.get("activeMacTarget") });
        showToast("Workstation target updated", "ok");
      },
    });
  });

  container.querySelector("#cfgShiftHoursBtn")?.addEventListener("click", () => {
    openModal({
      title: "Work Shift Hours",
      submitLabel: "Save Hours",
      bodyHtml: `
        <div>
          <label for="shiftHoursInput" class="block text-xs font-medium text-on-surface-variant mb-1">Shift range</label>
          <input id="shiftHoursInput" name="workShiftHours" type="text" required value="${escapeHtml(cfg.workShiftHours)}" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline font-mono text-sm text-on-surface focus:border-primary-container focus:outline-none" />
        </div>
      `,
      onSubmit: async (formData) => {
        await updateConfig({ workShiftHours: formData.get("workShiftHours") });
        showToast("Work shift hours updated", "ok");
      },
    });
  });

  container.querySelector("#cfgUserBtn")?.addEventListener("click", () => {
    openModal({
      title: "Studio Profile",
      submitLabel: "Save Profile",
      bodyHtml: `
        <div class="space-y-3">
          <div>
            <label for="profileUserInput" class="block text-xs font-medium text-on-surface-variant mb-1">Display name</label>
            <input id="profileUserInput" name="userName" type="text" required value="${escapeHtml(cfg.userName)}" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div>
            <label for="profileStudioInput" class="block text-xs font-medium text-on-surface-variant mb-1">Workspace / Studio label</label>
            <input id="profileStudioInput" name="studioName" type="text" required value="${escapeHtml(cfg.studioName)}" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        await updateConfig({
          userName: formData.get("userName"),
          studioName: formData.get("studioName"),
        });
        showToast("Profile updated", "ok");
      },
    });
  });

  const slider = container.querySelector("#cfgOpacitySlider");
  const readout = container.querySelector("#cfgOpacityReadout");
  const previewBar = container.querySelector("#cfgDockPreviewBar");
  slider?.addEventListener("input", () => {
    const val = Number(slider.value);
    const pct = ((val - 20) / 80) * 100;
    slider.style.background = `linear-gradient(to right, #ff6370 ${pct}%, #282a2c ${pct}%)`;
    if (readout) readout.textContent = `${val}%`;
    if (previewBar) previewBar.style.backgroundColor = `rgba(26, 28, 31, ${(val / 100).toFixed(2)})`;
    document.documentElement.style.setProperty("--dock-opacity", (val / 100).toFixed(2));
  });
  slider?.addEventListener("change", async () => {
    await updateConfig({ dockOpacity: Number(slider.value) });
    showToast(`Dock opacity set to ${slider.value}%`, "ok");
  });
}
