import {
  bootstrapData,
  commandHomeEntity,
  controlMedia,
  escapeHtml,
  fetchHome,
  fetchMedia,
  fetchWeather,
  formatTime,
  showToast,
  store,
  subscribe,
  toggleAutomation,
} from "./api.js";
import { renderHomeView } from "./views/home.js";
import { renderMediaView } from "./views/media.js";
import { renderWeatherView } from "./views/weather.js";
import { renderScheduleView } from "./views/schedule.js";
import { renderAutomationsView } from "./views/automations.js";
import { renderControlsView, setControlsSubTab } from "./views/controls.js";
import { renderSecurityView } from "./views/security.js";
import { renderConfigureWidgetView } from "./views/configure-widget.js";
import { renderConfigView } from "./views/config.js";
import { renderDockScreen, stopDockScreen } from "./views/dock.js";

const ROUTES = [
  { path: "/", label: "Home", icon: "home", keywords: "dashboard overview kpi shift lighting" },
  { path: "/dock", label: "Dock Screen", icon: "desktop_windows", keywords: "clock fullscreen ambient display status" },
  { path: "/media", label: "Media", icon: "play_circle", keywords: "audio music airpods speakers queue" },
  { path: "/weather", label: "Weather", icon: "partly_cloudy_day", keywords: "forecast radar humidity wind aqi" },
  { path: "/schedule", label: "Schedule", icon: "calendar_today", keywords: "calendar shift timeline events" },
  { path: "/automations", label: "Automations", icon: "schedule", keywords: "rules time schedule devices groups rooms" },
  { path: "/controls", label: "Smart Home", icon: "deployed_code", keywords: "lights rooms switches plugs sensors" },
  { path: "/floorplan", label: "3D Floorplan", icon: "view_in_ar", keywords: "diorama 3d map house model" },
  { path: "/security", label: "Security", icon: "videocam", keywords: "cameras cctv dvr streams alerts" },
  { path: "/configure-widget", label: "Configure Widget", icon: "dashboard_customize", keywords: "layout modules stocks preview" },
  { path: "/config", label: "Config", icon: "tune", keywords: "preferences opacity account clock dock" },
];

function normalizeRoute(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  if (clean === "/home" || clean === "/dashboard") return "/";
  if (clean === "/home/controls") return "/controls";
  if (clean === "/home/floorplan") return "/floorplan";
  if (ROUTES.some((r) => r.path === clean)) return clean;
  return "/";
}

