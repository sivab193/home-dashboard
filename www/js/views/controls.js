import {
  apiFetch,
  commandHomeEntity,
  escapeHtml,
  fetchHome,
  logActivity,
  setRoomPower,
  showToast,
  store,
} from "../api.js";

let activeSubTab = "controls"; // controls | floorplan
let selectedRoom = "All";

const API_ORIGIN = (window.HOME_DASHBOARD_API_ORIGIN || window.location.origin).replace(/\/$/, "");

export function setControlsSubTab(tab) {
  activeSubTab = tab === "floorplan" ? "floorplan" : "controls";
}

function renderDeviceCard(item) {
  const isSensor = item.type === "sensor" || item.read_only;
  const isOn = item.state === "on";
  const isLight = item.type === "light";
  const brightness = Math.round(Number(item.attributes?.brightness_pct ?? (isOn ? 75 : 0)));
  const kelvin = Math.round(Number(item.attributes?.color_temp_kelvin ?? 3200));
  const icon = isLight ? "lightbulb" : isSensor ? "sensors" : "power";
  const unit = item.attributes?.unit_of_measurement ? ` ${item.attributes.unit_of_measurement}` : "";

  return `
    <article class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3.5 transition-colors ${
      isOn ? "border-primary-container/40" : ""
    }">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${
            isOn
              ? "bg-primary-soft/80 border-primary-container/40 text-primary-container"
              : isSensor
              ? "bg-tertiary-container/15 border-tertiary/30 text-tertiary"
              : "bg-surface-container-high border-outline text-on-surface-variant"
          }">
            <span class="material-symbols-outlined text-[19px]">${icon}</span>
          </div>
          <div class="min-w-0">
            <h3 class="font-headline text-sm font-semibold text-on-surface truncate">${escapeHtml(item.name)}</h3>
            <p class="font-mono text-[11px] text-on-surface-variant truncate">${escapeHtml(item.room)} · ${escapeHtml(item.provider || "local")}</p>
          </div>
        </div>
        ${
          isSensor
            ? `<span class="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-mono text-xs tabular-nums shrink-0">${escapeHtml(item.state)}${escapeHtml(unit)}</span>`
            : `<button type="button" role="switch" aria-checked="${isOn}" aria-label="Toggle ${escapeHtml(item.name)}" data-device-toggle="${escapeHtml(item.id)}" data-device-state="${escapeHtml(item.state)}" class="dock-switch">
                <span class="dock-switch-thumb"></span>
              </button>`
        }
      </div>

      ${
        isLight
          ? `
        <div class="space-y-2.5 pt-1">
          <div class="space-y-1">
            <div class="flex items-center justify-between font-mono text-[10.5px] text-on-surface-variant">
              <span>BRIGHTNESS</span>
              <span class="tabular-nums text-on-surface">${brightness}%</span>
            </div>
            <input type="range" min="1" max="100" value="${Math.max(1, brightness)}" data-device-brightness="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} brightness" class="dock-slider w-full" style="background: linear-gradient(to right, #ff6370 ${brightness}%, #282a2c ${brightness}%);" />
          </div>
          <div class="space-y-1">
            <div class="flex items-center justify-between font-mono text-[10.5px] text-on-surface-variant">
              <span>COLOR TEMP</span>
              <span class="tabular-nums text-on-surface">${kelvin}K</span>
            </div>
            <input type="range" min="2200" max="6500" step="100" value="${kelvin}" data-device-kelvin="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} color temperature" class="dock-slider w-full" />
          </div>
        </div>
      `
          : isSensor
          ? `
        <div class="rounded bg-surface-container-lowest/80 border border-outline/70 px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span class="text-on-surface-variant">LIVE READING</span>
          <span class="text-tertiary tabular-nums">${escapeHtml(item.state)}${escapeHtml(unit)}</span>
        </div>
      `
          : `
        <div class="rounded bg-surface-container-lowest/80 border border-outline/70 px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span class="text-on-surface-variant">STATE</span>
          <span class="${isOn ? "text-tertiary" : "text-on-surface-variant"}">${isOn ? "ACTIVE" : "STANDBY"}${
              typeof item.attributes?.power === "number" ? ` · ${item.attributes.power.toFixed(1)}W` : ""
            }</span>
        </div>
      `
      }

      <div class="flex items-center justify-between pt-1 border-t border-outline/50 text-[11px]">
        <span class="font-mono text-on-surface-variant uppercase">${escapeHtml(item.type)}</span>
        <button type="button" data-delete-device="${escapeHtml(item.id)}" class="text-on-surface-variant hover:text-danger transition-colors font-medium">Remove</button>
      </div>
    </article>
  `;
}

