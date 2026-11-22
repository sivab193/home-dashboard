export interface EntityConfig {
  id: string;
  entity_id: string;
  name: string;
  room: string;
  icon: string;
  type: "light" | "switch" | "sensor";
  read_only: boolean;
  provider: string;
  device_id?: string;
  device_name?: string;
}

export interface EntityStateRecord extends EntityConfig {
  state: string;
  attributes: Record<string, unknown>;
}

export interface RoomPowerResult {
  ok: boolean;
  action: "turn_on" | "turn_off";
  entities: string[];
  errors: Array<{ id: string; error: string }>;
}

export interface DioramaRoom {
  id: string;
  points: number[][];
  [key: string]: unknown;
}

export interface DioramaDecoration {
  id: string;
  kind: string;
  room: string;
  [key: string]: unknown;
}

export interface DioramaPayload {
  type?: string;
  rooms: DioramaRoom[];
  decorations: DioramaDecoration[];
  devices: Record<string, unknown>[];
  [key: string]: unknown;
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}

interface LocalStateEntry {
  state: string;
  attributes: Record<string, unknown>;
}

const VALID_ENTITY_ID = /^(?:light|switch|sensor)\.[a-z0-9_]+$/;

function createDefaultDemoEntities(): {
  entities: EntityConfig[];
  states: Map<string, LocalStateEntry>;
} {
  const entities: EntityConfig[] = [
    {
      id: "living_room_lamp",
      entity_id: "light.living_room_lamp",
      name: "Floor Lamp",
      room: "Living room",
      icon: "💡",
      type: "light",
      read_only: false,
      provider: "local_demo",
    },
    {
      id: "living_room_strip_1",
      entity_id: "switch.living_room_tv",
      name: "Television",
      room: "Living room",
      icon: "📺",
      type: "switch",
      read_only: false,
      provider: "local_demo",
      device_id: "living_room_strip",
      device_name: "Living room power strip",
    },
    {
      id: "living_room_strip_2",
      entity_id: "switch.living_room_speaker",
      name: "Audio Receiver",
      room: "Living room",
      icon: "🔊",
      type: "switch",
      read_only: false,
      provider: "local_demo",
      device_id: "living_room_strip",
      device_name: "Living room power strip",
    },
    {
      id: "living_room_temp",
      entity_id: "sensor.living_room_temperature",
      name: "Room Temperature",
      room: "Living room",
      icon: "🌡️",
      type: "sensor",
      read_only: true,
      provider: "local_demo",
    },
    {
      id: "bedroom_ceiling",
      entity_id: "light.bedroom_ceiling",
      name: "Ceiling Light",
      room: "Bedroom",
      icon: "💡",
      type: "light",
      read_only: false,
      provider: "local_demo",
    },
    {
      id: "kitchen_coffee",
      entity_id: "switch.kitchen_coffee_maker",
      name: "Coffee Maker",
      room: "Kitchen",
      icon: "☕",
      type: "switch",
      read_only: false,
      provider: "local_demo",
    },
  ];

  const states = new Map<string, LocalStateEntry>([
    [
      "living_room_lamp",
      {
        state: "on",
        attributes: {
          brightness: 204,
          color_temp_kelvin: 3200,
          min_color_temp_kelvin: 2200,
          max_color_temp_kelvin: 6500,
          rgb_color: [255, 206, 152],
          supported_color_modes: ["color_temp", "rgb"],
          effect_list: ["Warm Glow", "Focus", "Relax", "Night"],
          effect: "Warm Glow",
        },
      },
    ],
    [
      "living_room_strip_1",
      { state: "on", attributes: { power: 68.4 } },
    ],
    [
      "living_room_strip_2",
      { state: "off", attributes: { power: 0 } },
    ],
    [
      "living_room_temp",
      { state: "71.5", attributes: { unit_of_measurement: "°F" } },
    ],
    [
      "bedroom_ceiling",
      {
        state: "off",
        attributes: {
          brightness: 153,
          color_temp_kelvin: 2700,
          min_color_temp_kelvin: 2200,
          max_color_temp_kelvin: 6500,
          supported_color_modes: ["color_temp"],
        },
      },
    ],
    [
      "kitchen_coffee",
      { state: "off", attributes: { power: 0 } },
    ],
  ]);

  return { entities, states };
}