function updateNavActive(route) {
  const navMatch = route === "/floorplan" ? "/controls" : route;
  document.querySelectorAll("#sidebarNav [data-nav]").forEach((link) => {
    const isActive = link.getAttribute("data-nav") === navMatch;
    link.classList.toggle("bg-primary-container", isActive);
    link.classList.toggle("text-on-primary-container", isActive);
    link.classList.toggle("font-semibold", isActive);
    link.classList.toggle("text-on-surface-variant", !isActive);
    link.classList.toggle("hover:bg-surface-container-high", !isActive);
    link.classList.toggle("hover:text-on-surface", !isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen();
    } else {
      showToast("Full screen is not available in this browser", "error");
    }
  } catch (err) {
    showToast(err.message || "Could not change full screen mode", "error");
  }
}

function updateFullscreenControls() {
  const active = Boolean(document.fullscreenElement);
  document.querySelectorAll("#topFullscreenBtn, #dockFullscreenBtn").forEach((button) => {
    const icon = button.querySelector(".material-symbols-outlined");
    const label = button.querySelector("span:last-child");
    button.setAttribute("aria-label", active ? "Exit full screen" : "Enter full screen");
    if (icon) icon.textContent = active ? "fullscreen_exit" : "fullscreen";
    if (button.id === "dockFullscreenBtn" && label) label.textContent = active ? "Exit full screen" : "Full screen";
  });
}

function setMobileNav(open) {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("mobileBackdrop");
  if (!sidebar || !backdrop) return;
  sidebar.classList.toggle("-translate-x-full", !open);
  backdrop.classList.toggle("hidden", !open);
}

// ---- Generic Action Modal ----
let activeModalSubmit = null;

export function openModal({ title, bodyHtml, submitLabel = "Confirm", onSubmit }) {
  const dialog = document.getElementById("actionModal");
  const titleEl = document.getElementById("actionModalTitle");
  const bodyEl = document.getElementById("actionModalBody");
  const submitBtn = document.getElementById("actionModalSubmit");
  if (!dialog || !titleEl || !bodyEl || !submitBtn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  submitBtn.textContent = submitLabel;
  activeModalSubmit = onSubmit;
  dialog.showModal();
  const firstInput = bodyEl.querySelector("input, select");
  if (firstInput) firstInput.focus();
}

function setupActionModal() {
  const dialog = document.getElementById("actionModal");
  const form = document.getElementById("actionModalForm");
  const closeBtn = document.getElementById("actionModalClose");
  const cancelBtn = document.getElementById("actionModalCancel");
  if (!dialog || !form) return;

  const close = () => {
    activeModalSubmit = null;
    dialog.close();
  };
  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeModalSubmit) {
      close();
      return;
    }
    const submitBtn = document.getElementById("actionModalSubmit");
    const prevLabel = submitBtn?.textContent || "Confirm";
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving…";
      }
      await activeModalSubmit(new FormData(form));
      close();
    } catch (err) {
      showToast(err.message || "Action failed", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = prevLabel;
      }
    }
  });
}

// ---- Quick Find Command Palette ----
function renderQuickFindResults(query = "") {
  const list = document.getElementById("quickFindResults");
  const dialog = document.getElementById("quickFindDialog");
  if (!list) return;
  const q = query.trim().toLowerCase();

  const entries = [];
  for (const r of ROUTES) {
    if (!q || r.label.toLowerCase().includes(q) || r.keywords.includes(q)) {
      entries.push({
        group: "Views",
        icon: r.icon,
        title: r.label,
        subtitle: `Navigate to ${r.path}`,
        run: () => navigate(r.path),
      });
    }
  }
  for (const dev of store.home?.items || []) {
    if (!q || dev.name.toLowerCase().includes(q) || dev.room.toLowerCase().includes(q)) {
      entries.push({
        group: "Smart Home",
        icon: dev.type === "light" ? "lightbulb" : "power",
        title: dev.name,
        subtitle: `${dev.room} · currently ${dev.state.toUpperCase()} (click to toggle)`,
        run: async () => {
          await commandHomeEntity(dev.id, dev.state === "on" ? "turn_off" : "turn_on");
          showToast(`${dev.name} toggled`, "ok");
        },
      });
    }
  }
  for (const rule of store.automations?.rules || []) {
    if (!q || rule.name.toLowerCase().includes(q) || rule.condition.toLowerCase().includes(q)) {
      entries.push({
        group: "Climate Automations",
        icon: "thermostat",
        title: rule.name,
        subtitle: `${rule.status.toUpperCase()} · ${rule.condition} → ${rule.action}`,
        run: async () => {
          await toggleAutomation(rule.id);
          showToast(`${rule.name} updated`, "ok");
        },
      });
    }
  }
  for (const track of store.media?.queue || []) {
    if (!q || track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)) {
      entries.push({
        group: "Media Queue",
        icon: "music_note",
        title: track.title,
        subtitle: `Play ${track.artist} · ${track.album}`,
        run: async () => {
          await controlMedia({ action: "select_track", trackId: track.id });
          navigate("/media");
        },
      });
    }
  }

  if (!entries.length) {
    list.innerHTML = `<div class="py-8 text-center font-mono text-xs text-on-surface-variant">No matches for "${escapeHtml(query)}"</div>`;
    return;
  }

  list.innerHTML = entries
    .slice(0, 12)
    .map(
      (item, idx) => `
      <button type="button" data-qf-idx="${idx}" class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-surface-container-high text-left transition-colors">
        <div class="flex items-center gap-3 min-w-0">
          <span class="material-symbols-outlined text-[18px] text-primary-container shrink-0">${item.icon}</span>
          <div class="min-w-0">
            <p class="text-xs font-medium text-on-surface truncate">${escapeHtml(item.title)}</p>
            <p class="font-mono text-[10.5px] text-on-surface-variant truncate">${escapeHtml(item.subtitle)}</p>
          </div>
        </div>
        <span class="font-mono text-[10px] uppercase text-on-surface-variant shrink-0">${item.group}</span>
      </button>
    `
    )
    .join("");

  list.querySelectorAll("[data-qf-idx]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-qf-idx"));
      dialog?.close();
      await entries[idx]?.run();
    });
  });
}

