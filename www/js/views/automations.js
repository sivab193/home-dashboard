import {
  addAutomation,
  deleteAutomation,
  escapeHtml,
  showToast,
  sparklineSvg,
  store,
  toggleAutomation,
} from "../api.js";

let filterQuery = "";

export function renderAutomationsView(container, { openQuickFind, openAlerts, openModal }) {
  const cfg = store.config;
  const { rules, stats } = store.automations;
  const weather = store.weather;
  const q = filterQuery.trim().toLowerCase();
  const visibleRules = q
    ? rules.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.condition.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
      )
    : rules;

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant mb-1">
            <span class="text-primary-container">${escapeHtml(cfg.studioName.toUpperCase())}</span>
            <span class="mx-1.5 text-outline-strong">/</span>
            <span>${escapeHtml(cfg.userName.toUpperCase())}</span>
          </p>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Climate Automations</h1>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="autoNewRuleBtn" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110 whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>New Rule</span>
          </button>
          <button id="autoQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find">
            <span class="material-symbols-outlined text-[18px]">search</span>
          </button>
          <button id="autoAlertsBtn" type="button" class="relative p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts">
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-container"></span>
          </button>
        </div>
      </div>

      <!-- 4 Climate Telemetry Tiles -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">ACTIVE AUTOMATIONS</span>
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
          </div>
          <div class="flex items-end justify-between gap-2">
            <div>
              <p id="autoActiveCount" class="font-mono text-2xl font-medium text-on-surface tabular-nums">${stats.activeCount}</p>
              <p class="font-mono text-[11px] mt-0.5"><span class="text-tertiary">+1</span> <span class="text-on-surface-variant">vs yesterday</span></p>
            </div>
            ${sparklineSvg([1, 2, 2, 3, 3, stats.activeCount], "#82d8a6", 74, 24)}
          </div>
          <p class="font-mono text-[11px] text-on-surface-variant">of ${stats.totalRules} rules</p>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">WINDOW VENTS OPEN</span>
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
          </div>
          <div class="flex items-end justify-between gap-2">
            <div>
              <p id="autoVentsCount" class="font-mono text-2xl font-medium text-on-surface tabular-nums">${stats.ventsOpen}</p>
              <p class="font-mono text-[11px] text-on-surface-variant mt-0.5">0 vs yesterday</p>
            </div>
            ${sparklineSvg([2, 2, 2, 2, 2], "#c3c7cc", 74, 24)}
          </div>
          <p class="font-mono text-[11px] text-on-surface-variant">of ${stats.totalVents} vents</p>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">OUTDOOR TEMP</span>
            <span class="material-symbols-outlined text-[16px] text-primary">partly_cloudy_day</span>
          </div>
          <div class="flex items-end justify-between gap-2">
            <div>
              <p class="font-mono text-2xl font-medium text-on-surface tabular-nums">${weather ? `${weather.tempF}°F` : "64°F"}</p>
              <p class="font-mono text-[11px] mt-0.5"><span class="text-primary">-2°F</span> <span class="text-on-surface-variant">vs hour ago</span></p>
            </div>
            ${sparklineSvg([68, 67, 66, 65, weather?.tempF ?? 64], "#ffb3b4", 74, 24)}
          </div>
          <p class="font-mono text-[11px] text-on-surface-variant">${escapeHtml(weather?.condition || "Partly Cloudy")}</p>
        </div>

        <div class="dock-surface-card rounded-lg p-4 flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">STUDIO AIR QUALITY</span>
            <span class="w-2 h-2 rounded-full bg-tertiary"></span>
          </div>
          <div class="flex items-end justify-between gap-2">
            <div>
              <p class="font-mono text-2xl font-medium text-on-surface tabular-nums">${weather?.aqi ?? 18} AQI</p>
              <p class="font-mono text-[11px] mt-0.5"><span class="text-tertiary">-4</span> <span class="text-on-surface-variant">vs morning</span></p>
            </div>
            ${sparklineSvg([24, 22, 21, 19, weather?.aqi ?? 18], "#82d8a6", 74, 24)}
          </div>
          <p class="font-mono text-[11px] text-tertiary">Excellent</p>
        </div>
      </section>

      <!-- Automation Rules Table Card -->
      <section class="dock-surface-card rounded-lg overflow-hidden">
        <div class="px-5 py-4 border-b border-outline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[18px] text-primary-container">tune</span>
            <h2 class="font-headline text-[15px] font-semibold text-on-surface">Automation Rules</h2>
          </div>
          <div class="flex items-center gap-3">
            <div class="relative">
              <span class="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
              <input id="autoFilterInput" type="search" value="${escapeHtml(filterQuery)}" placeholder="Filter rules…" aria-label="Filter automation rules" class="pl-8 pr-3 py-1.5 rounded bg-surface-container-lowest border border-outline text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary-container focus:outline-none w-48" />
            </div>
            <span class="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant whitespace-nowrap">${rules.length} RULES CONFIGURED</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-outline font-mono text-[10.5px] uppercase tracking-wider text-on-surface-variant">
                <th class="py-3 px-5 font-medium">Automation Rule</th>
                <th class="py-3 px-4 font-medium">Status</th>
                <th class="py-3 px-4 font-medium">Trigger Condition</th>
                <th class="py-3 px-4 font-medium">Action</th>
                <th class="py-3 px-5 font-medium text-right">Manage</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline/60 text-[13px]">
              ${
                visibleRules.length
                  ? visibleRules
                      .map((rule) => {
                        const isActive = rule.status === "active";
                        return `
                      <tr class="hover:bg-surface-container-high/45 transition-colors">
                        <td class="py-3.5 px-5 font-medium text-on-surface">${escapeHtml(rule.name)}</td>
                        <td class="py-3.5 px-4">
                          <button type="button" data-toggle-rule="${escapeHtml(rule.id)}" aria-label="Toggle ${escapeHtml(rule.name)} status (currently ${rule.status})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-tertiary-container/85 text-on-tertiary-container hover:brightness-110"
                              : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                          }">
                            <span class="w-1.5 h-1.5 rounded-full ${isActive ? "bg-on-tertiary-container" : "bg-on-surface-variant"}"></span>
                            <span>${isActive ? "Active" : "Paused"}</span>
                          </button>
                        </td>
                        <td class="py-3.5 px-4 font-mono text-xs text-on-surface-warm tabular-nums">${escapeHtml(rule.condition)}</td>
                        <td class="py-3.5 px-4 text-on-surface">${escapeHtml(rule.action)}</td>
                        <td class="py-3.5 px-5 text-right">
                          <button type="button" data-delete-rule="${escapeHtml(rule.id)}" class="p-1.5 rounded text-on-surface-variant hover:text-danger hover:bg-surface-container-high" aria-label="Delete ${escapeHtml(rule.name)}">
                            <span class="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    `;
                      })
                      .join("")
                  : `<tr><td colspan="5" class="py-8 px-5 text-center font-mono text-xs text-on-surface-variant">No automation rules match "${escapeHtml(filterQuery)}".</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  container.querySelector("#autoQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#autoAlertsBtn")?.addEventListener("click", openAlerts);

  const filterInput = container.querySelector("#autoFilterInput");
  filterInput?.addEventListener("input", () => {
    filterQuery = filterInput.value;
    const pos = filterInput.selectionStart;
    renderAutomationsView(container, { openQuickFind, openAlerts, openModal });
    const nextInput = container.querySelector("#autoFilterInput");
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(pos, pos);
    }
  });

  container.querySelectorAll("[data-toggle-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const res = await toggleAutomation(btn.getAttribute("data-toggle-rule"));
        showToast(`${res.rule.name}: ${res.rule.status === "active" ? "Active" : "Paused"}`, "ok");
      } catch (err) {
        showToast(err.message || "Could not toggle rule", "error");
      }
    });
  });

  container.querySelectorAll("[data-delete-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await deleteAutomation(btn.getAttribute("data-delete-rule"));
        showToast("Automation rule removed", "ok");
      } catch (err) {
        showToast(err.message || "Could not remove rule", "error");
      }
    });
  });

  container.querySelector("#autoNewRuleBtn")?.addEventListener("click", () => {
    openModal({
      title: "Add Climate Automation Rule",
      submitLabel: "Create Rule",
      bodyHtml: `
        <div class="space-y-3">
          <div>
            <label for="ruleNameInput" class="block text-xs font-medium text-on-surface-variant mb-1">Rule name</label>
            <input id="ruleNameInput" name="name" type="text" required placeholder="e.g. Night Acoustic Cooling" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div>
            <label for="ruleCondInput" class="block text-xs font-medium text-on-surface-variant mb-1">Trigger condition</label>
            <input id="ruleCondInput" name="condition" type="text" required placeholder="e.g. Interior > 74°F" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div>
            <label for="ruleActionInput" class="block text-xs font-medium text-on-surface-variant mb-1">Action</label>
            <input id="ruleActionInput" name="action" type="text" required placeholder="e.g. Open Studio Vents" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-sm text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
        </div>
      `,
      onSubmit: async (formData) => {
        await addAutomation({
          name: formData.get("name"),
          condition: formData.get("condition"),
          action: formData.get("action"),
        });
        showToast("Climate automation rule added", "ok");
      },
    });
  });
}
