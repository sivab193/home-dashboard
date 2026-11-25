import {
  addAutomation,
  deleteAutomation,
  escapeHtml,
  runAutomation,
  showToast,
  store,
  toggleAutomation,
} from "../api.js";

let filterQuery = "";
const DAYS = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"],
  ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
];

function displayTime(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .format(new Date(2000, 0, 1, hour, minute));
}

function targetOptions() {
  const deviceOptions = store.home.items
    .filter((item) => !item.read_only && ["light", "switch"].includes(item.type))
    .map((item) => `<option value="device|${escapeHtml(item.id)}">Device · ${escapeHtml(item.name)}</option>`);
  const groupOptions = store.home.groups
    .map((group) => `<option value="group|${escapeHtml(group.id)}">Group · ${escapeHtml(group.name)}</option>`);
  const roomOptions = store.home.rooms
    .map((room) => `<option value="room|${escapeHtml(room)}">Room · ${escapeHtml(room)}</option>`);
  return [...groupOptions, ...roomOptions, ...deviceOptions].join("");
}

export function renderAutomationsView(container, { openQuickFind, openAlerts, openModal }) {
  const { rules, stats } = store.automations;
  const q = filterQuery.trim().toLowerCase();
  const visibleRules = q
    ? rules.filter((rule) => [rule.name, rule.condition, rule.action_label, rule.target_name]
        .some((value) => String(value || "").toLowerCase().includes(q)))
    : rules;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 class="font-headline text-[28px] leading-[34px] font-semibold tracking-tight text-on-surface">Automations</h1>
          <p class="mt-1 text-sm text-on-surface-variant">Run devices, groups, or whole rooms on a schedule.</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="autoNewRuleBtn" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-primary-container text-on-primary-container text-xs font-semibold hover:brightness-110 whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px]">add</span><span>New Automation</span>
          </button>
          <button id="autoQuickFindBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Quick Find"><span class="material-symbols-outlined text-[18px]">search</span></button>
          <button id="autoAlertsBtn" type="button" class="p-2 rounded bg-surface-container-low border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label="Open Alerts"><span class="material-symbols-outlined text-[18px]">notifications</span></button>
        </div>
      </div>

      <section class="dock-surface-card rounded-lg overflow-hidden" aria-labelledby="automationRulesTitle">
        <div class="px-5 py-4 border-b border-outline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="automationRulesTitle" class="font-headline text-[15px] font-semibold text-on-surface">Time-based rules</h2>
            <p class="mt-1 text-xs text-on-surface-variant">${stats.activeCount} active of ${stats.totalRules} total</p>
          </div>
          <label class="relative">
            <span class="sr-only">Filter automations</span>
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
            <input id="autoFilterInput" type="search" value="${escapeHtml(filterQuery)}" placeholder="Filter automations…" class="pl-8 pr-3 py-2 rounded bg-surface-container-lowest border border-outline text-base sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary-container focus:outline-none w-full sm:w-64" />
          </label>
        </div>

        ${visibleRules.length ? `
          <div class="divide-y divide-outline/60">
            ${visibleRules.map((rule) => {
              const active = rule.enabled;
              const dayLabel = rule.days.map((day) => day.toUpperCase()).join(", ");
              return `
                <article class="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div class="min-w-0 lg:flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="font-headline text-sm font-semibold text-on-surface">${escapeHtml(rule.name)}</h3>
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${active ? "bg-tertiary-container/85 text-on-tertiary-container" : "bg-surface-container-highest text-on-surface-variant"}">${active ? "Active" : "Paused"}</span>
                    </div>
                    <p class="mt-1.5 text-sm text-on-surface">${escapeHtml(rule.action_label)}</p>
                    <p class="mt-1 font-mono text-[11px] text-on-surface-variant">${escapeHtml(displayTime(rule.time))} · ${escapeHtml(dayLabel)} · ${escapeHtml(rule.timezone)}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button type="button" data-run-rule="${escapeHtml(rule.id)}" class="px-3 py-2 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">Run now</button>
                    <button type="button" data-toggle-rule="${escapeHtml(rule.id)}" class="px-3 py-2 rounded bg-surface-container-high border border-outline text-xs font-medium text-on-surface hover:bg-surface-bright">${active ? "Pause" : "Enable"}</button>
                    <button type="button" data-delete-rule="${escapeHtml(rule.id)}" class="p-2 rounded text-on-surface-variant hover:text-danger hover:bg-surface-container-high" aria-label="Delete ${escapeHtml(rule.name)}"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                  </div>
                </article>`;
            }).join("")}
          </div>` : `
          <div class="px-5 py-12 text-center">
            <span class="material-symbols-outlined text-[28px] text-on-surface-variant">schedule</span>
            <h3 class="mt-2 font-headline text-sm font-semibold text-on-surface">${filterQuery ? "No matching automations" : "No automations yet"}</h3>
            <p class="mt-1 text-xs text-on-surface-variant">${filterQuery ? "Try a different search." : "Create a time-based rule to control your smart devices automatically."}</p>
          </div>`}
      </section>
    </div>`;

  container.querySelector("#autoQuickFindBtn")?.addEventListener("click", openQuickFind);
  container.querySelector("#autoAlertsBtn")?.addEventListener("click", openAlerts);
  const filterInput = container.querySelector("#autoFilterInput");
  filterInput?.addEventListener("input", () => {
    filterQuery = filterInput.value;
    const pos = filterInput.selectionStart;
    renderAutomationsView(container, { openQuickFind, openAlerts, openModal });
    const next = container.querySelector("#autoFilterInput");
    next?.focus();
    next?.setSelectionRange(pos, pos);
  });

  container.querySelectorAll("[data-toggle-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const data = await toggleAutomation(btn.getAttribute("data-toggle-rule"));
        showToast(`${data.rule.name} ${data.rule.enabled ? "enabled" : "paused"}`, "ok");
      } catch (err) {
        showToast(err.message || "Could not update the automation", "error");
      }
    });
  });
  container.querySelectorAll("[data-run-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await runAutomation(btn.getAttribute("data-run-rule"));
        showToast("Automation ran successfully", "ok");
      } catch (err) {
        showToast(err.message || "Automation could not run", "error");
      }
    });
  });
  container.querySelectorAll("[data-delete-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await deleteAutomation(btn.getAttribute("data-delete-rule"));
        showToast("Automation deleted", "ok");
      } catch (err) {
        showToast(err.message || "Could not delete the automation", "error");
      }
    });
  });

  container.querySelector("#autoNewRuleBtn")?.addEventListener("click", () => {
    const options = targetOptions();
    openModal({
      title: "New Time-Based Automation",
      submitLabel: "Create Automation",
      bodyHtml: `
        <div class="space-y-4">
          <div>
            <label for="ruleNameInput" class="block text-xs font-medium text-on-surface-variant mb-1">Automation name</label>
            <input id="ruleNameInput" name="name" type="text" required maxlength="80" placeholder="e.g. Turn everything off at night" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-base text-on-surface focus:border-primary-container focus:outline-none" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label for="ruleTimeInput" class="block text-xs font-medium text-on-surface-variant mb-1">Time</label><input id="ruleTimeInput" name="time" type="time" required value="22:00" class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-base text-on-surface focus:border-primary-container focus:outline-none" /></div>
            <div><label for="ruleActionInput" class="block text-xs font-medium text-on-surface-variant mb-1">Action</label><select id="ruleActionInput" name="action" required class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-base text-on-surface focus:border-primary-container focus:outline-none"><option value="turn_off">Turn off</option><option value="turn_on">Turn on</option></select></div>
          </div>
          <fieldset>
            <legend class="text-xs font-medium text-on-surface-variant mb-2">Days</legend>
            <div class="grid grid-cols-4 sm:grid-cols-7 gap-2">${DAYS.map(([value, label]) => `<label class="flex flex-col items-center gap-1.5 px-2 py-2 rounded bg-surface-container-lowest border border-outline text-xs text-on-surface cursor-pointer"><input type="checkbox" name="days" value="${value}" checked class="w-4 h-4 accent-primary-container" />${label}</label>`).join("")}</div>
          </fieldset>
          <div>
            <label for="ruleTargetInput" class="block text-xs font-medium text-on-surface-variant mb-1">Target</label>
            <select id="ruleTargetInput" name="target" required class="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline text-base text-on-surface focus:border-primary-container focus:outline-none">${options || `<option value="" disabled selected>No controllable targets available</option>`}</select>
          </div>
        </div>`,
      onSubmit: async (formData) => {
        const [targetType, ...targetParts] = String(formData.get("target") || "").split("|");
        await addAutomation({
          name: formData.get("name"), time: formData.get("time"), days: formData.getAll("days"),
          action: formData.get("action"), target_type: targetType, target_id: targetParts.join("|"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        showToast("Automation created", "ok");
      },
    });
  });
}