export function openQuickFind() {
  const dialog = document.getElementById("quickFindDialog");
  const input = document.getElementById("quickFindInput");
  if (!dialog || !input) return;
  input.value = "";
  renderQuickFindResults("");
  dialog.showModal();
  input.focus();
}

// ---- Alerts Slide-Over Drawer ----
function renderAlertsDrawer() {
  const body = document.getElementById("alertsDrawerBody");
  const dot = document.getElementById("topAlertDot");
  if (!body) return;

  const unreadCount = store.activityLog.filter((a) => !a.read).length + (store.events?.length || 0);
  if (dot) dot.classList.toggle("hidden", unreadCount === 0);

  const activityCards = store.activityLog.map(
    (item) => `
    <div class="rounded-lg bg-surface-container border border-outline p-3.5 space-y-1">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-on-surface">${escapeHtml(item.title)}</span>
        <span class="font-mono text-[10px] text-on-surface-variant tabular-nums">${escapeHtml(item.time)}</span>
      </div>
      <p class="text-xs text-on-surface-variant">${escapeHtml(item.detail)}</p>
    </div>
  `
  );

  const cameraCards = (store.events || []).slice(0, 8).map(
    (ev) => `
    <div class="rounded-lg bg-primary-soft/30 border border-primary-container/30 p-3.5 space-y-1">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-primary">${escapeHtml(ev.camera || "Security Alert")}</span>
        <span class="font-mono text-[10px] text-on-surface-variant">${escapeHtml(ev.time || "")}</span>
      </div>
      <p class="text-xs text-on-surface-variant">${escapeHtml(ev.summary || "Motion event detected")}</p>
    </div>
  `
  );

  body.innerHTML =
    activityCards.length || cameraCards.length
      ? [...cameraCards, ...activityCards].join("")
      : `<div class="py-16 text-center font-mono text-xs text-on-surface-variant">All clear · No pending alerts</div>`;
}

export function openAlerts() {
  const drawer = document.getElementById("alertsDrawer");
  if (!drawer) return;
  renderAlertsDrawer();
  drawer.classList.remove("translate-x-full");
  drawer.setAttribute("aria-hidden", "false");
}

function closeAlerts() {
  const drawer = document.getElementById("alertsDrawer");
  if (!drawer) return;
  drawer.classList.add("translate-x-full");
  drawer.setAttribute("aria-hidden", "true");
}

// ---- Main View Render ----
const viewCtx = {
  navigate,
  openQuickFind,
  openAlerts,
  openModal,
};

