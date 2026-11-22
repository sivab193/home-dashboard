import test from "node:test";
import assert from "node:assert/strict";
import {
  AutomationsStore,
  DockConfigStore,
  MediaDeckStore,
  ScheduleStore,
} from "./dockspace-store.ts";

test("AutomationsStore seeds 4 rules, toggles status, adds and removes rules", () => {
  const store = new AutomationsStore();
  const initial = store.summary();
  assert.equal(initial.rules.length, 4);
  assert.equal(initial.stats.activeCount, 3);
  assert.equal(initial.stats.ventsOpen, 2);

  const toggled = store.toggleRule("rule-cross-breeze");
  assert.equal(toggled.status, "active");
  assert.equal(store.summary().stats.activeCount, 4);
  assert.equal(store.summary().stats.ventsOpen, 3);

  const created = store.addRule({
    name: "Night Acoustic Cooling",
    condition: "Interior > 70°F",
    action: "Run Quiet Fan",
  });
  assert.equal(created.status, "active");
  assert.equal(store.summary().rules.length, 5);

  store.removeRule(created.id);
  assert.equal(store.summary().rules.length, 4);
});

test("AutomationsStore validates required fields", () => {
  const store = new AutomationsStore();
  assert.throws(() => store.addRule({ name: "", condition: "AQI > 40", action: "Open Vent" }), /rule name/i);
  assert.throws(() => store.toggleRule("missing-rule"), /not found/i);
});

test("MediaDeckStore switches tracks, adjusts volume, and changes output zones", () => {
  const media = new MediaDeckStore();
  assert.equal(media.state().playing, true);
  assert.equal(media.state().outputLabel, "AirPods Pro");

  media.control({ action: "toggle" });
  assert.equal(media.state().playing, false);

  media.control({ action: "select_track", trackId: "trk-02" });
  assert.equal(media.state().track.title, "Midnight Compiler");
  assert.equal(media.state().playing, true);

  media.control({ action: "output", outputZone: "monitors" });
  assert.equal(media.state().outputLabel, "Studio Monitors");

  media.control({ action: "volume", volume: 120 });
  assert.equal(media.state().volume, 100);
});

test("ScheduleStore adds and removes events with validation", () => {
  const schedule = new ScheduleStore();
  const baseCount = schedule.list().length;
  const created = schedule.addEvent({
    title: "Acoustic Calibration",
    dayOffset: 4,
    startHour: 14,
    durationHours: 1.5,
    category: "studio",
  });
  assert.equal(schedule.list().length, baseCount + 1);
  assert.equal(created.title, "Acoustic Calibration");

  schedule.removeEvent(created.id);
  assert.equal(schedule.list().length, baseCount);

  assert.throws(() => schedule.addEvent({ title: "   " }), /title/i);
});

test("DockConfigStore updates preferences, clamps opacity, persists 5 worldClocks & quick devices, and resets defaults", () => {
  const cfg = new DockConfigStore();
  assert.equal(cfg.get().dockOpacity, 85);
  assert.equal(cfg.get().worldClocks.length, 5);
  assert.deepEqual(cfg.get().homeQuickDeviceIds, []);

  const updated = cfg.update({
    dockOpacity: 5,
    clockFormat: "24-hour",
    widgetDisplayName: "Studio Rack Pro",
    showWeatherOverlay: false,
    homeQuickDeviceIds: ["living_room_lamp", "living_room_strip_1"],
    worldClocks: [
      { label: "San Francisco", timeZone: "America/Los_Angeles" },
      { label: "New York", timeZone: "America/New_York" },
      { label: "London", timeZone: "Europe/London" },
      { label: "Singapore", timeZone: "Asia/Singapore" },
      { label: "Sydney", timeZone: "Australia/Sydney" },
    ],
  });
  assert.equal(updated.dockOpacity, 20);
  assert.equal(updated.clockFormat, "24-hour");
  assert.equal(updated.widgetDisplayName, "Studio Rack Pro");
  assert.equal(updated.showWeatherOverlay, false);
  assert.deepEqual(updated.homeQuickDeviceIds, ["living_room_lamp", "living_room_strip_1"]);
  assert.equal(updated.worldClocks[3].label, "Singapore");

  const reset = cfg.reset();
  assert.equal(reset.dockOpacity, 85);
  assert.equal(reset.clockFormat, "12-hour");
  assert.equal(reset.worldClocks.length, 5);
  assert.deepEqual(reset.homeQuickDeviceIds, []);
});
