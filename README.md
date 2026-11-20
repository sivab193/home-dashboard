# Home Dashboard

A self-hosted dashboard for home devices, editable 3D floor plans, weather,
world clocks, stocks, a read-only calendar feed, and YouTube Music controls.
No residence layout or device inventory is bundled. CCTV and alerts are optional.

## Start

Install Docker with Compose v2. macOS also needs Python 3.11+.

```sh
git clone https://github.com/sivab193/home-dashboard.git
cd home-dashboard
cp .env.example .env
./stack.sh start dashboard home
```

Open http://localhost:1984/dashboard. On a phone on the same LAN, replace
localhost with the server address. This app has no user authentication; keep
it on a trusted LAN rather than exposing it to the public internet.

```sh
./stack.sh stop dashboard home
./stack.sh status
./stack.sh start homeassistant  # optional
./stack.sh start cctv alerts    # only after configuring cameras
```

macOS runs the home bridge on the host for Smarteefi broadcast and Brave
integration; other services use containers. Linux uses a host-networked bridge.
Run only one instance per host unless you change the default port mappings.

## Configure

- Devices: edit ignored `alerts/config.local.yaml` using the example beside it.
  For Home Assistant, set URL/token in `.env`, then add entities in Home → Controls.
  Rename and group devices in the UI. Restart home after configuration changes.
- Floor plan: open `/home/floorplan` → Edit layout. Add rooms, furniture and sockets
  to the empty model. Changes stay in ignored `data/home/diorama.json`.
- Widgets: Customize edits cities, clocks, favorites and stock symbols. Drag the
  move handle and resize at the bottom-right; arrow keys also work. Preferences
  stay in browser storage.
- Calendar: set `CALENDAR_ICS_URL` and optional `CALENDAR_ICS_TOKEN` in `.env`.
  Read-only sync runs every 15 minutes, handles recurrence, and lists new/changed
  events under Updates. No events are written upstream.
- Stocks: Yahoo Finance quotes refresh every 5 minutes. Timestamps, currency,
  delayed-data notice and cached/unavailable states are shown. Its public endpoint
  currently needs no API key but has no availability guarantee.
- YouTube Music: on macOS, open music.youtube.com in Brave and enable View →
  Developer → Allow JavaScript from Apple Events. Linux controls are unavailable.
  The YouTube Music site blocks iframe embedding.
- CCTV: fill DVR values in `.env` before enabling camera services. Example
  addresses are placeholders, not working camera connections.

## Development

Frontend: plain JavaScript/CSS in `www/`. Backend: FastAPI in `alerts/service/`.
Refresh for frontend changes; use `./stack.sh restart home` for backend changes.

```sh
PYTHONPATH=alerts alerts/.venv/bin/python -m unittest discover -s alerts/tests
node --check www/dashboard.js
```

## Privacy and credits

See [PRIVACY.md](PRIVACY.md). This generic edition starts with fresh Git history.
Keep personal deployments separate; never merge private house history here.

Project code is MIT licensed. Third-party code keeps its original licenses:

- [ha-diorama](https://github.com/CarlesRojas/ha-diorama): MIT renderer/editor;
  license in `www/vendor/HA-DIORAMA-LICENSE.txt`.
- [Community iOS design system](https://github.com/seunghan91/ios26-design-system):
  pinned MIT typography/palette subset in `www/vendor/ios26/`. Not an official
  Apple library. The clock and stock widgets are custom implementations.
- [go2rtc](https://github.com/AlexxIT/go2rtc): MIT browser player files from
  v1.9.14, matched to the container image.