export class HomeStore {
  private haUrl: string;
  private haToken: string;
  private entities = new Map<string, EntityConfig>();
  private localStates = new Map<string, LocalStateEntry>();
  private customRooms = new Set<string>();

  constructor(options?: {
    haUrl?: string;
    haToken?: string;
    seedDemo?: boolean;
  }) {
    this.haUrl = (options?.haUrl ?? process.env.HOME_ASSISTANT_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    this.haToken = (options?.haToken ?? process.env.HOME_ASSISTANT_TOKEN ?? "").trim();

    if (options?.seedDemo !== false) {
      const demo = createDefaultDemoEntities();
      for (const item of demo.entities) {
        this.entities.set(item.id, { ...item });
      }
      for (const [id, entry] of demo.states) {
        this.localStates.set(id, {
          state: entry.state,
          attributes: { ...entry.attributes },
        });
      }
    }
  }

  get enabled(): boolean {
    return this.entities.size > 0 || Boolean(this.haUrl && this.haToken);
  }

  rooms(): string[] {
    const names = new Set<string>(this.customRooms);
    for (const item of this.entities.values()) {
      names.add(item.room || "Home");
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  publicConfig() {
    return {
      enabled: this.enabled,
      configured: this.entities.size > 0,
      rooms: this.rooms(),
      entities: [...this.entities.values()].map((item) => ({ ...item })),
    };
  }

  addRoom(roomName: string): string[] {
    const name = String(roomName ?? "").trim().slice(0, 60);
    if (!name) {
      throw new ValidationError("room name is required");
    }
    this.customRooms.add(name);
    return this.rooms();
  }

  renameRoom(room: string, nextName: string): string[] {
    const name = String(nextName ?? "").trim().slice(0, 60);
    if (!name) {
      throw new ValidationError("room name is required");
    }
    if (this.customRooms.has(room)) {
      this.customRooms.delete(room);
      this.customRooms.add(name);
    }
    for (const item of this.entities.values()) {
      if ((item.room || "Home") === room) {
        item.room = name;
      }
    }
    return this.rooms();
  }

  addEntity(values: {
    entity_id?: string;
    id?: string;
    name?: string;
    room?: string;
    icon?: string;
  }): EntityConfig {
    const entityId = String(values.entity_id ?? "").trim();
    if (!VALID_ENTITY_ID.test(entityId)) {
      throw new ValidationError("choose a light, switch, or sensor entity ID");
    }
    for (const existing of this.entities.values()) {
      if (existing.entity_id === entityId) {
        throw new ValidationError("that Home Assistant entity is already on the dashboard");
      }
    }

    const domain = entityId.split(".", 1)[0] as "light" | "switch" | "sensor";
    const baseSafe = String(values.id || entityId.replace(".", "_"))
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
    const id =
      baseSafe && !this.entities.has(baseSafe)
        ? baseSafe
        : `${domain}_${this.entities.size + 1}`;
    const defaultIcon = domain === "light" ? "💡" : domain === "switch" ? "🔌" : "◌";
    const provider = this.haUrl && this.haToken ? "home_assistant" : "local_demo";

    const item: EntityConfig = {
      id,
      entity_id: entityId,
      name: String(values.name || entityId).trim().slice(0, 80),
      room: String(values.room || "Home").trim().slice(0, 60),
      icon: String(values.icon || defaultIcon).trim().slice(0, 8),
      type: domain,
      read_only: domain === "sensor",
      provider,
    };
    this.entities.set(id, item);

    if (provider === "local_demo") {
      this.localStates.set(id, {
        state: domain === "sensor" ? "0" : "off",
        attributes:
          domain === "light"
            ? {
                brightness: 255,
                color_temp_kelvin: 3200,
                min_color_temp_kelvin: 2200,
                max_color_temp_kelvin: 6500,
                supported_color_modes: ["color_temp"],
              }
            : {},
      });
    }
    return { ...item };
  }

  updateEntity(
    itemId: string,
    values: { name?: string; room?: string; icon?: string; device_name?: string }
  ): EntityConfig {
    const existing = this.entities.get(itemId);
    if (!existing) {
      throw new NotFoundError("Unknown device");
    }
    const changes: Partial<EntityConfig> = {};
    if (values.name !== undefined) {
      const cleaned = String(values.name).trim().slice(0, 80);
      if (!cleaned) throw new ValidationError("name, room, icon, and device name cannot be empty");
      changes.name = cleaned;
    }
    if (values.room !== undefined) {
      const cleaned = String(values.room).trim().slice(0, 60);
      if (!cleaned) throw new ValidationError("name, room, icon, and device name cannot be empty");
      changes.room = cleaned;
    }
    if (values.icon !== undefined) {
      const cleaned = String(values.icon).trim().slice(0, 8);
      if (!cleaned) throw new ValidationError("name, room, icon, and device name cannot be empty");
      changes.icon = cleaned;
    }
    if (values.device_name !== undefined) {
      const cleaned = String(values.device_name).trim().slice(0, 80);
      if (!cleaned) throw new ValidationError("name, room, icon, and device name cannot be empty");
      changes.device_name = cleaned;
    }
    if (Object.keys(changes).length === 0) {
      throw new ValidationError("no editable fields supplied");
    }
    Object.assign(existing, changes);
    return { ...existing };
  }

  removeEntity(itemId: string): void {
    if (!this.entities.has(itemId)) {
      throw new NotFoundError("Unknown device");
    }
    this.entities.delete(itemId);
    this.localStates.delete(itemId);
  }

  async states(): Promise<EntityStateRecord[]> {
    const haStates = new Map<string, LocalStateEntry>();
    const hasHaEntities = [...this.entities.values()].some(
      (item) => item.provider === "home_assistant"
    );

    if (hasHaEntities && this.haUrl && this.haToken) {
      try {
        const res = await fetch(`${this.haUrl}/api/states`, {
          headers: { Authorization: `Bearer ${this.haToken}` },
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            entity_id?: string;
            state?: string;
            attributes?: Record<string, unknown>;
          }>;
          for (const row of rows) {
            if (row.entity_id) {
              haStates.set(row.entity_id, {
                state: row.state ?? "unknown",
                attributes: row.attributes ?? {},
              });
            }
          }
        }
      } catch {
        // Offline Home Assistant falls back to unavailable for HA entities while local devices continue working.
      }
    }

    const result: EntityStateRecord[] = [];
    for (const item of this.entities.values()) {
      const raw =
        item.provider === "home_assistant"
          ? haStates.get(item.entity_id) ?? { state: "unavailable", attributes: {} }
          : this.localStates.get(item.id) ?? { state: "unavailable", attributes: {} };
      result.push({
        ...item,
        state: raw.state,
        attributes: { ...raw.attributes },
      });
    }
    return result;
  }

  async command(
    itemId: string,
    action: string,
    data: Record<string, unknown> = {}
  ): Promise<{ ok: boolean }> {
    const item = this.entities.get(itemId);
    if (!item) {
      throw new NotFoundError("Unknown device");
    }
    if (item.read_only || item.type === "sensor") {
      throw new ValidationError("this entity is read-only");
    }
    const allowed = new Set(["turn_on", "turn_off"]);
    if (item.type === "light") {
      allowed.add("set");
    }
    if (!allowed.has(action)) {
      throw new ValidationError("unsupported action");
    }

    if (item.provider === "home_assistant") {
      if (!this.haUrl || !this.haToken) {
        throw new Error("Home Assistant is not configured");
      }
      const payload: Record<string, unknown> = { entity_id: item.entity_id };
      let service = action;
      if (action === "set") {
        service = "turn_on";
        if (data.brightness_pct !== undefined) {
          payload.brightness_pct = Math.max(1, Math.min(100, Math.round(Number(data.brightness_pct))));
        }
        if (data.color_temp_kelvin !== undefined) {
          payload.color_temp_kelvin = Math.max(
            1500,
            Math.min(6500, Math.round(Number(data.color_temp_kelvin)))
          );
        }
        if (Array.isArray(data.rgb_color) && data.rgb_color.length === 3) {
          payload.rgb_color = data.rgb_color.map((v) =>
            Math.max(0, Math.min(255, Math.round(Number(v))))
          );
        }
        if (typeof data.effect === "string") {
          payload.effect = data.effect.slice(0, 100);
        }
      }
      const res = await fetch(`${this.haUrl}/api/services/${item.type}/${service}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.haToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`Home Assistant returned ${res.status}`);
      }
      return { ok: true };
    }

    const entry = this.localStates.get(itemId) ?? { state: "off", attributes: {} };
    if (action === "turn_off") {
      entry.state = "off";
      if (typeof entry.attributes.power === "number") {
        entry.attributes.power = 0;
      }
    } else if (action === "turn_on") {
      entry.state = "on";
      if (item.type === "switch" && entry.attributes.power !== undefined) {
        entry.attributes.power = 42.5;
      }
    } else if (action === "set") {
      entry.state = "on";
      if (data.brightness_pct !== undefined) {
        const pct = Math.max(1, Math.min(100, Math.round(Number(data.brightness_pct))));
        entry.attributes.brightness = Math.round((pct / 100) * 255);
      }
      if (data.color_temp_kelvin !== undefined) {
        entry.attributes.color_temp_kelvin = Math.max(
          1500,
          Math.min(6500, Math.round(Number(data.color_temp_kelvin)))
        );
      }
      if (Array.isArray(data.rgb_color) && data.rgb_color.length === 3) {
        entry.attributes.rgb_color = data.rgb_color.map((v) =>
          Math.max(0, Math.min(255, Math.round(Number(v))))
        );
      }
      if (typeof data.effect === "string") {
        entry.attributes.effect = data.effect.slice(0, 100);
      }
    }
    this.localStates.set(itemId, entry);
    return { ok: true };
  }

  async setRoomPower(room: string, action: "turn_on" | "turn_off"): Promise<RoomPowerResult> {
    const targets = [...this.entities.values()]
      .filter(
        (item) =>
          (item.room || "Home") === room &&
          !item.read_only &&
          (item.type === "light" || item.type === "switch")
      )
      .map((item) => item.id);
    const errors: Array<{ id: string; error: string }> = [];
    for (const id of targets) {
      try {
        await this.command(id, action, {});
      } catch (err) {
        errors.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { ok: errors.length === 0, action, entities: targets, errors };
  }
}

export class DioramaStore {
  private model: DioramaPayload;

  constructor(initial?: DioramaPayload) {
    this.model = initial ?? {
      type: "custom:diorama-card",
      rooms: [
        {
          id: "living_room",
          name: "Living room",
          points: [
            [0, 0],
            [4.5, 0],
            [4.5, 3.6],
            [0, 3.6],
          ],
        },
        {
          id: "bedroom",
          name: "Bedroom",
          points: [
            [4.5, 0],
            [7.8, 0],
            [7.8, 3.6],
            [4.5, 3.6],
          ],
        },
      ],
      decorations: [],
      devices: [],
    };
  }

  static validate(payload: unknown): DioramaPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ValidationError("Diorama configuration must be a JSON object");
    }
    const obj = payload as Record<string, unknown>;
    const rooms = obj.rooms ?? [];
    const decorations = obj.decorations ?? [];
    const devices = obj.devices ?? [];
    if (!Array.isArray(rooms) || !Array.isArray(decorations) || !Array.isArray(devices)) {
      throw new ValidationError("rooms, decorations and devices must be lists");
    }
    const roomIds = new Set<string>();
    for (const room of rooms) {
      if (!room || typeof room !== "object") {
        throw new ValidationError("Every room needs a unique id");
      }
      const id = (room as Record<string, unknown>).id;
      if (typeof id !== "string" || !id || roomIds.has(id)) {
        throw new ValidationError("Every room needs a unique id");
      }
      roomIds.add(id);
      const points = (room as Record<string, unknown>).points;
      if (!Array.isArray(points) || points.length < 3) {
        throw new ValidationError(`Room ${id} needs at least three points`);
      }
    }
    for (const item of decorations) {
      if (
        !item ||
        typeof item !== "object" ||
        !(item as Record<string, unknown>).id ||
        !(item as Record<string, unknown>).kind
      ) {
        throw new ValidationError("Every decoration needs an id and kind");
      }
      const roomRef = (item as Record<string, unknown>).room;
      if (typeof roomRef !== "string" || !roomIds.has(roomRef)) {
        throw new ValidationError(
          `Decoration ${(item as Record<string, unknown>).id} references an unknown room`
        );
      }
    }
    return {
      ...obj,
      rooms: rooms as DioramaRoom[],
      decorations: decorations as DioramaDecoration[],
      devices: devices as Record<string, unknown>[],
    };
  }

  load(): DioramaPayload {
    return structuredClone(this.model);
  }

  save(payload: unknown): DioramaPayload {
    const validated = DioramaStore.validate(payload);
    this.model = structuredClone(validated);
    return this.load();
  }
}

export class MusicReactiveStore {
  private home: HomeStore;
  private lightId: string;
  private timeoutMs: number;
  private owner: { id: string; name: string } | null = null;
  private expiresAt = 0;
  private lastWrite = 0;
  private lastColour = 0;

  constructor(home: HomeStore, lightId = "living_room_lamp", timeoutSeconds = 12) {
    this.home = home;
    this.lightId = lightId;
    this.timeoutMs = Math.max(5, Math.min(60, timeoutSeconds)) * 1000;
  }

  private clearExpired(now: number): void {
    if (this.owner && now >= this.expiresAt) {
      this.owner = null;
    }
  }

  status(now = Date.now()) {
    this.clearExpired(now);
    return {
      active: Boolean(this.owner),
      owner: this.owner,
      expires_in: this.owner ? Math.max(0, Number(((this.expiresAt - now) / 1000).toFixed(1))) : 0,
    };
  }

  claim(clientId: string, name: string, takeOver = false, now = Date.now()) {
    this.clearExpired(now);
    if (this.owner && this.owner.id !== clientId && !takeOver) {
      throw new ConflictError("Music reactive mode is already running on another device");
    }
    this.owner = { id: clientId, name: (name || "This device").slice(0, 60) };
    this.expiresAt = now + this.timeoutMs;
    return this.status(now);
  }

  stop(clientId: string, takeOver = false, now = Date.now()) {
    this.clearExpired(now);
    if (this.owner && this.owner.id !== clientId && !takeOver) {
      throw new ConflictError("Only the active audio source can stop this mode");
    }
    this.owner = null;
    return this.status(now);
  }

  async update(
    clientId: string,
    level: number,
    beat: boolean,
    hue: number,
    now = Date.now()
  ) {
    this.clearExpired(now);
    if (!this.owner || this.owner.id !== clientId) {
      throw new ConflictError("This device is not the active audio source");
    }
    this.expiresAt = now + this.timeoutMs;
    if (now - this.lastWrite < 280) {
      return this.status(now);
    }
    this.lastWrite = now;
    const clampedLevel = Math.max(0, Math.min(1, level));
    const brightness = Math.max(8, Math.min(100, Math.round(12 + clampedLevel * 88)));
    const payload: Record<string, unknown> = { brightness_pct: brightness };
    if (beat && now - this.lastColour > 800) {
      this.lastColour = now;
      payload.rgb_color = MusicReactiveStore.hsvToRgb(((hue % 360) + 360) % 360, 0.82, 1);
    }
    try {
      await this.home.command(this.lightId, "set", payload);
    } catch {
      // Ignore if target light was removed by the user.
    }
    return this.status(now);
  }

  static hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - chroma;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 60) [r, g, b] = [chroma, x, 0];
    else if (hue < 120) [r, g, b] = [x, chroma, 0];
    else if (hue < 180) [r, g, b] = [0, chroma, x];
    else if (hue < 240) [r, g, b] = [0, x, chroma];
    else if (hue < 300) [r, g, b] = [x, 0, chroma];
    else [r, g, b] = [chroma, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
}