export function renderControlsView(container, { openQuickFind, openAlerts, openModal, navigate }) {
  const cfg = store.config;
  const rooms = store.home?.rooms || [];
  const items = store.home?.items || [];
  const activeCount = items.filter((i) => i.state === "on").length;
  const visibleItems = selectedRoom === "All" ? items : items.filter((i) => i.room === selectedRoom);

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">SMART HOME</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${rooms.length} ROOMS · ${activeCount} OF ${items.length} ACTIVE</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">
            ${activeSubTab === "floorplan" ? "3D Floor Plan" : "Smart Home Controls"}
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <!-- Mode Switcher: Controls | 3D Floorplan -->
          <div class="inline-flex items-center rounded bg-surface-container-low border border-outline p-0.5" role="tablist" aria-label="Smart Home view mode">
            <button type="button" role="tab" aria-selected="${activeSubTab === "controls"}" data-home-subtab="controls" class="px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeSubTab === "controls"
                ? "bg-primary-container text-on-primary-container font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }">Controls</button>
            <button type="button" role="tab" aria-selected="${activeSubTab === "floorplan"}" data-home-subtab="floorplan" class="px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeSubTab === "floorplan"
                ? "bg-primary-container text-on-primary-container font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }">3D Floorplan</button>
          </div>
          <button id="controlsQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="controlsAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      ${
        activeSubTab === "floorplan"
          ? `
        <section class="dock-surface-card rounded-lg p-4 sm:p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[20px] text-primary-container">view_in_ar</span>
              <div>
                <h2 class="font-headline text-[15px] font-semibold text-on-surface">Interactive 3D Studio Floor Plan</h2>
                <p class="text-xs text-on-surface-variant">Click lights and switches directly inside the 3D scene to control rooms in real time.</p>
              </div>
            </div>
            <button id="dioramaEdit" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110">
              <span class="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Layout</span>
            </button>
          </div>
          <div id="dioramaMountHost" class="rounded-lg border border-outline bg-surface-container-lowest min-h-[440px] flex items-center justify-center font-mono text-xs text-on-surface-variant">
            Loading 3D floor plan…
          </div>
        </section>
      `
          : `
        <!-- Room Tabs + Quick Actions -->
        <section class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by room">
            ${["All", ...rooms]
              .map((room) => {
                const active = selectedRoom === room;
                const count = room === "All" ? items.length : items.filter((i) => i.room === room).length;
                return `
                <button type="button" role="tab" aria-selected="${active}" data-room-filter="${escapeHtml(room)}" class="px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary-soft border-primary-container/50 text-primary"
                    : "bg-surface-container-low border-outline text-on-surface-variant hover:text-on-surface"
                }">
                  ${escapeHtml(room)} <span class="ml-1 font-mono text-[10px] opacity-75">${count}</span>
                </button>
              `;
              })
              .join("")}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            ${
              selectedRoom !== "All"
                ? `
              <button id="roomAllOnBtn" type="button" class="px-3 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-tertiary hover:bg-surface-bright">Room On</button>
              <button id="roomAllOffBtn" type="button" class="px-3 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-bright">Room Off</button>
            `
                : ""
            }
            <button id="addRoomBtn" type="button" class="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">
              <span class="material-symbols-outlined text-[15px]">add</span>
              <span>Room</span>
            </button>
            <button id="addDeviceBtn" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110">
              <span class="material-symbols-outlined text-[15px]">add</span>
              <span>Device</span>
            </button>
          </div>
        </section>

        <!-- Device Grid -->
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          ${
            visibleItems.length
              ? visibleItems.map(renderDeviceCard).join("")
              : `<div class="col-span-full dock-surface-card rounded-lg p-10 text-center space-y-2">
                  <p class="font-headline text-sm font-semibold text-on-surface">No devices in ${escapeHtml(selectedRoom)}</p>
                  <p class="text-xs text-on-surface-variant">Add a smart light, switch, or sensor to start controlling this room.</p>
                </div>`
          }
        </section>
      `
      }
    </div>
  `;

  container.querySelector("#controlsQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#controlsAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelectorAll("[data-home-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-home-subtab");
      activeSubTab = next === "floorplan" ? "floorplan" : "controls";
      navigate(activeSubTab === "floorplan" ? "/floorplan" : "/controls");
    });
  });

  if (activeSubTab === "floorplan") {
    const mountHost = container.querySelector("#dioramaMountHost");
    if (mountHost) {
      import("/diorama-adapter.js")
        .then(({ mountDiorama }) => mountDiorama(mountHost, store.home?.items || [], API_ORIGIN))
        .catch((err) => {
          mountHost.textContent = err.message || "3D floor plan could not load";
        });
    }
    return;
  }

  container.querySelectorAll("[data-room-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedRoom = btn.getAttribute("data-room-filter") || "All";
      renderControlsView(container, { openQuickFind, openAlerts, openModal, navigate });
    });
  });

  container.querySelector("#roomAllOnBtn")?.addEventListener("click", async () => {
    await setRoomPower(selectedRoom, "turn_on");
    showToast(`${selectedRoom} turned on`, "ok");
  });

  container.querySelector("#roomAllOffBtn")?.addEventListener("click", async () => {
    await setRoomPower(selectedRoom, "turn_off");
    showToast(`${selectedRoom} turned off`, "ok");
  });

  container.querySelectorAll("[data-device-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-device-toggle");
      const currentState = btn.getAttribute("data-device-state");
      const action = currentState === "on" ? "turn_off" : "turn_on";
      try {
        await commandHomeEntity(id, action);
        logActivity(`Device ${action === "turn_on" ? "activated" : "turned off"}`, `${id} updated in ${cfg.studioName}`, "ok");
      } catch (err) {
        showToast(err.message || "Device command failed", "error");
      }
    });
  });

  container.querySelectorAll("[data-device-brightness]").forEach((slider) => {
    slider.addEventListener("change", async () => {
      const id = slider.getAttribute("data-device-brightness");
      const pct = Number(slider.value);
      await commandHomeEntity(id, "set", {
        brightness: Math.max(1, Math.min(255, Math.round((pct / 100) * 255))),
      }).catch((err) => showToast(err.message, "error"));
    });
  });

  container.querySelectorAll("[data-device-kelvin]").forEach((slider) => {
    slider.addEventListener("change", async () => {
      const id = slider.getAttribute("data-device-kelvin");
      await commandHomeEntity(id, "set", { color_temp_kelvin: Number(slider.value) }).catch((err) =>
        showToast(err.message, "error")
      );
    });
  });

  container.querySelectorAll("[data-delete-device]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-device");
      try {
        await apiFetch(`/api/home/entities/${encodeURIComponent(id)}`, { method: "DELETE" });
        await fetchHome();
        showToast("Device removed", "ok");
      } catch (err) {
        showToast(err.message || "Could not remove device", "error");
      }
    });
  });

  container.querySelector("#addRoomBtn")?.addEventListener("click", () => {
    openModal({
      title: "Add Smart Home Room",
      submitLabel: "Add Room",
      bodyHtml: `
        <div>
          <label for="newRoomName" class="block text-xs font-medium text-on-surface-variant mb-1">Room name</label>
          <input id="newRoomName" name="name" type="text" required placeholder="e.g. Studio Office" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
        </div>
      `,
      onSubmit: async (formData) => {
        await apiFetch("/api/home/rooms", {
          method: "POST",
          body: JSON.stringify({ name: formData.get("name") }),
        });
        await fetchHome();
        showToast("Room added", "ok");
      },
    });
  });

  container.querySelector("#addDeviceBtn")?.addEventListener("click", () => {
    const roomOptions = rooms.length ? rooms : ["Living room", "Bedroom", "Kitchen"];
    openModal({
      title: "Add Smart Device",
      submitLabel: "Add Device",
      bodyHtml: `
        <div class="space-y-3">
          <div>
            <label for="newDevName" class="block text-xs font-medium text-on-surface-variant mb-1">Device name</label>
            <input id="newDevName" name="name" type="text" required placeholder="e.g. Desk Key Light" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="newDevType" class="block text-xs font-medium text-on-surface-variant mb-1">Type</label>
              <select id="newDevType" name="type" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none">
                <option value="light">Light</option>
                <option value="switch">Smart Plug / Switch</option>
                <option value="fan">Fan</option>
              </select>
            </div>
            <div>
              <label for="newDevRoom" class="block text-xs font-medium text-on-surface-variant mb-1">Room</label>
              <select id="newDevRoom" name="room" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none">
                ${roomOptions
                  .map((r) => `<option value="${escapeHtml(r)}" ${r === selectedRoom ? "selected" : ""}>${escapeHtml(r)}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        await apiFetch("/api/home/entities", {
          method: "POST",
          body: JSON.stringify({
            name: formData.get("name"),
            type: formData.get("type"),
            room: formData.get("room"),
            entity_id: `${formData.get("type")}.${String(formData.get("name") || "device")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")}`,
          }),
        });
        await fetchHome();
        showToast("Device added to room", "ok");
      },
    });
  });
}
