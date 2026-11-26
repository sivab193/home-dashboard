import "../../video-stream.js";
import {
  escapeHtml,
  fetchSecurity,
  getCctvOrigin,
  getCctvOriginOverride,
  getCctvWsOrigin,
  setCctvOrigin,
  showToast,
  store,
} from "../api.js";

const DEFAULT_CAMERAS = [
  { id: "cam1", main: "cam1", sub: "cam1_sub", name: "Cam 1", dvr: "dvr1", zone: "DVR 1 · CH 1" },
  { id: "cam2", main: "cam2", sub: "cam2_sub", name: "Cam 2", dvr: "dvr1", zone: "DVR 1 · CH 2" },
  { id: "cam3", main: "cam3", sub: "cam3_sub", name: "Cam 3", dvr: "dvr1", zone: "DVR 1 · CH 3" },
  { id: "cam4", main: "cam4", sub: "cam4_sub", name: "Cam 4", dvr: "dvr1", zone: "DVR 1 · CH 4" },
  { id: "cam5", main: "cam5", sub: "cam5_sub", name: "Cam 5", dvr: "dvr2", zone: "DVR 2 · CH 1" },
  { id: "cam6", main: "cam6", sub: "cam6_sub", name: "Cam 6", dvr: "dvr2", zone: "DVR 2 · CH 2" },
  { id: "cam7", main: "cam7", sub: "cam7_sub", name: "Cam 7", dvr: "dvr2", zone: "DVR 2 · CH 3" },
  { id: "cam8", main: "cam8", sub: "cam8_sub", name: "Cam 8", dvr: "dvr2", zone: "DVR 2 · CH 4" },
];

let dvrFilter = "all"; // all | dvr1 | dvr2
let hdMode = false;
let focusedCamId = null;
let lastRenderSignature = "";

function buildCameraList(streams) {
  const knownKeys = new Set(DEFAULT_CAMERAS.flatMap((c) => [c.main, c.sub]));
  const extras = Object.keys(streams || {})
    .filter((key) => !key.endsWith("_sub") && !knownKeys.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      id: key,
      main: key,
      sub: streams[`${key}_sub`] ? `${key}_sub` : key,
      name: key,
      dvr: "other",
      zone: "External Stream",
    }));
  return [...DEFAULT_CAMERAS, ...extras];
}

function isCameraAvailable(cam, streams, health) {
  if (health?.[cam.main]?.down === true) return false;
  return Boolean(streams?.[cam.sub] || streams?.[cam.main]);
}

function selectStreamName(cam, streams, preferMain) {
  if (preferMain && streams?.[cam.main]) return cam.main;
  if (!preferMain && streams?.[cam.sub]) return cam.sub;
  if (streams?.[cam.main]) return cam.main;
  if (streams?.[cam.sub]) return cam.sub;
  return cam.main;
}

function mountVideoStream(host, streamName, { onLive, onError } = {}) {
  if (!host || !streamName) return;
  const el = document.createElement("video-stream");
  el.mode = "webrtc,mse";
  el.background = false;
  el.src = `${getCctvWsOrigin()}/api/ws?src=${encodeURIComponent(streamName)}`;
  host.appendChild(el);

  const infoEl = el.querySelector(".info");
  if (infoEl) {
    const observer = new MutationObserver(() => {
      const mode = el.querySelector(".mode")?.textContent?.trim().toLowerCase();
      const status = el.querySelector(".status")?.textContent?.trim() || "";
      if (mode === "error" && typeof onError === "function") {
        onError(status || "Stream unavailable");
      }
    });
    observer.observe(infoEl, { childList: true, subtree: true, characterData: true });
  }

  const attachVideoListeners = () => {
    const video = el.querySelector("video");
    if (!video) {
      if (host.isConnected) requestAnimationFrame(attachVideoListeners);
      return;
    }
    video.muted = true;
    video.playsInline = true;
    video.removeAttribute("controls");
    const markPlaying = () => {
      if (typeof onLive === "function") onLive();
    };
    video.addEventListener("playing", markPlaying, { once: true });
    if (video.readyState >= 3 && !video.paused) markPlaying();
  };
  attachVideoListeners();
}

