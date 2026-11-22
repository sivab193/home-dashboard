import { escapeHtml, store } from "../api.js";

const CAMERAS = [
  { id: "dvr1_cam1", name: "Front Gate", dvr: "dvr1", zone: "Perimeter" },
  { id: "dvr1_cam2", name: "Driveway North", dvr: "dvr1", zone: "Perimeter" },
  { id: "dvr1_cam3", name: "Porch Entry", dvr: "dvr1", zone: "Entry" },
  { id: "dvr1_cam4", name: "Garden East", dvr: "dvr1", zone: "Exterior" },
  { id: "dvr2_cam1", name: "Garage Bay", dvr: "dvr2", zone: "Utility" },
  { id: "dvr2_cam2", name: "Back Patio", dvr: "dvr2", zone: "Exterior" },
  { id: "dvr2_cam3", name: "Side Corridor", dvr: "dvr2", zone: "Perimeter" },
  { id: "dvr2_cam4", name: "Studio Hallway", dvr: "dvr2", zone: "Interior" },
];

let dvrFilter = "all"; // all | dvr1 | dvr2
let hdMode = false;
let focusedCamId = null;

export function renderSecurityView(container, { openQuickFind, openAlerts }) {
  const streams = store.streams || {};
  const visible = dvrFilter === "all" ? CAMERAS : CAMERAS.filter((c) => c.dvr === dvrFilter);
  const onlineCount = CAMERAS.filter((c) => Boolean(streams[c.id])).length;
  const focused = focusedCamId ? CAMERAS.find((c) => c.id === focusedCamId) : null;

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">SECURITY MATRIX</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${onlineCount} OF ${CAMERAS.length} STREAMS CONNECTED</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Security</h1>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <div class="inline-flex items-center rounded bg-surface-container-low border border-outline p-0.5" role="tablist" aria-label="DVR filter">
            ${[
              { id: "all", label: "All (8)" },
              { id: "dvr1", label: "DVR 1" },
              { id: "dvr2", label: "DVR 2" },
            ]
              .map((f) => {
                const on = dvrFilter === f.id;
                return `
                <button type="button" role="tab" aria-selected="${on}" data-dvr-filter="${f.id}" class="px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  on
                    ? "bg-primary-container text-on-primary-container font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }">${f.label}</button>
              `;
              })
              .join("")}
          </div>

          <button id="secHdToggle" type="button" aria-pressed="${hdMode}" class="px-3 py-1.5 rounded border font-mono text-xs transition-colors ${
            hdMode
              ? "bg-primary-soft border-primary-container/50 text-primary"
              : "bg-surface-container-low border-outline text-on-surface-variant hover:text-on-surface"
          }">HD ${hdMode ? "ON" : "OFF"}</button>

          <button id="secQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="secAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      ${
        focused
          ? `
        <section class="dock-surface-card rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-b border-outline flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[18px] text-primary-container">videocam</span>
              <span class="font-headline text-sm font-semibold text-on-surface">${escapeHtml(focused.name)}</span>
              <span class="font-mono text-[11px] uppercase text-on-surface-variant">${focused.dvr.toUpperCase()} · ${focused.zone}</span>
            </div>
            <button id="secExitFocus" type="button" class="px-3 py-1 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">Back to Grid</button>
          </div>
          <div class="aspect-video bg-[#0b0d10] flex flex-col items-center justify-center gap-2 text-center p-6">
            <span class="material-symbols-outlined text-[36px] text-on-surface-variant/60">videocam_off</span>
            <p class="font-headline text-sm font-medium text-on-surface">${escapeHtml(focused.name)} (${hdMode ? "Main HD" : "Sub Stream"})</p>
            <p class="font-mono text-xs text-on-surface-variant max-w-md">Configure RTSP streams in go2rtc.yaml and DVR environment variables to view live WebRTC camera feeds.</p>
          </div>
        </section>
      `
          : ""
      }

      <!-- Camera Matrix -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        ${visible
          .map((cam) => {
            const live = Boolean(streams[cam.id]);
            return `
            <button type="button" data-focus-cam="${cam.id}" class="dock-surface-card rounded-lg overflow-hidden text-left hover:border-outline-strong transition-colors group">
              <div class="relative aspect-video bg-[#0c0e11] flex flex-col items-center justify-center p-4">
                <!-- Technical framing reticle -->
                <div class="absolute inset-2.5 border border-outline/30 rounded-sm pointer-events-none"></div>
                <span class="material-symbols-outlined text-[24px] ${live ? "text-tertiary" : "text-on-surface-variant/50"} group-hover:text-primary-container transition-colors">videocam</span>
                <span class="font-mono text-[10px] text-on-surface-variant mt-1.5">${live ? "STREAM READY" : "AWAITING RTSP"}</span>
                <div class="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded bg-black/75 border border-outline/80 font-mono text-[9.5px] uppercase text-on-surface-variant">
                  ${cam.dvr.toUpperCase()} · ${hdMode ? "1080P" : "720P"}
                </div>
                <div class="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 border border-outline/80 font-mono text-[9.5px]">
                  <span class="w-1.5 h-1.5 rounded-full ${live ? "bg-tertiary" : "bg-on-surface-variant"}"></span>
                  <span class="${live ? "text-tertiary" : "text-on-surface-variant"}">${live ? "LIVE" : "IDLE"}</span>
                </div>
              </div>
              <div class="px-3.5 py-2.5 flex items-center justify-between border-t border-outline/60">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-on-surface truncate">${escapeHtml(cam.name)}</p>
                  <p class="font-mono text-[10px] text-on-surface-variant">${cam.zone}</p>
                </div>
                <span class="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary-container">open_in_full</span>
              </div>
            </button>
          `;
          })
          .join("")}
      </section>
    </div>
  `;

  container.querySelector("#secQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#secAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelectorAll("[data-dvr-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      dvrFilter = btn.getAttribute("data-dvr-filter") || "all";
      renderSecurityView(container, { openQuickFind, openAlerts });
    });
  });

  container.querySelector("#secHdToggle")?.addEventListener("click", () => {
    hdMode = !hdMode;
    renderSecurityView(container, { openQuickFind, openAlerts });
  });

  container.querySelectorAll("[data-focus-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      focusedCamId = btn.getAttribute("data-focus-cam");
      renderSecurityView(container, { openQuickFind, openAlerts });
    });
  });

  container.querySelector("#secExitFocus")?.addEventListener("click", () => {
    focusedCamId = null;
    renderSecurityView(container, { openQuickFind, openAlerts });
  });
}
