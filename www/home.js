/* Home Dashboard home controls. Home Assistant credentials stay server-side. */
(() => {
  // Docker uses same-origin proxy routes. The fallback keeps the legacy
  // go2rtc-served dashboard and Android shell compatible with port 8090.
  const apiUrl = new URL(HOST);
  apiUrl.port = "8090";
  apiUrl.pathname = "";
  const API = window.HOME_DASHBOARD_API_ORIGIN || apiUrl.origin;
  const view = document.getElementById("homeView");
  let config = null;
  let music = null;
  let musicStream = null;
  let audioContext = null;
  let analyser = null;
  let musicFrame = null;
  let lastMusicSend = 0;
  let smoothedLevel = 0;
  let lastBass = 0;
  let musicHue = 210;
  let lastStates = [];
  let homeMode = localStorage.getItem("homeDashboardHomeMode") || "floorplan";
  const clientId = localStorage.getItem("homeDashboardMusicClient") ||
    (crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random()}`);
  localStorage.setItem("homeDashboardMusicClient", clientId);
  const clientName = /Android/i.test(navigator.userAgent) ? "Android app" :
    /iPhone|iPad/i.test(navigator.userAgent) ? "iPhone or iPad" : "This dashboard";

  const esc = value => String(value).replace(/[&<>'"]/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"})[c]);
  function renderNotice(title, text){
    view.innerHTML = `<div class="home-empty"><div class="home-empty-icon">⌂</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
  }
  function stateLabel(device){
    if (device.type === "sensor") {
      const unit = device.attributes?.unit_of_measurement || "";
      return `${device.state} ${unit}`.trim();
    }
    if (device.state === "unavailable" || device.state === "unknown") return "Offline";
    if (device.state === "on") {
      const watts = device.attributes?.power;
      return watts == null ? "On" : `On · ${Number(watts).toFixed(1)} W`;
    }
    return "Off";
  }
  function deviceGroups(devices){
    const groups = new Map();
    const ungrouped = [];
    for (const device of devices) {
      if (!device.device_id) { ungrouped.push(device); continue; }
      if (!groups.has(device.device_id)) groups.set(device.device_id, {
        id: device.device_id,
        name: device.device_name || "Connected device",
        outlets: [],
      });
      groups.get(device.device_id).outlets.push(device);
    }
    return {groups: [...groups.values()], ungrouped};
  }
  function roomDevices(devices){
    const {groups, ungrouped} = deviceGroups(devices);
    const grouped = groups.map(group => {
      const controllable = group.outlets.filter(outlet => !outlet.read_only && outlet.state !== "unavailable");
      const action = controllable.some(outlet => outlet.state === "on") ? "turn_off" : "turn_on";
      const label = action === "turn_off" ? "Turn off device" : "Turn on device";
      return `<div class="device-group">
      <div class="device-group-head"><div><h3>${esc(group.name)}</h3><p>${group.outlets.length} ${group.outlets.length === 1 ? "outlet" : "outlets"} · Local power strip</p></div>
      <div class="device-group-actions"><button class="room-button" data-device-group-edit="${esc(group.id)}">Rename strip</button><button class="room-button ${action === "turn_off" ? "room-off" : "room-on"}" data-device-action="${action}" data-device-ids="${esc(group.outlets.map(outlet => outlet.id).join(","))}" ${controllable.length ? "" : "disabled"}>${label}</button></div></div>
      <div class="device-grid">${group.outlets.map(card).join("")}</div>
    </div>`;
    }).join("");
    const standalone = ungrouped.length ? `<div class="device-grid">${ungrouped.map(card).join("")}</div>` : "";
    return grouped + standalone || `<p class="room-empty">No devices in this room yet.</p>`;
  }
  function roomControlsScene(devices){
    return `<div class="room-visual"><div class="room-visual-copy"><div><h3>Room controls</h3><p>Use the Floor plan editor to place devices in your own 3D room.</p></div></div><div class="device-grid">${devices.map(card).join("") || '<p class="room-empty">Configure devices to get started.</p>'}</div></div>`;
  }
  function homeFloorPlan(states){
    const unplacedRooms = [...new Set(states.map(device => device.room).filter(Boolean))];
    return `<section class="home-floorplan" aria-labelledby="floorplanTitle">
      <div class="floorplan-heading"><div><h2 id="floorplanTitle">Home floor plan</h2><p>Create your own rooms, furniture, appliances and sockets</p></div><button class="floorplan-edit" id="dioramaEdit">Edit layout</button></div>
      <div class="diorama-mount" id="dioramaMount" role="region" aria-label="Interactive three-dimensional apartment model" tabindex="0"><p>Loading 3D home…</p></div>
      <div class="floorplan-inspector" aria-live="polite"><div><strong>Your home model</strong><p>Orbit, zoom and tap objects. Use Edit layout to move walls, furniture, appliances, doors and future sockets.</p></div>${unplacedRooms.length ? `<span class="floor-unplaced">${esc(unplacedRooms.join(", "))} · ${states.length} smart controls ready to place</span>` : ""}</div>
      <dialog class="diorama-editor-dialog" id="dioramaEditorDialog" aria-labelledby="dioramaEditorTitle"><div class="diorama-editor-shell"><header><div><h2 id="dioramaEditorTitle">Edit home model</h2><p id="dioramaSaveStatus">Changes save automatically</p></div><button id="dioramaEditorClose">Close editor</button></header><div id="dioramaEditorMount"></div></div></dialog>
    </section>`;
  }
  async function mountDiorama(states){
    const host = document.getElementById("dioramaMount");
    if (!host) return;
    try {
      const adapter = await import("./diorama-adapter.js?v=1");
      await adapter.mountDiorama(host, states, API);
    } catch (error) {
      host.innerHTML = `<div class="diorama-error"><strong>3D model unavailable</strong><p>${esc(error.message || "Reload the dashboard to try again.")}</p></div>`;
    }
  }
  function homeDashboard(){
    return `<section class="life-dashboard" id="lifeDashboard" aria-label="Custom home dashboard"><p class="dashboard-loading">Preparing your dashboard…</p></section>`;
  }
  async function mountLifeDashboard(states){
    const host = document.getElementById("lifeDashboard");
    if (!host) return;
    try {
      const dashboard = await import("./dashboard.js?v=6");
      await dashboard.mountDashboard(host, states, API);
    } catch (error) {
      host.innerHTML = `<div class="dashboard-error"><strong>Dashboard unavailable</strong><p>${esc(error.message || "Reload to try again.")}</p></div>`;
    }
  }
  function roomContent(room, devices){
    if (homeMode === "room") return roomControlsScene(devices);
    return roomDevices(devices);
  }
  function render(states){
    lastStates = states;
    const rooms = new Map();
    for (const room of config?.rooms || []) rooms.set(room, []);
    for (const device of states) rooms.set(device.room, [...(rooms.get(device.room) || []), device]);
    const roomSections = [...rooms].map(([room, devices]) => {
      const controllable = devices.filter(device => !device.read_only && ["light", "switch"].includes(device.type) && device.state !== "unavailable");
      const action = controllable.some(device => device.state === "on") ? "turn_off" : "turn_on";
      const label = action === "turn_off" ? "Turn off room" : "Turn on room";
      return `<section class="room"><div class="room-head"><h2>${esc(room)}</h2><div><button class="room-button" data-room-edit="${esc(room)}">Edit</button><button class="room-button ${action === "turn_off" ? "room-off" : "room-on"}" data-room-action="${action}" data-room="${esc(room)}" ${controllable.length ? "" : "disabled"}>${label}</button></div></div>${roomContent(room, devices)}</section>`;
    }).join("");
    const content = homeMode === "dashboard" ? homeDashboard() : homeMode === "floorplan" ? `${homeFloorPlan(states)}${musicCard()}` : `${musicCard()}${roomSections}`;
    const homeActions = homeMode === "dashboard" ? "" : `<div class="home-actions"><div class="home-mode" role="group" aria-label="Home display"><button data-home-mode="floorplan" class="${homeMode === "floorplan" ? "on" : ""}">Home map</button><button data-home-mode="room" class="${homeMode === "room" ? "on" : ""}">Room detail</button><button data-home-mode="controls" class="${homeMode === "controls" ? "on" : ""}">Controls</button></div><button class="home-refresh" id="homeAddRoom">＋ Room</button><button class="home-refresh" id="homeAddDevice">＋ Device</button><button class="home-refresh" id="homeRefresh">↻ Refresh</button></div>`;
    view.innerHTML = homeMode === "dashboard" ? content : `<div class="home-head"><div><h1>Home</h1><p>Control your connected devices locally.</p></div>${homeActions}</div>${content}`;
    if (homeMode !== "dashboard") {
      document.getElementById("homeRefresh").onclick = load;
      document.getElementById("homeAddRoom").onclick = addRoom;
      document.getElementById("homeAddDevice").onclick = addDevice;
    }
    if (homeMode === "floorplan") mountDiorama(states);
    if (homeMode === "dashboard") mountLifeDashboard(states);
    view.querySelectorAll("[data-home-mode]").forEach(button => button.onclick = () => {
      const routes = {floorplan: '/home/floorplan', room: '/home/roomview', controls: '/home/controls'};
      window.navigateDashboard(routes[button.dataset.homeMode]);
    });
    view.querySelectorAll("[data-command]").forEach(button => button.onclick = () => command(button));
    view.querySelectorAll("input[data-brightness]").forEach(input => input.onchange = () =>
      command(input, "set", {brightness_pct: Number(input.value)}));
    view.querySelectorAll("input[data-color-temp]").forEach(input => input.onchange = () =>
      command(input, "set", {color_temp_kelvin: Number(input.value)}));
    view.querySelectorAll("input[data-color]").forEach(input => input.onchange = () => {
      const hex = input.value.slice(1);
      command(input, "set", {rgb_color: [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))});
    });
    view.querySelectorAll("select[data-effect]").forEach(select => select.onchange = () =>
      command(select, "set", {effect: select.value}));
    const musicButton = document.getElementById("musicReactive");
    if (musicButton) musicButton.onclick = () => {
      if (music?.active && music.owner?.id === clientId) stopMusic();
      else startMusic(Boolean(music?.active));
    };
    const musicStop = document.getElementById("musicStop");
    if (musicStop) musicStop.onclick = () => stopMusic(true);
    view.querySelectorAll("[data-room-action]").forEach(button => button.onclick = () => setRoomPower(button));
    view.querySelectorAll("[data-device-action]").forEach(button => button.onclick = () => setDevicePower(button));
    view.querySelectorAll("[data-device-off]").forEach(button => button.onclick = () => turnOffDevice(button));
    view.querySelectorAll("[data-room-edit]").forEach(button => button.onclick = () => renameRoom(button.dataset.roomEdit));
    view.querySelectorAll("[data-edit-device]").forEach(button => button.onclick = () => editDevice(button.dataset.editDevice));
    view.querySelectorAll("[data-device-group-edit]").forEach(button => button.onclick = () => renameDeviceGroup(button.dataset.deviceGroupEdit));
    view.querySelectorAll("[data-remove-device]").forEach(button => button.onclick = () => removeDevice(button.dataset.removeDevice));
  }
  function musicCard(){
    const active = music?.active;
    const mine = active && music.owner?.id === clientId;
    const owner = music?.owner?.name || "another device";
    const label = mine ? "Stop music reactive" : active ? "Take over audio" : "Start music reactive";
    const detail = mine ? "Your microphone is driving the living-room light." : active ?
      `Running from ${owner}. Taking over switches the audio source to this device.` :
      "Use this device's microphone to make the light respond to any nearby music.";
    return `<section class="music-card ${active ? "is-active" : ""}"><div class="music-icon">♫</div><div class="music-copy"><h2>Music reactive</h2><p>${esc(detail)}</p></div><div class="music-actions"><button id="musicReactive" class="music-toggle">${label}</button>${active && !mine ? `<button id="musicStop" class="music-stop">Stop</button>` : ""}</div></section>`;
  }
  function card(device){
    const online = !["unavailable", "unknown"].includes(device.state);
    const on = device.state === "on";
    const controllable = device.type !== "sensor" && !device.read_only;
    const brightness = Math.round((device.attributes?.brightness || 255) / 255 * 100);
    const modes = device.attributes?.supported_color_modes || [];
    const supportsTemp = modes.includes("color_temp");
    const supportsColor = modes.some(mode => ["hs", "rgb", "rgbw", "rgbww"].includes(mode));
    const minTemp = device.attributes?.min_color_temp_kelvin || 2200;
    const maxTemp = device.attributes?.max_color_temp_kelvin || 6500;
    const colorTemp = device.attributes?.color_temp_kelvin || Math.round((minTemp + maxTemp) / 2);
    const rgb = device.attributes?.rgb_color || device.attributes?.rgbw_color || [255, 255, 255];
    const color = "#" + rgb.slice(0, 3).map(value => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, "0")).join("");
    const effects = device.attributes?.effect_list || [];
    return `<article class="device-card ${on ? "is-on" : ""} ${online ? "" : "is-offline"}">
      <div class="device-top"><span class="device-icon">${esc(device.icon)}</span><span class="device-state">${esc(stateLabel(device))}</span></div>
      <h3>${esc(device.name)}</h3><p>${esc(device.read_only ? "State visible · control pending WiZ fix" : device.type === "light" ? "Smart light" : device.type === "sensor" ? "Live measurement" : "Smart plug")}</p>
      ${controllable ? `<div class="device-actions"><button class="device-toggle" data-command="${on ? "turn_off" : "turn_on"}" data-id="${esc(device.id)}" ${online ? "" : "disabled"}>${on ? "Turn off" : "Turn on"}</button></div>` : ""}
      ${device.type === "light" && controllable ? `<label class="brightness">Brightness <span>${brightness}%</span><input data-brightness data-id="${esc(device.id)}" type="range" min="1" max="100" value="${brightness}" ${online ? "" : "disabled"}></label>` : ""}
      ${device.type === "light" && controllable && supportsTemp ? `<label class="brightness">Colour temperature <span>${colorTemp} K</span><input data-color-temp data-id="${esc(device.id)}" type="range" min="${minTemp}" max="${maxTemp}" value="${colorTemp}" ${online ? "" : "disabled"}></label>` : ""}
      ${device.type === "light" && controllable && supportsColor ? `<label class="brightness">Colour <input data-color data-id="${esc(device.id)}" type="color" value="${color}" ${online ? "" : "disabled"}></label>` : ""}
      ${device.type === "light" && controllable && effects.length ? `<label class="brightness">Effect <select data-effect data-id="${esc(device.id)}" ${online ? "" : "disabled"}>${effects.map(effect => `<option value="${esc(effect)}" ${effect === device.attributes?.effect ? "selected" : ""}>${esc(effect)}</option>`).join("")}</select></label>` : ""}
      <div class="device-manage"><button data-edit-device="${esc(device.id)}">Rename / move</button><button data-remove-device="${esc(device.id)}">Remove</button></div>
    </article>`;
  }
  async function command(control, action = control.dataset.command, data = {}){
    const id = control.dataset.id;
    if (!id) return;
    control.disabled = true;
    try {
      const r = await fetch(`${API}/api/home/entities/${encodeURIComponent(id)}`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action, data})});
      if (!r.ok) throw new Error();
      setTimeout(load, 350);
    } catch (_) { DashboardUI.alert("Device control failed. Check the Home Dashboard service and Home Assistant."); }
    finally { control.disabled = false; }
  }
  async function manage(path, method, body){
    const options = {method, headers: {"Content-Type": "application/json"}};
    if (body) options.body = JSON.stringify(body);
    const r = await fetch(`${API}/api/home${path}`, options);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Could not save dashboard changes");
    return r.json();
  }
  async function addRoom(){
    const name = await DashboardUI.prompt("Room name"); if (!name?.trim()) return;
    try { await manage("/rooms", "POST", {name}); await load(); } catch (error) { DashboardUI.alert(error.message); }
  }
  async function renameRoom(room){
    const name = await DashboardUI.prompt("Rename room", room); if (!name?.trim() || name === room) return;
    try { await manage(`/rooms/${encodeURIComponent(room)}`, "PATCH", {name}); await load(); } catch (error) { DashboardUI.alert(error.message); }
  }
  async function addDevice(){
    const entity_id = await DashboardUI.prompt("Home Assistant entity ID (for example light.living_room_lamp)");
    if (!entity_id?.trim()) return;
    const name = await DashboardUI.prompt("Display name", entity_id) || entity_id;
    const room = await DashboardUI.prompt("Room", config?.rooms?.[0] || "Home") || "Home";
    const icon = await DashboardUI.prompt("Icon", entity_id.startsWith("light.") ? "💡" : entity_id.startsWith("switch.") ? "🔌" : "◌") || "⌂";
    try { await manage("/entities", "POST", {entity_id, name, room, icon}); await load(); } catch (error) { DashboardUI.alert(error.message); }
  }
  async function editDevice(id){
    const device = (await fetch(`${API}/api/home/states`).then(r => r.json())).find(item => item.id === id);
    if (!device) return;
    const name = await DashboardUI.prompt("Display name", device.name); if (!name?.trim()) return;
    const room = await DashboardUI.prompt("Room", device.room); if (!room?.trim()) return;
    const icon = await DashboardUI.prompt("Icon", device.icon); if (!icon?.trim()) return;
    try { await manage(`/entities/${encodeURIComponent(id)}`, "PATCH", {name, room, icon}); await load(); } catch (error) { DashboardUI.alert(error.message); }
  }
  async function renameDeviceGroup(deviceId){
    const outlets = lastStates.filter(device => device.device_id === deviceId);
    if (!outlets.length) return;
    const name = await DashboardUI.prompt("Power strip name", outlets[0].device_name || "Power strip");
    if (!name?.trim() || name === outlets[0].device_name) return;
    try {
      await Promise.all(outlets.map(device => manage(`/entities/${encodeURIComponent(device.id)}`, "PATCH", {device_name: name})));
      await load();
    } catch (error) { DashboardUI.alert(error.message); }
  }
  async function removeDevice(id){
    if (!await DashboardUI.confirm("Remove this device from the dashboard? It will stay in Home Assistant.")) return;
    try { await manage(`/entities/${encodeURIComponent(id)}`, "DELETE"); await load(); } catch (error) { DashboardUI.alert(error.message); }
  }
  async function setRoomPower(button){
    const room = button.dataset.room;
    const action = button.dataset.roomAction;
    const verb = action === "turn_on" ? "Turn on" : "Turn off";
    if (!await DashboardUI.confirm(`${verb} all controllable devices in ${room}?`)) return;
    button.disabled = true;
    try { await manage(`/rooms/${encodeURIComponent(room)}/${action}`, "POST"); setTimeout(load, 400); }
    catch (error) { DashboardUI.alert(error.message); button.disabled = false; }
  }
  async function setDevicePower(button){
    const ids = button.dataset.deviceIds.split(",").filter(Boolean);
    const action = button.dataset.deviceAction;
    const verb = action === "turn_on" ? "Turn on" : "Turn off";
    if (!await DashboardUI.confirm(`${verb} every available outlet on this power strip?`)) return;
    button.disabled = true;
    try {
      for (const id of ids) {
        const response = await fetch(`${API}/api/home/entities/${encodeURIComponent(id)}`, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({action, data: {}}),
        });
        if (!response.ok) throw new Error();
      }
      setTimeout(load, 400);
    } catch (_) {
      DashboardUI.alert(`Some outlets could not be switched ${action === "turn_on" ? "on" : "off"}. Check that the power strip is online.`);
      button.disabled = false;
    }
  }
  async function turnOffDevice(button){
    const ids = button.dataset.deviceOff.split(",").filter(Boolean);
    if (!await DashboardUI.confirm("Turn off every outlet on this device?")) return;
    button.disabled = true;
    try {
      for (const id of ids) {
        const response = await fetch(`${API}/api/home/entities/${encodeURIComponent(id)}`, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({action: "turn_off", data: {}}),
        });
        if (!response.ok) throw new Error();
      }
      setTimeout(load, 400);
    } catch (_) {
      DashboardUI.alert("Some outlets could not be turned off. Check that the power strip is online.");
      button.disabled = false;
    }
  }
  async function musicRequest(path, body){
    const r = await fetch(`${API}/api/home/music-reactive${path}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Music reactive mode failed");
    return r.json();
  }
  async function startMusic(takeOver){
    try {
      musicStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}});
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.65;
      audioContext.createMediaStreamSource(musicStream).connect(analyser);
      music = await musicRequest("/claim", {client_id: clientId, name: clientName, take_over: takeOver});
      animateMusic(); load();
    } catch (error) {
      stopLocalAudio();
      DashboardUI.alert(error.message || "Microphone access is required for music reactive mode.");
      load();
    }
  }
  function animateMusic(){
    if (!analyser) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const tick = now => {
      if (!analyser) return;
      analyser.getByteFrequencyData(bins);
      const bass = bins.slice(1, 12).reduce((sum, value) => sum + value, 0) / (11 * 255);
      const energy = bins.slice(1, 80).reduce((sum, value) => sum + value, 0) / (79 * 255);
      smoothedLevel = smoothedLevel * 0.72 + energy * 0.28;
      const beat = bass > Math.max(0.19, lastBass * 1.32);
      lastBass = lastBass * 0.84 + bass * 0.16;
      if (beat) musicHue = (musicHue + 37) % 360;
      if (now - lastMusicSend > 300) {
        lastMusicSend = now;
        musicRequest("/level", {client_id: clientId, level: smoothedLevel, beat, hue: musicHue})
          .catch(() => { stopLocalAudio(); load(); });
      }
      musicFrame = requestAnimationFrame(tick);
    };
    musicFrame = requestAnimationFrame(tick);
  }
  function stopLocalAudio(){
    if (musicFrame) cancelAnimationFrame(musicFrame);
    musicFrame = null;
    musicStream?.getTracks().forEach(track => track.stop());
    musicStream = null; analyser = null;
    audioContext?.close(); audioContext = null;
  }
  async function stopMusic(force = false){
    stopLocalAudio();
    try { music = await musicRequest("/stop", {client_id: clientId, take_over: force}); }
    catch (error) { DashboardUI.alert(error.message || "Could not stop music reactive mode."); }
    load();
  }
  async function load(){
    try {
      const c = await fetch(`${API}/api/home/config`, {cache:"no-store"});
      config = await c.json();
      if (!config.configured) return renderNotice("Set up your home", "Add the Home Assistant entity IDs in alerts/config.yaml.");
      if (!config.enabled) return renderNotice("No home provider is connected", "Configure a local device in alerts/config.local.yaml or start the optional Home Assistant service.");
      const [r, musicResponse] = await Promise.all([fetch(`${API}/api/home/states`, {cache:"no-store"}), fetch(`${API}/api/home/music-reactive`, {cache:"no-store"})]);
      if (!r.ok) throw new Error();
      music = musicResponse.ok ? await musicResponse.json() : null;
      const states = await r.json();
      if (homeMode === "dashboard" && document.getElementById("lifeDashboard")) {
        lastStates = states;
        mountLifeDashboard(states);
      } else if (homeMode === "floorplan" && document.getElementById("dioramaMount")) {
        lastStates = states;
        mountDiorama(states);
      } else render(states);
    } catch (_) { renderNotice("Home unavailable", "Home Dashboard could not reach Home Assistant."); }
  }
  window.addEventListener("pagehide", () => {
    if (music?.active && music.owner?.id === clientId) {
      navigator.sendBeacon(`${API}/api/home/music-reactive/stop`, new Blob([JSON.stringify({client_id: clientId})], {type: "application/json"}));
    }
    stopLocalAudio();
  });
  setInterval(() => {
    if (view.classList.contains("show")) load();
  }, 5000);
  window.HomeDashboard = {load, setMode(mode){
    homeMode = mode;
    localStorage.setItem('homeDashboardHomeMode', mode);
    if (config) render(lastStates);
  }};
  load();
})();