function renderCurrentRoute() {
  const main = document.getElementById("appMain");
  if (!main) return;
  const route = store.route;
  stopDockScreen();
  document.body.classList.toggle("dock-screen-active", route === "/dock");
  updateNavActive(route);
  renderAlertsDrawer();

  if (route === "/") renderHomeView(main, viewCtx);
  else if (route === "/dock") renderDockScreen(main, { navigate, toggleFullscreen });
  else if (route === "/media") renderMediaView(main, viewCtx);
  else if (route === "/weather") renderWeatherView(main, viewCtx);
  else if (route === "/schedule") renderScheduleView(main, viewCtx);
  else if (route === "/automations" || route === "/climate-automations") renderAutomationsView(main, viewCtx);
  else if (route === "/controls") {
    setControlsSubTab("controls");
    renderControlsView(main, viewCtx);
  } else if (route === "/floorplan") {
    setControlsSubTab("floorplan");
    renderControlsView(main, viewCtx);
  } else if (route === "/security") renderSecurityView(main, viewCtx);
  else if (route === "/configure-widget") renderConfigureWidgetView(main, viewCtx);
  else if (route === "/config") renderConfigView(main, viewCtx);
  else renderHomeView(main, viewCtx);
  updateFullscreenControls();
}

export function navigate(path, push = true) {
  const next = normalizeRoute(path);
  store.route = next;
  if (push && window.location.pathname !== next) {
    window.history.pushState({ route: next }, "", next);
  }
  setMobileNav(false);
  renderCurrentRoute();
}

function updateHeaderClock() {
  const el = document.getElementById("headerClock");
  if (el) el.textContent = formatTime(new Date());
}

async function init() {
  store.route = normalizeRoute(window.location.pathname);

  // Wire sidebar nav clicks
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(el.getAttribute("data-nav"));
    });
  });

  // Mobile drawer toggles
  document.getElementById("mobileOpenNav")?.addEventListener("click", () => setMobileNav(true));
  document.getElementById("mobileCloseNav")?.addEventListener("click", () => setMobileNav(false));
  document.getElementById("mobileBackdrop")?.addEventListener("click", () => setMobileNav(false));

  // Header controls
  document.getElementById("topQuickFindBtn")?.addEventListener("click", openQuickFind);
  document.getElementById("topAlertsBtn")?.addEventListener("click", openAlerts);
  document.getElementById("topProfileBtn")?.addEventListener("click", () => navigate("/config"));
  document.getElementById("topFullscreenBtn")?.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenControls);
  updateFullscreenControls();

  // Quick Find listeners
  const qfDialog = document.getElementById("quickFindDialog");
  const qfInput = document.getElementById("quickFindInput");
  qfInput?.addEventListener("input", () => renderQuickFindResults(qfInput.value));
  qfDialog?.addEventListener("click", (e) => {
    if (e.target === qfDialog) qfDialog.close();
  });

  // Alerts Drawer listeners
  document.getElementById("alertsCloseBtn")?.addEventListener("click", closeAlerts);
  document.getElementById("alertsClearBtn")?.addEventListener("click", () => {
    store.activityLog = store.activityLog.map((a) => ({ ...a, read: true }));
    renderAlertsDrawer();
    showToast("All alerts marked read", "ok");
  });

  // Global keyboard shortcuts (Cmd/Ctrl + K)
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openQuickFind();
    } else if (e.key === "Escape") {
      closeAlerts();
      setMobileNav(false);
    }
  });

  window.addEventListener("popstate", () => {
    navigate(window.location.pathname, false);
  });

  setupActionModal();

  // Re-render current view when store updates (avoid tearing down 3D floorplan canvas unnecessarily)
  subscribe((reason) => {
    updateHeaderClock();
    renderAlertsDrawer();
    if (store.route === "/floorplan" && reason !== "route") return;
    renderCurrentRoute();
  });

  updateHeaderClock();
  setInterval(updateHeaderClock, 15_000);

  // Initial render + data hydration
  renderCurrentRoute();
  await bootstrapData();
  renderCurrentRoute();

  // Gentle live telemetry refresh
  setInterval(() => fetchHome().catch(() => {}), 30_000);
  setInterval(() => fetchMedia().catch(() => {}), 5_000);
  setInterval(() => fetchWeather().catch(() => {}), 300_000);
}

init();
