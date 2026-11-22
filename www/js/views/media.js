import {
  controlMedia,
  escapeHtml,
  formatDuration,
  showToast,
  store,
} from "../api.js";

function renderAlbumArtSvg(accent = "#ff6370") {
  return `
    <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-outline bg-[#0e1013] shrink-0">
      <svg viewBox="0 0 120 120" class="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="artGlow" cx="52%" cy="55%" r="58%">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.95" />
            <stop offset="45%" stop-color="${accent}" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#0e1013" stop-opacity="1" />
          </radialGradient>
        </defs>
        <rect width="120" height="120" fill="#0e1013" />
        <rect width="120" height="120" fill="url(#artGlow)" />
        <g stroke="#e2e2e5" stroke-opacity="0.16" fill="none">
          <circle cx="60" cy="60" r="46" stroke-dasharray="3 4" />
          <circle cx="60" cy="60" r="32" />
          <circle cx="60" cy="60" r="18" stroke="${accent}" stroke-opacity="0.7" />
        </g>
        <g fill="${accent}" fill-opacity="0.85">
          <rect x="26" y="64" width="4" height="18" rx="2" />
          <rect x="34" y="50" width="4" height="32" rx="2" />
          <rect x="42" y="56" width="4" height="26" rx="2" />
          <rect x="50" y="40" width="4" height="42" rx="2" />
          <rect x="58" y="34" width="4" height="48" rx="2" />
          <rect x="66" y="46" width="4" height="36" rx="2" />
          <rect x="74" y="52" width="4" height="30" rx="2" />
          <rect x="82" y="60" width="4" height="22" rx="2" />
          <rect x="90" y="66" width="4" height="16" rx="2" />
        </g>
      </svg>
      <div class="absolute bottom-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 border border-outline/80 font-mono text-[9px] tracking-wider uppercase text-on-surface">
        <span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
        <span>LIVE</span>
      </div>
    </div>
  `;
}

function renderEqualizerBars(playing) {
  const heights = [35, 65, 92, 52, 78, 44, 100, 62, 82, 48, 70, 38];
  return `
    <div class="hidden sm:flex items-center gap-1.5 h-12 px-4 py-2 rounded-md bg-surface-container-lowest/80 border border-outline/70 ${
      playing ? "eq-playing" : "eq-paused"
    }" aria-hidden="true">
      ${heights
        .map(
          (h, i) => `
        <span class="eq-bar w-[3px] rounded-full bg-primary-container" style="height:${h}%;--eq-dur:${(
            0.75 +
            (i % 4) * 0.18
          ).toFixed(2)}s;--eq-delay:${(i * 0.07).toFixed(2)}s"></span>
      `
        )
        .join("")}
    </div>
  `;
}