function formatOriginLabel(originOverride) {
  if (!originOverride) return "Local";
  return originOverride.replace(/^https?:\/\//, "");
}

function computeRenderSignature(cameras, streams, health) {
  const origin = getCctvOrigin();
  const avail = cameras
    .map((c) => `${c.id}:${isCameraAvailable(c, streams, health) ? 1 : 0}`)
    .join(",");
  return `${dvrFilter}|${hdMode ? 1 : 0}|${focusedCamId || ""}|${origin}|${avail}`;
}

export function renderSecurityView(container, { openQuickFind, openAlerts, openModal }) {
  const streams = store.streams || {};
  const health = store.health || {};
  const cameras = buildCameraList(streams);
  const visible =
    dvrFilter === "all" ? cameras : cameras.filter((c) => c.dvr === dvrFilter);
  const onlineCount = cameras.filter((c) => isCameraAvailable(c, streams, health)).length;
  const focused = focusedCamId ? cameras.find((c) => c.id === focusedCamId) : null;
  const originOverride = getCctvOriginOverride();

  const signature = computeRenderSignature(cameras, streams, health);
  if (container.querySelector("[data-security-root]") && signature === lastRenderSignature) {
    return;
  }
  lastRenderSignature = signature;

  const focusedIdx = focused ? visible.findIndex((c) => c.id === focused.id) : -1;

  container.innerHTML = `
    <div data-security-root class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">SECURITY MATRIX</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${onlineCount} OF ${cameras.length} STREAMS CONNECTED</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Security</h1>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <div class="inline-flex items-center rounded bg-surface-container-low border border-outline p-0.5" role="tablist" aria-label="DVR filter">
            ${[
              { id: "all", label: `All (${cameras.length})` },
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

          <button id="secFeedSourceBtn" type="button" class="px-3 py-1.5 rounded border font-mono text-xs flex items-center gap-1.5 transition-colors ${
            originOverride
              ? "bg-primary-soft border-primary-container/50 text-primary"
              : "bg-surface-container-low border-outline text-on-surface-variant hover:text-on-surface"
          }" title="Set local or Tailscale go2rtc stream server">
            <span class="material-symbols-outlined text-[15px]">hub</span>
            <span>Feed: ${escapeHtml(formatOriginLabel(originOverride))}</span>
          </button>

          <button id="secRefreshBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Refresh streams" title="Refresh streams">
            <span class="material-symbols-outlined text-[18px]">refresh</span>
          </button>
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
          ? (() => {
              const live = isCameraAvailable(focused, streams, health);
              const streamName = selectStreamName(focused, streams, true);
              return `
        <section class="dock-surface-card rounded-lg overflow-hidden">
          <div class="px-4 py-3 border-b border-outline flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="material-symbols-outlined text-[18px] text-primary-container">videocam</span>
              <span class="font-headline text-sm font-semibold text-on-surface truncate">${escapeHtml(focused.name)}</span>
              <span class="font-mono text-[11px] uppercase text-on-surface-variant">${escapeHtml(focused.zone)} · ${escapeHtml(streamName)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button id="secPrevCam" type="button" class="px-2.5 py-1 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright" ${
                visible.length < 2 ? "disabled" : ""
              }>Prev</button>
              <button id="secNextCam" type="button" class="px-2.5 py-1 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright" ${
                visible.length < 2 ? "disabled" : ""
              }>Next</button>
              <button id="secExitFocus" type="button" class="px-3 py-1 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">Back to Grid</button>
            </div>
          </div>
          <div class="relative aspect-video bg-[#0b0d10] flex flex-col items-center justify-center overflow-hidden">
            ${
              live
                ? `<div class="cctv-stream-host cctv-focus-host w-full h-full" data-stream-host="${escapeHtml(streamName)}"></div>`
                : `
              <span class="material-symbols-outlined text-[36px] text-on-surface-variant/60">videocam_off</span>
              <p class="font-headline text-sm font-medium text-on-surface mt-2">${escapeHtml(focused.name)} (${escapeHtml(streamName)})</p>
              <p class="font-mono text-xs text-on-surface-variant max-w-md text-center px-6 mt-1">Stream offline or CCTV server unreachable at ${escapeHtml(getCctvOrigin() || window.location.origin)}.</p>
            `
            }
          </div>
        </section>
      `;
            })()
          : `
      <!-- Camera Matrix -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        ${visible
          .map((cam) => {
            const live = isCameraAvailable(cam, streams, health);
            const streamName = selectStreamName(cam, streams, hdMode);
            const streamKind = streamName.endsWith("_sub") ? "SD" : "HD";
            return `
            <button type="button" data-focus-cam="${escapeHtml(cam.id)}" class="dock-surface-card rounded-lg overflow-hidden text-left hover:border-outline-strong transition-colors group">
              <div class="relative aspect-video bg-[#0c0e11] flex flex-col items-center justify-center overflow-hidden">
                ${
                  live
                    ? `<div class="cctv-stream-host absolute inset-0 w-full h-full" data-stream-host="${escapeHtml(streamName)}" data-cam-id="${escapeHtml(cam.id)}"></div>`
                    : `
                  <div class="absolute inset-2.5 border border-outline/30 rounded-sm pointer-events-none"></div>
                  <span class="material-symbols-outlined text-[24px] text-on-surface-variant/50 group-hover:text-primary-container transition-colors">videocam_off</span>
                  <span class="font-mono text-[10px] text-on-surface-variant mt-1.5">AWAITING STREAM</span>
                `
                }
                <div class="absolute top-2.5 left-2.5 z-10 px-1.5 py-0.5 rounded bg-black/75 border border-outline/80 font-mono text-[9.5px] uppercase text-on-surface-variant pointer-events-none">
                  ${escapeHtml(cam.dvr.toUpperCase())} · ${streamKind}
                </div>
                <div data-cam-badge="${escapeHtml(cam.id)}" class="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 border border-outline/80 font-mono text-[9.5px] pointer-events-none">
                  <span data-badge-dot class="w-1.5 h-1.5 rounded-full ${live ? "bg-warning" : "bg-on-surface-variant"}"></span>
                  <span data-badge-text class="${live ? "text-warning" : "text-on-surface-variant"}">${live ? "CONNECTING" : "IDLE"}</span>
                </div>
              </div>
              <div class="px-3.5 py-2.5 flex items-center justify-between border-t border-outline/60">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-on-surface truncate">${escapeHtml(cam.name)}</p>
                  <p class="font-mono text-[10px] text-on-surface-variant">${escapeHtml(cam.zone)}</p>
                </div>
                <span class="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary-container">open_in_full</span>
              </div>
            </button>
          `;
          })
          .join("")}
      </section>
      `
      }
    </div>
  `;

  // Mount live <video-stream> players into rendered stream hosts
  container.querySelectorAll("[data-stream-host]").forEach((host) => {
    const streamName = host.getAttribute("data-stream-host");
    const camId = host.getAttribute("data-cam-id");
    const setBadge = (dotClass, textClass, label) => {
      if (!camId) return;
      const badge = container.querySelector(`[data-cam-badge="${CSS.escape(camId)}"]`);
      const dot = badge?.querySelector("[data-badge-dot]");
      const text = badge?.querySelector("[data-badge-text]");
      if (dot) {
        dot.classList.remove("bg-warning", "bg-on-surface-variant", "bg-tertiary", "bg-danger");
        dot.classList.add(dotClass);
      }
      if (text) {
        text.classList.remove("text-warning", "text-on-surface-variant", "text-tertiary", "text-danger");
        text.classList.add(textClass);
        text.textContent = label;
      }
    };
    mountVideoStream(host, streamName, {
      onLive: () => {
        host.querySelector("[data-stream-error]")?.remove();
        setBadge("bg-tertiary", "text-tertiary", "LIVE");
      },
      onError: (msg) => {
        setBadge("bg-danger", "text-danger", "ERROR");
        let errBox = host.querySelector("[data-stream-error]");
        if (!errBox) {
          errBox = document.createElement("div");
          errBox.setAttribute("data-stream-error", "");
          errBox.className =
            "absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0c0e11]/90 px-4 text-center pointer-events-none";
          host.appendChild(errBox);
        }
        errBox.innerHTML = `
          <span class="material-symbols-outlined text-[22px] text-danger">error</span>
          <span class="font-mono text-[10.5px] text-danger mt-1 break-all">${escapeHtml(msg)}</span>
        `;
      },
    });
  });

  container.querySelector("#secQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#secAlertsBtn")?.addEventListener("click", openAlerts);
  container.querySelector("#secRefreshBtn")?.addEventListener("click", () => {
    lastRenderSignature = "";
    fetchSecurity().catch(() => {});
  });

  container.querySelector("#secFeedSourceBtn")?.addEventListener("click", () => {
    const current = getCctvOriginOverride();
    openModal({
      title: "CCTV Feed Server",
      submitLabel: "Save Feed Source",
      bodyHtml: `
        <div class="space-y-3">
          <p class="text-xs text-on-surface-variant">
            Leave blank to use this dashboard's local <code>/api/streams</code> and <code>/api/ws</code> proxy,
            or enter a remote <code>go2rtc</code> / dashboard URL reachable over LAN or Tailscale.
          </p>
          <div>
            <label class="block text-xs font-medium text-on-surface mb-1.5" for="cctvOriginInput">Server URL</label>
            <input id="cctvOriginInput" name="origin" type="url" value="${escapeHtml(current)}" placeholder="http://100.x.y.z:1985" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-container" />
          </div>
          <p class="font-mono text-[11px] text-on-surface-variant">
            Clear the field and save to revert to same-origin (Local).
          </p>
        </div>
      `,
      onSubmit: async (formData) => {
        const next = String(formData.get("origin") || "").trim();
        setCctvOrigin(next);
        lastRenderSignature = "";
        await fetchSecurity();
        showToast(
          next ? `CCTV feed set to ${formatOriginLabel(next)}` : "CCTV feed reset to Local",
          "ok"
        );
      },
    });
  });

  container.querySelectorAll("[data-dvr-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      dvrFilter = btn.getAttribute("data-dvr-filter") || "all";
      renderSecurityView(container, { openQuickFind, openAlerts, openModal });
    });
  });

  container.querySelector("#secHdToggle")?.addEventListener("click", () => {
    hdMode = !hdMode;
    renderSecurityView(container, { openQuickFind, openAlerts, openModal });
  });

  container.querySelectorAll("[data-focus-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      focusedCamId = btn.getAttribute("data-focus-cam");
      renderSecurityView(container, { openQuickFind, openAlerts, openModal });
    });
  });

  container.querySelector("#secExitFocus")?.addEventListener("click", () => {
    focusedCamId = null;
    renderSecurityView(container, { openQuickFind, openAlerts, openModal });
  });

  container.querySelector("#secPrevCam")?.addEventListener("click", () => {
    if (visible.length < 2 || focusedIdx < 0) return;
    focusedCamId = visible[(focusedIdx - 1 + visible.length) % visible.length].id;
    renderSecurityView(container, { openQuickFind, openAlerts, openModal });
  });

  container.querySelector("#secNextCam")?.addEventListener("click", () => {
    if (visible.length < 2 || focusedIdx < 0) return;
    focusedCamId = visible[(focusedIdx + 1) % visible.length].id;
    renderSecurityView(container, { openQuickFind, openAlerts, openModal });
  });
}
