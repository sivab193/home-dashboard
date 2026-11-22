import {
  addScheduleEvent,
  deleteScheduleEvent,
  escapeHtml,
  showToast,
  store,
} from "../api.js";

let activeFilter = "week"; // today | week | shift | custom

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00 to 20:00

function getWeekDates() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      dayName: DAYS[i],
      dateNum: d.getDate(),
      isToday: d.toDateString() === now.toDateString(),
      dayOffset: i,
    };
  });
}

function formatHourRange(startHour, durationHours) {
  const fmt = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    if (store.config.clockFormat === "24-hour") {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    const suffix = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(startHour)} – ${fmt(startHour + durationHours)}`;
}

function eventStyle(category) {
  if (category === "shift") {
    return "bg-primary-soft/65 border-l-2 border-l-primary-container border-y border-r border-primary-container/25 text-primary";
  }
  if (category === "climate") {
    return "bg-tertiary-container/15 border-l-2 border-l-tertiary border-y border-r border-tertiary/25 text-tertiary";
  }
  if (category === "system") {
    return "bg-surface-container-high border-l-2 border-l-secondary border-y border-r border-outline text-on-surface";
  }
  return "bg-surface-container-high/90 border border-outline text-on-surface";
}

export function renderScheduleView(container, { openQuickFind, openAlerts, openModal }) {
  const cfg = store.config;
  const week = getWeekDates();
  const now = new Date();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayChip = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const fullDateLabel = now
    .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  const todayIdx = now.getDay();
  const allEvents = store.schedule || [];
  const filteredEvents = allEvents.filter((ev) => {
    if (activeFilter === "today") return ev.dayOffset === todayIdx || ev.dayOffset === 0;
    if (activeFilter === "shift") return ev.category === "shift" || (ev.startHour >= 9 && ev.startHour <= 17);
    return true;
  });

  const nowHourFloat = now.getHours() + now.getMinutes() / 60;
  const clampedNow = Math.max(8, Math.min(20, nowHourFloat));
  const nowLineTop = (clampedNow - 8) * 48;

  const upcomingList = allEvents.filter((e) => e.category !== "shift").slice(0, 6);

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div class="flex flex-wrap items-baseline gap-3">
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Schedule</h1>
          <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
            ${escapeHtml(cfg.userName)} · ${escapeHtml(cfg.studioName)} · ${fullDateLabel}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="schedQuickFindBtn" type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
            <span>Quick Find</span>
          </button>
          <button id="schedAlertsBtn" type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">notifications</span>
            <span>Alerts</span>
            <span class="w-2 h-2 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- Weekly Timeline Card -->
      <section class="dock-surface-card rounded-lg p-4 sm:p-5 space-y-4">
        <!-- Toolbar -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-headline text-base font-semibold text-on-surface">${monthLabel}</h2>
            <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline font-mono text-[11px] text-on-surface-variant">${todayChip}</span>
            <div class="inline-flex items-center gap-1 ml-1" role="tablist" aria-label="Schedule filters">
              ${[
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "shift", label: "Work Shift" },
                { id: "custom", label: "All Blocks" },
              ]
                .map((f) => {
                  const on = activeFilter === f.id;
                  return `
                  <button type="button" role="tab" aria-selected="${on}" data-sched-filter="${f.id}" class="px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    on
                      ? "bg-primary-soft border-primary-container/50 text-primary"
                      : "bg-surface-container-high border-outline text-on-surface-variant hover:text-on-surface"
                  }">${f.label}</button>
                `;
                })
                .join("")}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button id="schedTodayBtn" type="button" class="px-3 py-1.5 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">Today</button>
            <button id="schedNewEventBtn" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110">
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>New Event</span>
            </button>
          </div>
        </div>

        <!-- Scrollable 7-Day Grid -->
        <div class="overflow-x-auto pb-1">
          <div class="min-w-[780px]">
            <!-- Day Column Headers -->
            <div class="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] gap-1.5 mb-2">
              <div class="font-mono text-[10px] text-on-surface-variant flex items-end pb-1">LOCAL</div>
              ${week
                .map(
                  (d) => `
                <div class="rounded-md py-2 text-center border ${
                  d.isToday
                    ? "bg-primary-soft/60 border-primary-container/40"
                    : "bg-surface-container-high/60 border-outline/60"
                }">
                  <p class="font-mono text-[10px] tracking-wider ${d.isToday ? "text-primary" : "text-on-surface-variant"}">${d.dayName}</p>
                  <p class="font-headline text-base font-semibold text-on-surface tabular-nums mt-0.5">${d.dateNum}</p>
                </div>
              `
                )
                .join("")}
            </div>

            <!-- Timeline Body -->
            <div class="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] gap-1.5 relative">
              <!-- Time Axis -->
              <div class="relative">
                ${HOURS.map(
                  (h) => `
                  <div class="h-12 font-mono text-[10px] text-on-surface-variant tabular-nums pr-2 text-right leading-none pt-1">
                    ${String(h).padStart(2, "0")}:00
                  </div>
                `
                ).join("")}
              </div>

              <!-- 7 Day Columns -->
              ${week
                .map((d) => {
                  const colEvents = filteredEvents.filter((ev) => ev.dayOffset === d.dayOffset);
                  return `
                  <div class="relative rounded-md bg-surface-container-lowest/75 border border-outline/50 overflow-hidden" style="height:${HOURS.length * 48}px;">
                    ${HOURS.map(() => `<div class="schedule-hour-row"></div>`).join("")}
                    ${
                      d.isToday
                        ? `<div class="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style="top:${nowLineTop}px">
                            <span class="w-2 h-2 rounded-full bg-primary-container -ml-1"></span>
                            <div class="flex-1 h-[1.5px] bg-primary-container/80"></div>
                          </div>`
                        : ""
                    }
                    ${colEvents
                      .map((ev) => {
                        const topPx = Math.max(2, (ev.startHour - 8) * 48);
                        const heightPx = Math.max(30, ev.durationHours * 48 - 4);
                        const isShift = ev.category === "shift";
                        return `
                        <button type="button" data-event-id="${escapeHtml(ev.id)}" class="absolute text-left rounded px-2 py-1.5 overflow-hidden transition-all hover:brightness-110 ${eventStyle(
                          ev.category
                        )} ${isShift ? "left-1 w-[46%] z-10" : "left-1 right-1 z-10"}" style="top:${topPx}px;height:${heightPx}px;${
                          !isShift && ev.dayOffset === 0 && ev.startHour >= 9 && ev.startHour < 17 ? "left:50%;right:4px;" : ""
                        }">
                          <p class="text-[11px] font-semibold leading-tight truncate">${escapeHtml(ev.title)}</p>
                          <p class="font-mono text-[9.5px] opacity-80 truncate mt-0.5 tabular-nums">${formatHourRange(ev.startHour, ev.durationHours)}</p>
                        </button>
                      `;
                      })
                      .join("")}
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>
        </div>
      </section>

      <!-- Upcoming Events List -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="font-headline text-[15px] font-semibold text-on-surface">Upcoming Events</h2>
            <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline font-mono text-[11px] text-on-surface-variant tabular-nums">${upcomingList.length}</span>
          </div>
          <span class="font-mono text-[11px] text-on-surface-variant">${
            store.calendar?.configured ? "ICS Feed Connected" : "Local Studio Schedule"
          }</span>
        </div>

        <div class="space-y-2">
          ${upcomingList
            .map((ev) => {
              const icon =
                ev.category === "system"
                  ? "system_update_alt"
                  : ev.category === "climate"
                  ? "thermostat"
                  : "cloud_sync";
              const iconTone =
                ev.category === "system"
                  ? "bg-primary-soft/60 text-primary border-primary-container/30"
                  : ev.category === "climate"
                  ? "bg-tertiary-container/20 text-tertiary border-tertiary/30"
                  : "bg-surface-container-high text-secondary border-outline";
              return `
              <div class="dock-surface-card rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${iconTone}">
                    <span class="material-symbols-outlined text-[18px]">${icon}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-semibold text-on-surface truncate">${escapeHtml(ev.title)}</p>
                    <p class="font-mono text-[11px] text-on-surface-variant truncate mt-0.5">${escapeHtml(ev.subtitle)} · ${DAYS[ev.dayOffset]} · ${formatHourRange(ev.startHour, ev.durationHours)}</p>
                  </div>
                </div>
                <button type="button" data-delete-event="${escapeHtml(ev.id)}" class="p-1.5 rounded text-on-surface-variant hover:text-danger hover:bg-surface-container-high shrink-0" aria-label="Remove ${escapeHtml(ev.title)}">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            `;
            })
            .join("")}
        </div>
      </section>
    </div>
  `;

  container.querySelector("#schedQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#schedAlertsBtn")?.addEventListener("click", openAlerts);

  container.querySelectorAll("[data-sched-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-sched-filter") || "week";
      renderScheduleView(container, { openQuickFind, openAlerts, openModal });
    });
  });

  container.querySelector("#schedTodayBtn")?.addEventListener("click", () => {
    activeFilter = "today";
    renderScheduleView(container, { openQuickFind, openAlerts, openModal });
  });

  container.querySelectorAll("[data-event-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = allEvents.find((e) => e.id === btn.getAttribute("data-event-id"));
      if (ev) showToast(`${ev.title} · ${formatHourRange(ev.startHour, ev.durationHours)}`, "info");
    });
  });

  container.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await deleteScheduleEvent(btn.getAttribute("data-delete-event"));
        showToast("Event removed from schedule", "ok");
      } catch (err) {
        showToast(err.message || "Could not remove event", "error");
      }
    });
  });

  container.querySelector("#schedNewEventBtn")?.addEventListener("click", () => {
    openModal({
      title: "Schedule Studio Event",
      submitLabel: "Add Event",
      bodyHtml: `
        <div class="space-y-3">
          <div>
            <label for="schedTitleInput" class="block text-xs font-medium text-on-surface-variant mb-1">Event title</label>
            <input id="schedTitleInput" name="title" type="text" required placeholder="e.g. Hardware Sync Check" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="schedDaySelect" class="block text-xs font-medium text-on-surface-variant mb-1">Day</label>
              <select id="schedDaySelect" name="dayOffset" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none">
                ${DAYS.map((d, i) => `<option value="${i}" ${i === todayIdx ? "selected" : ""}>${d}</option>`).join("")}
              </select>
            </div>
            <div>
              <label for="schedCatSelect" class="block text-xs font-medium text-on-surface-variant mb-1">Category</label>
              <select id="schedCatSelect" name="category" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none">
                <option value="studio">Studio</option>
                <option value="system">System</option>
                <option value="climate">Climate</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="schedStartInput" class="block text-xs font-medium text-on-surface-variant mb-1">Start hour (8–19)</label>
              <input id="schedStartInput" name="startHour" type="number" min="8" max="19" step="0.5" value="14" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none" />
            </div>
            <div>
              <label for="schedDurInput" class="block text-xs font-medium text-on-surface-variant mb-1">Duration (hours)</label>
              <input id="schedDurInput" name="durationHours" type="number" min="0.5" max="6" step="0.5" value="1" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none" />
            </div>
          </div>
          <div>
            <label for="schedSubInput" class="block text-xs font-medium text-on-surface-variant mb-1">Notes</label>
            <input id="schedSubInput" name="subtitle" type="text" placeholder="Optional details" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        await addScheduleEvent({
          title: formData.get("title"),
          dayOffset: Number(formData.get("dayOffset")),
          category: formData.get("category"),
          startHour: Number(formData.get("startHour")),
          durationHours: Number(formData.get("durationHours")),
          subtitle: formData.get("subtitle"),
        });
        showToast("Event added to schedule", "ok");
      },
    });
  });
}
