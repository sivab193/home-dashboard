import test from "node:test";
import assert from "node:assert/strict";
import {
  ConflictError,
  DioramaStore,
  HomeStore,
  MusicReactiveStore,
  NotFoundError,
  ValidationError,
} from "./home-store.ts";

test("HomeStore seeds demo rooms and controllable entities", async () => {
  const store = new HomeStore({ haUrl: "", haToken: "" });
  const config = store.publicConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.configured, true);
  assert.deepEqual(config.rooms, ["Bedroom", "Kitchen", "Living room"]);

  const states = await store.states();
  assert.equal(states.length, 6);
  const lamp = states.find((s) => s.id === "living_room_lamp");
  assert.equal(lamp?.state, "on");
});

test("HomeStore toggles lights, updates brightness, and switches entire rooms", async () => {
  const store = new HomeStore({ haUrl: "", haToken: "" });
  await store.command("living_room_lamp", "turn_off");
  let states = await store.states();
  assert.equal(states.find((s) => s.id === "living_room_lamp")?.state, "off");

  await store.command("living_room_lamp", "set", {
    brightness_pct: 50,
    color_temp_kelvin: 4000,
    rgb_color: [10, 20, 30],
  });
  states = await store.states();
  const lamp = states.find((s) => s.id === "living_room_lamp");
  assert.equal(lamp?.state, "on");
  assert.equal(lamp?.attributes.brightness, 128);
  assert.equal(lamp?.attributes.color_temp_kelvin, 4000);
  assert.deepEqual(lamp?.attributes.rgb_color, [10, 20, 30]);

  const roomOff = await store.setRoomPower("Living room", "turn_off");
  assert.equal(roomOff.ok, true);
  states = await store.states();
  for (const entity of states.filter((s) => s.room === "Living room" && !s.read_only)) {
    assert.equal(entity.state, "off");
  }
});

test("HomeStore manages rooms and entities with validation", () => {
  const store = new HomeStore({ haUrl: "", haToken: "" });
  const roomsAfterAdd = store.addRoom("Office");
  assert.ok(roomsAfterAdd.includes("Office"));

  const added = store.addEntity({
    entity_id: "light.desk_lamp",
    name: "Desk Lamp",
    room: "Office",
  });
  assert.equal(added.room, "Office");
  assert.equal(added.type, "light");

  assert.throws(
    () => store.addEntity({ entity_id: "invalid.entity" }),
    ValidationError
  );

  store.renameRoom("Office", "Study");
  assert.ok(store.rooms().includes("Study"));
  assert.ok(!store.rooms().includes("Office"));

  store.removeEntity(added.id);
  assert.throws(() => store.removeEntity(added.id), NotFoundError);
});

test("DioramaStore validates rooms and decoration references", () => {
  const store = new DioramaStore();
  const initial = store.load();
  assert.ok(initial.rooms.length >= 1);

  const saved = store.save({
    type: "custom:diorama-card",
    rooms: [{ id: "studio", points: [[0, 0], [3, 0], [3, 3]] }],
    decorations: [{ id: "sofa_1", kind: "sofa", room: "studio" }],
    devices: [],
  });
  assert.equal(saved.rooms[0].id, "studio");

  assert.throws(
    () =>
      store.save({
        rooms: [],
        devices: [],
        decorations: [{ id: "lamp", kind: "light_floor", room: "missing" }],
      }),
    /unknown room/
  );
});

test("MusicReactiveStore enforces single-owner lease and takeover", async () => {
  const home = new HomeStore({ haUrl: "", haToken: "" });
  const music = new MusicReactiveStore(home, "living_room_lamp", 12);

  const claimed = music.claim("client-1111", "Laptop", false, 1000);
  assert.equal(claimed.active, true);
  assert.equal(claimed.owner?.name, "Laptop");

  assert.throws(
    () => music.claim("client-2222", "Phone", false, 2000),
    ConflictError
  );

  const taken = music.claim("client-2222", "Phone", true, 2000);
  assert.equal(taken.owner?.id, "client-2222");

  const updated = await music.update("client-2222", 0.8, true, 180, 3000);
  assert.equal(updated.active, true);

  const stopped = music.stop("client-2222", false, 3500);
  assert.equal(stopped.active, false);
});