export function renderMediaView(container, { openQuickFind, openAlerts }) {
  const media = store.media;
  if (!media) {
    container.innerHTML = `<div class="py-16 text-center font-mono text-xs text-on-surface-variant">Loading audio deck…</div>`;
    return;
  }

  const cfg = store.config;
  const track = media.track;
  const pct = track.durationSec ? Math.min(100, (media.positionSec / track.durationSec) * 100) : 0;

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex items-baseline gap-3">
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Media</h1>
          <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
            ${escapeHtml(cfg.userName)} · ${escapeHtml(cfg.studioName)}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="mediaQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="mediaAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- Now Playing Hero Card -->
      <section class="dock-surface-card rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5" style="background-image: radial-gradient(circle at 22% 50%, rgba(255, 99, 112, 0.12), transparent 55%);">
        <div class="flex items-center gap-5 min-w-0">
          ${renderAlbumArtSvg(track.accent)}
          <div class="min-w-0">
            <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-primary flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full ${media.playing ? "bg-primary-container" : "bg-on-surface-variant"}"></span>
              <span>${escapeHtml(cfg.activeMacTarget)}</span>
            </p>
            <h2 id="mediaNowTitle" class="font-headline text-xl sm:text-2xl font-semibold text-on-surface truncate mt-1">${escapeHtml(track.title)}</h2>
            <p class="text-xs text-on-surface-variant mt-0.5 truncate">${escapeHtml(media.source)} · ${escapeHtml(track.artist)} · ${escapeHtml(cfg.studioName)} smart dock</p>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest/90 border border-outline font-mono text-[11px] text-on-surface">
                <span class="material-symbols-outlined text-[14px] text-tertiary">graphic_eq</span>
                <span>${media.playing ? "Playing" : "Paused"} at ${escapeHtml(track.quality)}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest/90 border border-outline font-mono text-[11px] text-on-surface-variant">
                <span class="material-symbols-outlined text-[14px] text-primary-container">airplay</span>
                <span>AirPlay Output</span>
              </span>
            </div>
          </div>
        </div>
        ${renderEqualizerBars(media.playing)}
      </section>

      <!-- Two KPI Stat Tiles -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">ACTIVE OUTPUT</span>
            <span class="material-symbols-outlined text-[18px] text-primary-container">headphones</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <p id="mediaActiveOutputValue" class="font-headline text-xl font-semibold text-on-surface">${escapeHtml(media.outputLabel)}</p>
            <span class="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono text-[11px]">+1</span>
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span>vs built-in audio</span>
            <span>of 3 zones</span>
          </div>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">QUEUE LENGTH</span>
            <span class="material-symbols-outlined text-[18px] text-primary-container">queue_music</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="font-headline text-xl font-semibold text-on-surface tabular-nums">${media.queue.length} tracks</p>
            <span class="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono text-[11px]">Lossless</span>
          </div>
          <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
            <span>studio curated session</span>
            <span>of 50 limit</span>
          </div>
        </div>
      </section>

      <!-- Playback & Volume + Studio Queue -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Playback & Volume Deck -->
        <div class="lg:col-span-5 dock-surface-card rounded-lg p-5 flex flex-col justify-between gap-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary-container">tune</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Playback &amp; Volume</h2>
            </div>
            <span id="mediaStatusTag" class="font-mono text-[11px] uppercase tracking-wider ${media.playing ? "text-tertiary" : "text-on-surface-variant"}">
              ${media.playing ? "PLAYING" : "PAUSED"}
            </span>
          </div>

          <!-- Progress Scrubber -->
          <div class="space-y-2">
            <input id="mediaSeekSlider" type="range" min="0" max="${track.durationSec}" value="${media.positionSec}" class="dock-slider w-full" aria-label="Track playback position" style="background: linear-gradient(to right, #ff6370 ${pct.toFixed(1)}%, #282a2c ${pct.toFixed(1)}%);" />
            <div class="flex items-center justify-between font-mono text-[11px] text-on-surface-variant tabular-nums">
              <span id="mediaPosLabel">${formatDuration(media.positionSec)}</span>
              <span>${formatDuration(track.durationSec)}</span>
            </div>
          </div>

          <!-- Transport Controls -->
          <div class="flex items-center justify-center gap-3">
            <button id="mediaShuffleBtn" type="button" class="p-2 rounded border ${
              media.shuffle
                ? "bg-primary-soft border-primary-container/50 text-primary-container"
                : "bg-transparent border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }" aria-label="Toggle Shuffle" aria-pressed="${media.shuffle}">
              <span class="material-symbols-outlined text-[20px]">shuffle</span>
            </button>
            <button id="mediaPrevBtn" type="button" class="w-10 h-10 rounded-md bg-surface-container-high border border-outline text-on-surface hover:bg-surface-bright flex items-center justify-center" aria-label="Previous Track">
              <span class="material-symbols-outlined text-[20px]">skip_previous</span>
            </button>
            <button id="mediaPlayBtn" type="button" class="w-12 h-12 rounded-md bg-primary-container text-on-primary-container hover:brightness-110 flex items-center justify-center shadow-sm" aria-label="${media.playing ? "Pause playback" : "Play playback"}">
              <span class="material-symbols-outlined is-filled text-[26px]">${media.playing ? "pause" : "play_arrow"}</span>
            </button>
            <button id="mediaNextBtn" type="button" class="w-10 h-10 rounded-md bg-surface-container-high border border-outline text-on-surface hover:bg-surface-bright flex items-center justify-center" aria-label="Next Track">
              <span class="material-symbols-outlined text-[20px]">skip_next</span>
            </button>
            <button id="mediaRepeatBtn" type="button" class="p-2 rounded border ${
              media.repeat !== "off"
                ? "bg-primary-soft border-primary-container/50 text-primary-container"
                : "bg-transparent border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }" aria-label="Cycle Repeat Mode (${media.repeat})" title="Repeat: ${media.repeat}">
              <span class="material-symbols-outlined text-[20px]">${media.repeat === "one" ? "repeat_one" : "repeat"}</span>
            </button>
          </div>

          <!-- Volume Bar -->
          <div class="rounded-md bg-surface-container-lowest/80 border border-outline/70 px-3.5 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant">volume_up</span>
            <input id="mediaVolumeSlider" type="range" min="0" max="100" value="${media.volume}" class="dock-slider flex-1" aria-label="Master Volume" style="background: linear-gradient(to right, #ff6370 ${media.volume}%, #282a2c ${media.volume}%);" />
            <span id="mediaVolLabel" class="font-mono text-xs text-on-surface w-9 text-right tabular-nums">${media.volume}%</span>
          </div>

          <!-- Output Routing -->
          <div class="space-y-2">
            <p class="font-mono text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">OUTPUT ROUTING</p>
            <div class="grid grid-cols-3 gap-2">
              ${[
                { id: "airpods", label: "AirPods Pro", icon: "headphones" },
                { id: "monitors", label: "Monitors", icon: "speaker" },
                { id: "mac", label: "Mac Studio", icon: "desktop_mac" },
              ]
                .map((z) => {
                  const active = media.outputZone === z.id;
                  return `
                  <button type="button" data-output-zone="${z.id}" data-output-label="${escapeHtml(z.label)}" aria-pressed="${active}" class="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary-container border-primary-container text-on-primary-container font-semibold"
                      : "bg-surface-container-high border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
                  }">
                    <span class="material-symbols-outlined text-[18px]">${z.icon}</span>
                    <span class="truncate">${z.label}</span>
                  </button>
                `;
                })
                .join("")}
            </div>
          </div>
        </div>

        <!-- Studio Queue -->
        <div class="lg:col-span-7 dock-surface-card rounded-lg p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2 pb-1">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary-container">playlist_play</span>
              <h2 class="font-headline text-[15px] font-semibold text-on-surface">Studio Queue</h2>
            </div>
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">${media.queue.length} TRACKS · LOSSLESS</span>
          </div>

          <div class="divide-y divide-outline/50" role="list">
            ${media.queue
              .map((t) => {
                const isCurrent = t.id === track.id;
                return `
                <button type="button" data-select-track="${escapeHtml(t.id)}" class="w-full flex items-center justify-between gap-4 px-3 py-3 text-left rounded-md transition-colors ${
                  isCurrent
                    ? "bg-primary-soft/65 border border-primary-container/30 my-0.5"
                    : "hover:bg-surface-container-high/60"
                }">
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-6 text-center shrink-0">
                      ${
                        isCurrent
                          ? `<span class="material-symbols-outlined text-[18px] text-primary-container">equalizer</span>`
                          : `<span class="font-mono text-xs text-on-surface-variant tabular-nums">${escapeHtml(t.index)}</span>`
                      }
                    </div>
                    <div class="min-w-0">
                      <p class="text-[13px] font-medium truncate ${isCurrent ? "text-primary" : "text-on-surface"}">${escapeHtml(t.title)}</p>
                      <p class="text-xs text-on-surface-variant truncate">${escapeHtml(t.artist)} · ${escapeHtml(t.album)}</p>
                    </div>
                  </div>
                  <span class="font-mono text-xs tabular-nums shrink-0 ${isCurrent ? "text-primary" : "text-on-surface-variant"}">${formatDuration(t.durationSec)}</span>
                </button>
              `;
              })
              .join("")}
          </div>
        </div>
      </section>
    </div>
  `;

  container.querySelector("#mediaQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#mediaAlertsBtn")?.addEventListener("click", openAlerts);

  const send = async (payload, toastMsg) => {
    try {
      await controlMedia(payload);
      if (toastMsg) showToast(toastMsg, "ok");
    } catch (err) {
      showToast(err.message || "Media action failed", "error");
    }
  };

  container.querySelector("#mediaPlayBtn")?.addEventListener("click", () => send({ action: "toggle" }));
  container.querySelector("#mediaPrevBtn")?.addEventListener("click", () => send({ action: "prev" }));
  container.querySelector("#mediaNextBtn")?.addEventListener("click", () => send({ action: "next" }));
  container.querySelector("#mediaShuffleBtn")?.addEventListener("click", () => send({ action: "shuffle" }));
  container.querySelector("#mediaRepeatBtn")?.addEventListener("click", () => send({ action: "repeat" }));

  const seek = container.querySelector("#mediaSeekSlider");
  seek?.addEventListener("change", () => send({ action: "seek", positionSec: Number(seek.value) }));

  const vol = container.querySelector("#mediaVolumeSlider");
  const volLabel = container.querySelector("#mediaVolLabel");
  vol?.addEventListener("input", () => {
    const v = Number(vol.value);
    if (volLabel) volLabel.textContent = `${v}%`;
    vol.style.background = `linear-gradient(to right, #ff6370 ${v}%, #282a2c ${v}%)`;
  });
  vol?.addEventListener("change", () => send({ action: "volume", volume: Number(vol.value) }));

  container.querySelectorAll("[data-output-zone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const zone = btn.getAttribute("data-output-zone");
      const label = btn.getAttribute("data-output-label") || zone;
      send({ action: "output", outputZone: zone }, `Output routed to ${label}`);
    });
  });

  container.querySelectorAll("[data-select-track]").forEach((btn) => {
    btn.addEventListener("click", () => {
      send({ action: "select_track", trackId: btn.getAttribute("data-select-track") });
    });
  });
}
