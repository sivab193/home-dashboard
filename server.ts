import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response } from "express";
import {
  ConflictError,
  DioramaStore,
  HomeStore,
  MusicReactiveStore,
  NotFoundError,
  ValidationError,
} from "./server/home-store.ts";
import { StockQuotesService } from "./server/stocks.ts";
import { CalendarFeedService } from "./server/calendar.ts";
import {
  AutomationsStore,
  DockConfigStore,
  MediaDeckStore,
  ScheduleStore,
} from "./server/dockspace-store.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW_DIR = path.join(__dirname, "www");
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

export function createApp() {
  const app = express();
  const home = new HomeStore();
  const diorama = new DioramaStore();
  const music = new MusicReactiveStore(home);
  const stocks = new StockQuotesService();
  const calendar = new CalendarFeedService();
  const automations = new AutomationsStore();
  const media = new MediaDeckStore();
  const schedule = new ScheduleStore();
  const dockConfig = new DockConfigStore();

  app.use(express.json({ limit: "2mb" }));

  // ---- Optional CCTV / Alerts service routes ----
  app.get("/api/streams", (_req: Request, res: Response) => {
    res.json({});
  });

  app.get("/api/events", (_req: Request, res: Response) => {
    res.json([]);
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({});
  });

  app.get("/api/snapshots/:name", (_req: Request, res: Response) => {
    res.status(404).json({ error: "not found" });
  });

  // ---- DockSpace Automations, Media, Schedule & Config ----
  app.get("/api/automations", (_req: Request, res: Response) => {
    res.json(automations.summary());
  });

  app.post("/api/automations", (req: Request, res: Response) => {
    try {
      const rule = automations.addRule(req.body ?? {});
      res.status(201).json({ rule, ...automations.summary() });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not add automation rule" });
    }
  });

  app.post("/api/automations/:id/toggle", (req: Request, res: Response) => {
    try {
      const rule = automations.toggleRule(String(req.params.id));
      res.json({ rule, ...automations.summary() });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not toggle automation rule" });
    }
  });

  app.delete("/api/automations/:id", (req: Request, res: Response) => {
    try {
      automations.removeRule(String(req.params.id));
      res.json({ ok: true, ...automations.summary() });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not remove automation rule" });
    }
  });

  app.get("/api/media", (_req: Request, res: Response) => {
    res.json(media.state());
  });

  app.post("/api/media/control", (req: Request, res: Response) => {
    try {
      res.json(media.control(req.body ?? {}));
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Media command failed" });
    }
  });

  app.get("/api/schedule", (_req: Request, res: Response) => {
    res.json({ events: schedule.list() });
  });

  app.post("/api/schedule", (req: Request, res: Response) => {
    try {
      const event = schedule.addEvent(req.body ?? {});
      res.status(201).json({ event, events: schedule.list() });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not create event" });
    }
  });

  app.delete("/api/schedule/:id", (req: Request, res: Response) => {
    try {
      schedule.removeEvent(String(req.params.id));
      res.json({ ok: true, events: schedule.list() });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not delete event" });
    }
  });

  app.get("/api/config", (_req: Request, res: Response) => {
    res.json(dockConfig.get());
  });

  app.patch("/api/config", (req: Request, res: Response) => {
    try {
      res.json(dockConfig.update(req.body ?? {}));
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not update configuration" });
    }
  });

  app.post("/api/config/reset", (_req: Request, res: Response) => {
    res.json(dockConfig.reset());
  });

  // ---- Dashboard widgets ----
  app.get("/api/dashboard/stocks", async (req: Request, res: Response) => {
    const symbols =
      typeof req.query.symbols === "string" && req.query.symbols.trim()
        ? req.query.symbols
        : dockConfig.get().stockSymbols;
    try {
      res.json(await stocks.quotes(symbols));
    } catch (err) {
      res.status(400).json({ detail: err instanceof Error ? err.message : "Invalid symbols" });
    }
  });

  app.get("/api/dashboard/calendar", async (_req: Request, res: Response) => {
    res.json(await calendar.status());
  });

  app.post("/api/dashboard/calendar/read", (_req: Request, res: Response) => {
    res.json(calendar.markRead());
  });

  app.get("/api/dashboard/mac/music", (_req: Request, res: Response) => {
    const state = media.state();
    res.json({
      available: true,
      state: state.playing ? "playing" : "paused",
      title: state.track.title,
      artist: state.track.artist,
      album: state.track.album,
    });
  });

  app.post("/api/dashboard/mac/music", (req: Request, res: Response) => {
    try {
      const state = media.control(req.body ?? {});
      res.json({
        available: true,
        state: state.playing ? "playing" : "paused",
        title: state.track.title,
        artist: state.track.artist,
      });
    } catch (err) {
      res.status(400).json({ detail: err instanceof Error ? err.message : "Media control failed" });
    }
  });

  app.get("/api/dashboard/mac/calendar", (_req: Request, res: Response) => {
    res.json({ available: true, events: schedule.list() });
  });

  // ---- Smart Home & 3D Diorama ----
  app.get("/api/home/config", (_req: Request, res: Response) => {
    res.json(home.publicConfig());
  });

  app.get("/api/home/states", async (_req: Request, res: Response) => {
    if (!home.enabled) {
      res.status(503).json({ detail: "Home Assistant is not configured" });
      return;
    }
    res.json(await home.states());
  });

  app.get("/api/home/diorama", (_req: Request, res: Response) => {
    res.json(diorama.load());
  });

  app.put("/api/home/diorama", (req: Request, res: Response) => {
    try {
      res.json(diorama.save(req.body));
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "The home model could not be saved" });
    }
  });

  app.post("/api/home/entities", (req: Request, res: Response) => {
    try {
      res.json(home.addEntity(req.body ?? {}));
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not add device" });
    }
  });

  app.post("/api/home/entities/:itemId", async (req: Request, res: Response) => {
    try {
      const action = String(req.body?.action ?? "");
      const data =
        req.body?.data && typeof req.body.data === "object"
          ? (req.body.data as Record<string, unknown>)
          : {};
      res.json(await home.command(String(req.params.itemId), action, data));
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(502).json({ detail: "Device command failed" });
    }
  });

  app.patch("/api/home/entities/:itemId", (req: Request, res: Response) => {
    try {
      res.json(home.updateEntity(String(req.params.itemId), req.body ?? {}));
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not update device" });
    }
  });

  app.delete("/api/home/entities/:itemId", (req: Request, res: Response) => {
    try {
      home.removeEntity(String(req.params.itemId));
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not remove device" });
    }
  });

  app.post("/api/home/rooms", (req: Request, res: Response) => {
    try {
      res.json({ rooms: home.addRoom(String(req.body?.name ?? "")) });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not add room" });
    }
  });

  app.patch("/api/home/rooms/:room", (req: Request, res: Response) => {
    try {
      res.json({
        rooms: home.renameRoom(String(req.params.room), String(req.body?.name ?? "")),
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not rename room" });
    }
  });

  app.post("/api/home/rooms/:room/turn_off", async (req: Request, res: Response) => {
    res.json(await home.setRoomPower(String(req.params.room), "turn_off"));
  });

  app.post("/api/home/rooms/:room/turn_on", async (req: Request, res: Response) => {
    res.json(await home.setRoomPower(String(req.params.room), "turn_on"));
  });

  // ---- Music reactive light lease ----
  app.get("/api/home/music-reactive", (_req: Request, res: Response) => {
    res.json(music.status());
  });

  app.post("/api/home/music-reactive/claim", (req: Request, res: Response) => {
    try {
      const clientId = String(req.body?.client_id ?? "");
      if (clientId.length < 8) {
        res.status(400).json({ detail: "client_id must be at least 8 characters" });
        return;
      }
      res.json(
        music.claim(
          clientId,
          String(req.body?.name ?? "This device"),
          Boolean(req.body?.take_over)
        )
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        res.status(409).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Music reactive claim failed" });
    }
  });

  app.post("/api/home/music-reactive/level", async (req: Request, res: Response) => {
    try {
      const clientId = String(req.body?.client_id ?? "");
      const level = Number(req.body?.level ?? 0);
      const beat = Boolean(req.body?.beat);
      const hue = Number(req.body?.hue ?? 210);
      res.json(await music.update(clientId, level, beat, hue));
    } catch (err) {
      if (err instanceof ConflictError) {
        res.status(409).json({ detail: err.message });
        return;
      }
      res.status(502).json({ detail: "Home Assistant command failed" });
    }
  });

  app.post("/api/home/music-reactive/stop", (req: Request, res: Response) => {
    try {
      const clientId = String(req.body?.client_id ?? "");
      res.json(music.stop(clientId, Boolean(req.body?.take_over)));
    } catch (err) {
      if (err instanceof ConflictError) {
        res.status(409).json({ detail: err.message });
        return;
      }
      res.status(500).json({ detail: "Could not stop music reactive mode" });
    }
  });

  // ---- Static frontend & SPA route fallback ----
  app.use(express.static(WWW_DIR));

  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ detail: "Not found" });
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      res.sendFile(path.join(WWW_DIR, "index.html"));
      return;
    }
    res.status(404).end();
  });

  return app;
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Home Dashboard listening on http://${HOST}:${PORT}`);
  });
}
