import "./vendor/ha-diorama-card.js";

const sessions = new WeakMap();
const safeId = value => String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");

function homeAssistantState(states, api){
  const hassStates = {};
  const entities = {};
  const devices = {};
  const areas = {};
  for (const item of states) {
    const area = safeId(item.room || "home") || "home";
    const deviceId = safeId(item.device_id || item.id);
    const domain = item.type === "light" ? "light" : item.type === "fan" ? "fan" : "switch";
    const entityId = `${domain}.${safeId(item.id)}`;
    areas[area] ||= {area_id: area, name: item.room || "Home", floor_id: null, icon: null};
    devices[deviceId] ||= {id: deviceId, area_id: area, name: item.device_name || item.name};
    entities[entityId] = {entity_id: entityId, device_id: deviceId, area_id: area, name: item.name, platform: item.provider};
    hassStates[entityId] = {
      entity_id: entityId,
      state: item.state,
      attributes: {...(item.attributes || {}), friendly_name: item.name, dashboard_id: item.id},
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };
  }
  return {
    states: hassStates, entities, devices, areas,
    themes: {darkMode: true}, locale: {language: navigator.language || "en"}, language: navigator.language || "en",
    user: {id: "home-dashboard", name: "Home Dashboard"},
    formatEntityState(entity){ return entity.state === "unavailable" ? "Offline" : entity.state === "on" ? "On" : "Off"; },
    async callService(_domain, service, data = {}, target = {}){
      const entityId = data.entity_id || target.entity_id;
      const entity = hassStates[entityId];
      if (!entity) throw new Error("This item is not connected to a dashboard device");
      const action = service === "toggle" ? (entity.state === "on" ? "turn_off" : "turn_on") : service;
      const response = await fetch(`${api}/api/home/entities/${encodeURIComponent(entity.attributes.dashboard_id)}`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({action, data}),
      });
      if (!response.ok) throw new Error("Device control failed");
      return response.json();
    },
  };
}

async function save(api, config, status){
  status.textContent = "Saving layout…";
  const response = await fetch(`${api}/api/home/diorama`, {
    method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "Layout could not be saved");
  status.textContent = "Layout saved for this house";
}

function findOpenEditor(element){
  return [...(element.shadowRoot?.querySelectorAll("button") || [])].find(button => button.textContent?.trim() === "Open editor");
}

export async function mountDiorama(host, states, api){
  let session = sessions.get(host);
  const hass = homeAssistantState(states, api);
  if (session) {
    session.hass = hass;
    session.card.hass = hass;
    if (session.editor) session.editor.hass = hass;
    return;
  }

  const response = await fetch(`${api}/api/home/diorama`, {cache: "no-store"});
  if (!response.ok) throw new Error("The 3D home model is unavailable");
  let config = await response.json();
  const card = document.createElement("diorama-card");
  card.className = "diorama-card-host";
  card.setConfig(config);
  card.hass = hass;
  host.replaceChildren(card);
  const dialog = document.getElementById("dioramaEditorDialog");
  const edit = document.getElementById("dioramaEdit");
  const close = document.getElementById("dioramaEditorClose");
  const status = document.getElementById("dioramaSaveStatus");
  session = {card, hass, editor: null, timer: 0};
  sessions.set(host, session);

  edit.onclick = () => {
    let editor = session.editor;
    if (!editor) {
      editor = document.createElement("diorama-card-editor");
      editor.className = "diorama-editor-host";
      editor.setConfig(config);
      editor.hass = session.hass;
      editor.addEventListener("config-changed", event => {
        config = event.detail.config;
        card.setConfig(config);
        clearTimeout(session.timer);
        session.timer = setTimeout(() => save(api, config, status).catch(error => { status.textContent = error.message; }), 450);
      });
      document.getElementById("dioramaEditorMount").replaceChildren(editor);
      session.editor = editor;
    }
    dialog.showModal();
    status.textContent = "Changes save automatically";
    requestAnimationFrame(() => requestAnimationFrame(() => findOpenEditor(editor)?.click()));
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
}
