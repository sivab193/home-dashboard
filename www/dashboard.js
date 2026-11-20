const STORAGE_KEY = "homeDashboardV1";
const WIDGETS = {
  weather: "Weather",
  calendar: "Calendar",
  clocks: "World clocks",
  devices: "Favorite devices",
  music: "YouTube Music",
  home: "Home status",
  stocks: "Stocks",
};
const CLOCK_OPTIONS = [
  
  
  ["America/Phoenix", "Phoenix"],
  ["America/Los_Angeles", "San Francisco"],
  ["America/Chicago", "Texas"],
  ["Europe/London", "London"],
  ["Asia/Dubai", "Dubai"],
  ["Asia/Singapore", "Singapore"],
  ["Australia/Sydney", "Sydney"],
  ["America/New_York", "New York"],
];
const DEFAULTS = {
  order: ["weather", "calendar", "clocks", "stocks", "devices", "music", "home"],
  stockSymbols: ['AAPL','NVDA','V','GOOG','META','TSLA'],
  hidden: [],
  weatherLocations: [
    {name: "West Lafayette", latitude: 40.4259, longitude: -86.9081},
  ],
  clocks: ["America/New_York", "Europe/London", "Asia/Singapore"],
  favoriteDeviceIds: [],
  sizes: {weather:"wide", calendar:"wide", clocks:"compact", stocks:"compact", devices:"wide", music:"compact", home:"compact"},
};
const sessions = new WeakMap();

const esc = value => String(value ?? "").replace(/[&<>'"]/g, character =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"})[character]);

function icon(name){
  const paths = {
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.36.72.6 1 .3.3.7.43 1.1.4H21v4h-.09a1.7 1.7 0 0 0-1.51.6Z"/>',
    weather: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.4 4.8 4.8 0 0 0 7 18Z"/><path d="M8.5 5.2A4.5 4.5 0 0 1 17 7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    devices: '<path d="M8 3h8v8a4 4 0 0 1-8 0V3Z"/><path d="M10 7h4M12 15v6"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
    play: '<path d="m9 7 8 5-8 5V7Z"/>',
    pause: '<path d="M9 7v10M15 7v10"/>',
    previous: '<path d="M6 6v12M18 7l-8 5 8 5V7Z"/>',
    next: '<path d="M18 6v12M6 7l8 5-8 5V7Z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v5h14v-5"/>',
    move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    resize: '<path d="M8 20 20 8M14 20l6-6"/>',
    stocks: '<path d="M3 17 8 12l4 3 9-11M15 4h6v6"/>',
  };
  return `<svg class="dash-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.home}</svg>`;
}

function loadConfig(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const weatherLocations = Array.isArray(saved.weatherLocations) && saved.weatherLocations.length ? saved.weatherLocations.slice(0, 1) : DEFAULTS.weatherLocations;
    const order = [...new Set([...(Array.isArray(saved.order) ? saved.order : DEFAULTS.order), ...DEFAULTS.order])].filter(id => WIDGETS[id]);
    return {...DEFAULTS, ...saved, order, weatherLocations, sizes:{...DEFAULTS.sizes, ...(saved.sizes || {})}};
  } catch (_) { return structuredClone(DEFAULTS); }
}
function saveConfig(config){ localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
function widgetFrame(id, title, body, size){
  return `<article class="dash-widget dash-${id}" data-widget="${id}" data-size="${esc(size || "compact")}">
    <header><span class="dash-widget-icon">${icon(id === "clocks" ? "clock" : id)}</span><h2>${esc(title)}</h2></header>
    <div class="dash-widget-body">${body}</div>
    <button class="widget-drag" aria-label="Move ${esc(title)}" title="Drag to reorder; arrow keys also work">${icon('move')}</button><button class="widget-resize" aria-label="Resize ${esc(title)}" title="Drag to resize; arrow keys also work">${icon('resize')}</button>
  </article>`;
}

function shell(session){
  const widgets = session.config.order.filter(id => WIDGETS[id] && !session.config.hidden.includes(id));
  session.host.innerHTML = `<div class="dash-intro"><button class="dash-customize" id="dashCustomize">${icon("settings")} Customize</button></div>
    <div class="dash-grid" id="dashGrid">${widgets.map(id => widgetFrame(id, WIDGETS[id], '<p class="dash-muted">Loading…</p>', session.config.sizes[id])).join("")}</div>
    ${settingsDialog(session)}`;
  bind(session);
  bindLayout(session);
  renderAll(session);
}

function bindLayout(session){
  const grid = session.host.querySelector('#dashGrid');
  session.layoutObserver?.disconnect();
  const columns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  session.layoutObserver = new ResizeObserver(() => {
    for (const card of grid.children) {
      const saved = session.config.dimensions?.[card.dataset.widget];
      if (saved) card.style.gridColumn = `span ${Math.min(columns(), saved.width)}`;
    }
  });
  session.layoutObserver.observe(grid);
  session.config.dimensions ||= {};
  const persist = () => saveConfig(session.config);
  for (const card of grid.children) {
    const id = card.dataset.widget;
    const apply = (width, height) => {
      card.style.gridColumn = `span ${Math.min(columns(),width)}`;
      card.style.height = `${height}px`;
      card.classList.add('custom-sized');
      session.config.dimensions[id] = {width, height};
    };
    const saved = session.config.dimensions[id];
    if (saved) apply(saved.width, saved.height);
    const resize = card.querySelector('.widget-resize');
    card.querySelector('.widget-drag').onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const earlier = ['ArrowLeft','ArrowUp'].includes(event.key);
      const sibling = earlier ? card.previousElementSibling : card.nextElementSibling;
      if (sibling) grid.insertBefore(card, earlier ? sibling : sibling.nextSibling);
      event.currentTarget.focus();
      const visible = [...grid.children].map(item => item.dataset.widget);
      session.config.order = [...visible, ...session.config.order.filter(item => !visible.includes(item))];
      persist();
    };
    resize.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const current = session.config.dimensions[id] || {width:Math.round(card.offsetWidth / (grid.clientWidth / columns)),height:card.offsetHeight};
      apply(Math.max(1,Math.min(columns,current.width + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))), Math.max(160,current.height + (event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0)));
      persist();
    };
    for (const handle of card.querySelectorAll('.widget-drag,.widget-resize')) {
      handle.onpointerdown = event => {
        event.preventDefault();
        const sizing = handle === resize;
        const initial = card.getBoundingClientRect();
        const x = event.clientX, y = event.clientY;
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        handle.setPointerCapture(event.pointerId);
        card.classList.add('is-editing');
        handle.onpointermove = move => {
          if (sizing) {
            const width = Math.max(1,Math.min(columns,Math.round((initial.width + move.clientX - x) / (grid.clientWidth / columns))));
            apply(width,Math.max(160,Math.round(initial.height + move.clientY-y)));
          } else {
            const target = document.elementFromPoint(move.clientX,move.clientY)?.closest('[data-widget]');
            if (target && target !== card && target.parentNode === grid) {
              const items = [...grid.children];
              grid.insertBefore(card,items.indexOf(card) < items.indexOf(target) ? target.nextSibling : target);
              handle.setPointerCapture(event.pointerId);
            }
          }
        };
        const finish = () => {
          document.removeEventListener('pointerup', finish);
          document.removeEventListener('pointercancel', finish);
          handle.onpointermove = null;
          card.classList.remove('is-editing');
          const visible = [...grid.children].map(item=>item.dataset.widget);
          session.config.order = [...visible,...session.config.order.filter(item=>!visible.includes(item))];
          persist();
        };
        handle.onpointerup = finish;
        handle.onpointercancel = finish;
        document.addEventListener('pointerup', finish, {once:true});
        document.addEventListener('pointercancel', finish, {once:true});
      };
    }
  }
}

function settingsDialog(session){
  const favorites = session.states.filter(item => !item.read_only && ["switch", "light"].includes(item.type));
  return `<dialog class="dash-dialog" id="dashSettings" aria-labelledby="dashSettingsTitle" closedby="any">
    <form id="dashSettingsForm">
      <header><div><h2 id="dashSettingsTitle">Customize dashboard</h2><p>Choose, resize, and arrange every component.</p></div><button type="button" class="dash-icon-button" data-close-settings aria-label="Close customization">×</button></header>
      <section><h3>Widgets</h3><ol class="dash-order" id="dashOrder">${session.config.order.map((id, index) => `<li data-widget-id="${id}"><div class="dash-order-main"><label><input type="checkbox" name="widget" value="${id}" ${session.config.hidden.includes(id) ? "" : "checked"}> ${esc(WIDGETS[id])}</label><span><button type="button" data-move="up" ${index === 0 ? "disabled" : ""} aria-label="Move ${esc(WIDGETS[id])} earlier">↑</button><button type="button" data-move="down" ${index === session.config.order.length - 1 ? "disabled" : ""} aria-label="Move ${esc(WIDGETS[id])} later">↓</button></span></div><fieldset class="dash-size"><legend>Size</legend><div>${[["compact","Compact"],["wide","Wide"],["tall","Tall"],["full","Full"]].map(([value,label]) => `<input class="visually-hidden" type="radio" id="size-${id}-${value}" name="size_${id}" value="${value}" ${session.config.sizes[id] === value ? "checked" : ""}><label for="size-${id}-${value}">${label}</label>`).join("")}</div></fieldset></li>`).join("")}</ol></section>
      <section class="dash-settings-columns"><div><h3>Weather location</h3><label for="dashCityOne">City</label><input id="dashCityOne" name="cityOne" value="${esc(session.config.weatherLocations[0]?.name || "West Lafayette")}" required><button type="button" class="dash-secondary" id="dashUseLocation">Use my location</button><p class="dash-form-status" id="dashLocationStatus" role="status"></p></div>
      <div><h3>World clocks</h3><div class="dash-choice-list">${CLOCK_OPTIONS.map(([zone, label]) => `<label><input type="checkbox" name="clock" value="${zone}" ${session.config.clocks.includes(zone) ? "checked" : ""}> ${esc(label)}</label>`).join("")}</div></div></section>
      <section><h3>Favorite devices</h3><div class="dash-choice-list dash-device-choices">${favorites.map(device => `<label><input type="checkbox" name="favorite" value="${esc(device.id)}" ${session.favoriteIds.includes(device.id) ? "checked" : ""}> <span>${esc(device.name)}<small>${esc(device.room)}</small></span></label>`).join("") || '<p class="dash-muted">No controllable devices are available.</p>'}</div></section>
      <section><h3>Stocks watchlist</h3><label for="dashStockSymbols">Ticker symbols</label><input id="dashStockSymbols" name="stockSymbols" value="${esc(session.config.stockSymbols.join(', '))}" maxlength="135" required aria-describedby="dashStockHelp"><p id="dashStockHelp" class="dash-muted">Up to 8 symbols, separated by commas. Quotes refresh every 5 minutes and may be delayed.</p><p id="dashStockError" role="status"></p></section>
      <footer><button type="button" class="dash-secondary" data-close-settings>Cancel</button><button type="submit" class="dash-primary">Save dashboard</button></footer>
    </form></dialog>`;
}

function bind(session){
  const host = session.host;
  host.querySelector("#dashCustomize").onclick = () => {
    host.querySelector('#dashSettings').outerHTML = settingsDialog(session);
    bind(session);
    host.querySelector("#dashSettings").showModal();
  };
  host.querySelectorAll("[data-close-settings]").forEach(button => button.onclick = () => host.querySelector("#dashSettings").close());
  host.querySelector("#dashOrder").onclick = event => moveWidget(event, host);
  host.querySelector("#dashUseLocation").onclick = () => useLocation(session);
  host.querySelector("#dashSettingsForm").onsubmit = event => saveSettings(event, session);
  host.onclick = event => handleDashboardAction(event, session);
}

function moveWidget(event, host){
  const button = event.target.closest("button[data-move]");
  if (!button) return;
  const item = button.closest("li");
  const sibling = button.dataset.move === "up" ? item.previousElementSibling : item.nextElementSibling;
  if (!sibling) return;
  if (button.dataset.move === "up") item.parentNode.insertBefore(item, sibling);
  else item.parentNode.insertBefore(sibling, item);
  [...item.parentNode.children].forEach((row, index, all) => {
    row.querySelector('[data-move="up"]').disabled = index === 0;
    row.querySelector('[data-move="down"]').disabled = index === all.length - 1;
  });
}

async function saveSettings(event, session){
  event.preventDefault();
  const form = event.currentTarget;
  const stockSymbols = [...new Set(form.elements.stockSymbols.value.toUpperCase().split(',').map(s => s.trim()).filter(Boolean))];
  if (!stockSymbols.length || stockSymbols.length > 8 || stockSymbols.some(s => !/^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/.test(s))) {
    session.host.querySelector('#dashStockError').textContent = 'Enter 1–8 valid ticker symbols, separated by commas.';
    form.elements.stockSymbols.focus(); return;
  }
  const cities = [form.elements.cityOne.value.trim()];
  const status = session.host.querySelector("#dashLocationStatus");
  status.textContent = "Finding cities…";
  let weatherLocations;
  try {
    weatherLocations = await Promise.all(cities.map(async (city, index) => {
      const current = session.config.weatherLocations[index];
      if (current && city === current.name) return current;
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      const match = (await response.json()).results?.[0];
      if (!match) throw new Error(`${city} was not found`);
      return {name: match.name, latitude: match.latitude, longitude: match.longitude};
    }));
  } catch (error) { status.textContent = error.message || "Could not find those cities."; return; }
  const checkedWidgets = new Set([...form.querySelectorAll('input[name="widget"]:checked')].map(input => input.value));
  session.config = {
    ...session.config,
    stockSymbols,
    order: [...form.querySelectorAll("#dashOrder li")].map(item => item.dataset.widgetId),
    hidden: Object.keys(WIDGETS).filter(id => !checkedWidgets.has(id)),
    clocks: [...form.querySelectorAll('input[name="clock"]:checked')].map(input => input.value).slice(0, 6),
    favoriteDeviceIds: [...form.querySelectorAll('input[name="favorite"]:checked')].map(input => input.value).slice(0, 8),
    sizes: Object.fromEntries(Object.keys(WIDGETS).map(id => [id, form.elements[`size_${id}`]?.value || DEFAULTS.sizes[id]])),
    dimensions: Object.fromEntries(Object.entries(session.config.dimensions || {}).filter(([id]) => form.elements[`size_${id}`]?.value === session.config.sizes[id])),
    weatherLocations,
  };
  saveConfig(session.config);
  session.favoriteIds = session.config.favoriteDeviceIds;
  session.weather = null;
  session.host.querySelector("#dashSettings").close();
  shell(session);
}

function useLocation(session){
  const status = session.host.querySelector("#dashLocationStatus");
  if (!navigator.geolocation) { status.textContent = "Location is not supported by this browser."; return; }
  status.textContent = "Waiting for location permission…";
  navigator.geolocation.getCurrentPosition(position => {
    session.config.weatherLocations[0] = {name: "Current location", latitude: position.coords.latitude, longitude: position.coords.longitude};
    session.host.querySelector("#dashCityOne").value = "Current location";
    status.textContent = "Location ready. Save to apply it.";
  }, () => { status.textContent = "Location permission was not granted. Search by city instead."; }, {timeout: 10000, maximumAge: 3600000});
}

async function handleDashboardAction(event, session){
  const button = event.target.closest("button, a"); if (!button) return;
  if (button.dataset.calendarView) await setCalendarView(button.dataset.calendarView, session);
  if (button.dataset.deviceId) await toggleDevice(button, session);
  if (button.dataset.musicAction) await musicCommand(button.dataset.musicAction, session);
}

function renderAll(session){
  renderWeather(session); renderCalendar(session); renderClocks(session);
  renderDevices(session); renderMusic(session); renderHomeStatus(session); renderStocks(session);
}

const weatherText = code => code === 0 ? "Clear" : code <= 3 ? "Partly cloudy" : code <= 48 ? "Foggy" : code <= 67 ? "Rain" : code <= 77 ? "Snow" : code <= 82 ? "Showers" : "Thunderstorms";
const toCelsius = fahrenheit => Math.round((fahrenheit - 32) * 5 / 9);
async function renderWeather(session){
  const widget = session.host.querySelector('[data-widget="weather"]'); if (!widget) return;
  if (!session.weather || Date.now() - session.weatherAt > 15 * 60 * 1000) {
    try {
      session.weather = await Promise.all(session.config.weatherLocations.slice(0, 1).map(async location => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5`;
        const response = await fetch(url); if (!response.ok) throw new Error();
        return {location, data: await response.json()};
      }));
      session.weatherAt = Date.now();
    } catch (_) {
      widget.querySelector(".dash-widget-body").innerHTML = '<p class="dash-empty">Weather is temporarily unavailable. Your home controls still work.</p>'; return;
    }
  }
  widget.querySelector(".dash-widget-body").innerHTML = `<div class="weather-locations">${session.weather.map(({location, data}) => { const current = data.current; const daily = data.daily; const currentF = Math.round(current.temperature_2m); const currentC = toCelsius(currentF); const feelsF = Math.round(current.apparent_temperature); const feelsC = toCelsius(feelsF); return `<section><div class="weather-now"><div><p class="weather-place">${esc(location.name)}</p><strong>${currentF}°F <small>${currentC}°C</small></strong><span>${esc(weatherText(current.weather_code))}</span></div><dl><div><dt>Feels</dt><dd>${feelsF}°F / ${feelsC}°C</dd></div><div><dt>Wind</dt><dd>${Math.round(current.wind_speed_10m)} mph</dd></div></dl></div><div class="weather-days">${daily.time.slice(0, 5).map((date, index) => { const highF = Math.round(daily.temperature_2m_max[index]); const lowF = Math.round(daily.temperature_2m_min[index]); return `<div><span>${new Intl.DateTimeFormat(undefined,{weekday:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`))}</span><strong>${highF}°F / ${toCelsius(highF)}°C</strong><small>${lowF}°F / ${toCelsius(lowF)}°C</small></div>`; }).join("")}</div></section>`; }).join("")}</div>`;
}

async function renderCalendar(session){
  const widget = session.host.querySelector('[data-widget="calendar"]'); if (!widget) return;
  if (!session.calendar || Date.now() - session.calendarAt > 60000) {
    try { const response = await fetch(`${session.api}/api/dashboard/calendar`, {cache:"no-store"}); session.calendar = response.ok ? await response.json() : {configured:false,events:[],notifications:[],unread:0}; }
    catch (_) { session.calendar = {configured:false,events:[],notifications:[],unread:0}; }
    session.calendarAt = Date.now();
  }
  const now = new Date();
  const allEvents = session.calendar.events || [];
  const upcoming = allEvents.filter(event => new Date(event.start).getTime() >= now.getTime() - 3600000).sort((a,b) => new Date(a.start) - new Date(b.start)).slice(0, 5);
  const year = now.getFullYear(); const month = now.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventDays = new Set(allEvents.map(event => new Date(event.start)).filter(date => date.getFullYear() === year && date.getMonth() === month).map(date => date.getDate()));
  const calendarCells = `${'<span class="calendar-blank" aria-hidden="true"></span>'.repeat(firstWeekday)}${Array.from({length:daysInMonth}, (_, index) => { const day = index + 1; const today = day === now.getDate(); return `<span class="calendar-day${today ? " is-today" : ""}${eventDays.has(day) ? " has-event" : ""}" ${today ? 'aria-current="date"' : ""}>${day}</span>`; }).join("")}`;
  widget.querySelector("header").innerHTML = `<span class="dash-widget-icon">${icon("calendar")}</span><h2>Calendar</h2>${session.calendar.last_sync ? `<span class="calendar-synced">Synced ${new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(session.calendar.last_sync))}</span>` : ""}`;
  const emptyMessage = session.calendar.configured ? (session.calendar.error ? "The calendar feed could not refresh. Previously synced events remain available." : "No upcoming events in the subscribed calendar.") : "Calendar feed not configured. Add CALENDAR_ICS_URL to .env, then restart the home service.";
  const upcomingMarkup = upcoming.length ? `<ol class="upcoming-list">${upcoming.map(event => { const date = new Date(event.start); return `<li><time datetime="${esc(event.start)}"><strong>${new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(date)}</strong><span>${new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(date)}</span></time><div><strong>${esc(event.title)}</strong><span>${esc(event.location || event.calendar || "Calendar")}</span></div></li>`; }).join("")}</ol>` : `<p class="dash-empty">${esc(emptyMessage)}</p>`;
  const monthLabel = new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(now);
  const unread = session.calendar.unread || 0;
  const tabs = `<div class="calendar-tabs" role="tablist" aria-label="Calendar views"><button role="tab" data-calendar-view="schedule" aria-selected="${session.calendarView !== "updates"}">Schedule</button><button role="tab" data-calendar-view="updates" aria-selected="${session.calendarView === "updates"}">Updates${unread ? `<span>${unread}</span>` : ""}</button></div>`;
  const notifications = session.calendar.notifications || [];
  const updatesMarkup = notifications.length ? `<ol class="calendar-notifications">${notifications.map(item => { const start = new Date(item.start); return `<li class="${item.read ? "" : "is-unread"}"><span>${item.kind === "new" ? "New" : "Updated"}</span><div><strong>${esc(item.title)}</strong><small>${new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(start)}</small></div></li>`; }).join("")}</ol>` : '<p class="dash-empty">No calendar updates yet. New or changed feed events will appear here after a sync.</p>';
  const schedule = `<div class="calendar-layout"><section class="month-calendar" aria-label="${esc(monthLabel)}"><h3>${esc(monthLabel)}</h3><div class="calendar-weekdays" aria-hidden="true">${["S","M","T","W","T","F","S"].map(day => `<span>${day}</span>`).join("")}</div><div class="calendar-days">${calendarCells}</div></section><section class="calendar-upcoming"><h3>Upcoming</h3>${upcomingMarkup}</section></div>`;
  widget.querySelector(".dash-widget-body").innerHTML = `${tabs}${session.calendarView === "updates" ? updatesMarkup : schedule}`;
}

async function setCalendarView(view, session){
  session.calendarView = view === "updates" ? "updates" : "schedule";
  if (session.calendarView === "updates" && session.calendar?.unread) {
    try {
      await fetch(`${session.api}/api/dashboard/calendar/read`, {method:"POST"});
      session.calendar.unread = 0;
      session.calendar.notifications = (session.calendar.notifications || []).map(item => ({...item, read:true}));
    } catch (_) { /* Reading the list still works if acknowledgement fails. */ }
  }
  renderCalendar(session);
}

function renderClocks(session){
  const widget = session.host.querySelector('[data-widget="clocks"]'); if (!widget) return;
  const paint = () => {
    if (!widget.isConnected) { clearInterval(session.clockTimer); return; }
    const now = new Date();
    widget.querySelector(".dash-widget-body").innerHTML = `<div class="analog-clocks">${session.config.clocks.map(zone => {
      const label = CLOCK_OPTIONS.find(item => item[0] === zone)?.[1] || zone;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23',timeZone:zone}).formatToParts(now).map(p=>[p.type,p.value]));
      const hour = +parts.hour, minute = +parts.minute, second = +parts.second;
      const time = new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZone:zone}).format(now);
      const zonedDate = target => new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:target}).formatToParts(now).filter(p=>p.type!=='literal').reduce((out,p)=>(out[p.type]=+p.value,out),{});
      const dayNumber = target => { const d = zonedDate(target); return Date.UTC(d.year,d.month-1,d.day)/86400000; };
      const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const delta = dayNumber(zone)-dayNumber(localZone);
      const day = delta > 0 ? 'Tomorrow' : delta < 0 ? 'Yesterday' : 'Today';
      const offset = target => {const p = new Intl.DateTimeFormat('en-US',{timeZone:target,timeZoneName:'longOffset'}).formatToParts(now).find(p=>p.type==='timeZoneName').value; const m=p.match(/GMT([+-])(\d{2}):(\d{2})/); return m ? (m[1]==='-'?-1:1)*(+m[2]*60 + +m[3]) : 0;};
      const difference = offset(zone)-offset(localZone);
      const relative = difference===0 ? 'Local time' : `${difference>0?'+':'−'}${Math.floor(Math.abs(difference)/60)}${Math.abs(difference)%60 ? ':'+String(Math.abs(difference)%60).padStart(2,'0') : ''} hrs`;
      const numbers = Array.from({length:12},(_,i)=>{const n=i+1,a=n*Math.PI/6;return `<text x="${50+37*Math.sin(a)}" y="${53-37*Math.cos(a)}">${n}</text>`;}).join('');
      return `<div class="analog-clock ${hour<6||hour>=18?'night':'day'}" title="${esc(time)}"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(label+' '+time+', '+day)}"><circle cx="50" cy="50" r="49"/>${numbers}<path class="hour-hand" d="M50 52V27" transform="rotate(${hour*30+minute/2} 50 50)"/><path class="minute-hand" d="M50 54V14" transform="rotate(${minute*6} 50 50)"/><path class="second-hand" d="M50 58V12" transform="rotate(${second*6} 50 50)"/></svg><strong>${esc(label)}</strong><small>${day}</small><small>${relative}</small></div>`;
    }).join('')}</div>`;
  };
  paint(); clearInterval(session.clockTimer); session.clockTimer = setInterval(paint, 1000);
}

async function renderStocks(session){
  const widget = session.host.querySelector('[data-widget="stocks"]'); if (!widget) return;
  session.stocksAt = Date.now();
  const body = widget.querySelector('.dash-widget-body');
  try {
    const response = await fetch(`${session.api}/api/dashboard/stocks?symbols=${encodeURIComponent(session.config.stockSymbols.join(','))}`, {signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error();
    const data = await response.json();
    body.innerHTML = `<ul class="stock-list">${data.quotes.map(q => {
      if (!q.available) return `<li class="stock-row"><div><strong>${esc(q.symbol)}</strong><small>Quote unavailable</small></div><span class="stock-unavailable">—</span></li>`;
      const up = q.change >= 0;
      const finite = q.points.filter(Number.isFinite);
      const low = Math.min(q.previous,...finite), high = Math.max(q.previous,...finite);
      const y = value => 33-(value-low)/(high-low || 1)*28;
      let connected = false;
      const path = q.points.map((p,i)=>{if (!Number.isFinite(p)) {connected=false;return ''; } const cmd=connected?'L':'M'; connected=true;return `${cmd}${(i/Math.max(q.points.length-1,1)*88+1).toFixed(1)},${y(p).toFixed(1)}`;}).join(' ');
      const price = new Intl.NumberFormat(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}).format(q.price);
      const asOf = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(q.timestamp*1000));
      return `<li class="stock-row ${up?'stock-up':'stock-down'}"><div class="stock-identity"><a href="https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/" target="_blank" rel="noopener"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="${up?'M0 9 5 1 10 9Z':'M0 1 5 9 10 1Z'}"/></svg>${esc(q.symbol)}</a><small>${esc(q.name)}</small></div><svg class="stock-sparkline" viewBox="0 0 90 38" role="img" aria-label="${esc(q.symbol)} intraday price trend"><path class="stock-baseline" d="M0 ${y(q.previous)}H90"/><path d="${path}"/></svg><div class="stock-price"><strong>${price}</strong><span>${q.change>=0?'+':''}${q.change.toFixed(2)}</span><small>${esc(q.currency)}</small></div><time class="stock-time" datetime="${new Date(q.timestamp*1000).toISOString()}">${q.stale?'Cached · ':''}${esc(asOf)}</time></li>`;
    }).join('')}</ul><p class="stock-source">Yahoo Finance · May be delayed · Refreshes every 5 min</p>`;
  } catch (_) { body.innerHTML = '<p class="dash-empty">Stock quotes are unavailable. We’ll retry in 5 minutes.</p>'; }
}

function renderDevices(session){
  const widget = session.host.querySelector('[data-widget="devices"]'); if (!widget) return;
  const selected = session.favoriteIds.length ? session.states.filter(item => session.favoriteIds.includes(item.id)) : session.states.filter(item => !item.read_only && ["switch","light"].includes(item.type)).slice(0, 6);
  widget.querySelector(".dash-widget-body").innerHTML = selected.length ? `<div class="favorite-devices">${selected.map(device => { const online = !["unavailable","unknown"].includes(device.state); const on = device.state === "on"; return `<button data-device-id="${esc(device.id)}" data-device-action="${on ? "turn_off" : "turn_on"}" class="favorite-device ${on ? "is-on" : ""}" ${online ? "" : "disabled"}><span>${esc(device.name)}</span><small>${esc(device.room)} · ${online ? (on ? "On" : "Off") : "Offline"}</small></button>`; }).join("")}</div>` : '<p class="dash-empty">Choose favorite lights and outlets in Customize.</p>';
}
async function toggleDevice(button, session){
  button.disabled = true;
  try {
    const response = await fetch(`${session.api}/api/home/entities/${encodeURIComponent(button.dataset.deviceId)}`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:button.dataset.deviceAction,data:{}})});
    if (!response.ok) throw new Error();
    setTimeout(() => window.HomeDashboard?.load(), 400);
  } catch (_) { button.disabled = false; DashboardUI.alert("That device could not be changed. Check that it is online."); }
}

async function renderMusic(session){
  const widget = session.host.querySelector('[data-widget="music"]'); if (!widget) return;
  try { const response = await fetch(`${session.api}/api/dashboard/mac/music`, {cache:"no-store"}); session.music = response.ok ? await response.json() : {available:false}; }
  catch (_) { session.music = {available:false}; }
  const music = session.music; const playing = music.state === "playing";
  const setup = music.state === "setup_required";
  const primary = music.title || (music.state === "not_open" ? "Open YouTube Music in Brave" : setup ? "Browser permission needed" : "Nothing playing");
  const secondary = music.artist || (setup ? "Enable JavaScript from Apple Events in Brave" : "YouTube Music · Brave Browser");
  widget.querySelector(".dash-widget-body").innerHTML = `<div class="now-playing"><div><strong>${esc(primary)}</strong><span>${esc(secondary)}</span></div><div class="music-transport"><button data-music-action="previous" aria-label="Previous track" ${music.available ? "" : "disabled"}>${icon("previous")}</button><button data-music-action="play_pause" aria-label="${playing ? "Pause" : "Play"}" ${music.available ? "" : "disabled"}>${icon(playing ? "pause" : "play")}</button><button data-music-action="next" aria-label="Next track" ${music.available ? "" : "disabled"}>${icon("next")}</button></div><a href="https://music.youtube.com/" target="_blank" rel="noopener">${music.state === "not_open" ? "Open" : "View"} YouTube Music ${icon("external")}</a></div>`;
}
async function musicCommand(action, session){
  try { const response = await fetch(`${session.api}/api/dashboard/mac/music`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})}); if (!response.ok) throw new Error(); await renderMusic(session); }
  catch (_) { DashboardUI.alert("YouTube Music could not be controlled. Open it in Brave, then enable View → Developer → Allow JavaScript from Apple Events."); }
}

function renderHomeStatus(session){
  const widget = session.host.querySelector('[data-widget="home"]'); if (!widget) return;
  const online = session.states.filter(item => !["unavailable","unknown"].includes(item.state));
  const on = online.filter(item => item.state === "on");
  const offline = session.states.length - online.length;
  widget.querySelector(".dash-widget-body").innerHTML = `<dl class="home-status-list"><div><dt>Online</dt><dd>${online.length}</dd></div><div><dt>Powered on</dt><dd>${on.length}</dd></div><div><dt>Offline</dt><dd>${offline}</dd></div></dl><a class="dash-text-link" href="/home/controls" data-dashboard-route>Open all controls →</a>`;
  widget.querySelector("[data-dashboard-route]").onclick = event => { event.preventDefault(); window.navigateDashboard("/home/controls"); };
}

export async function mountDashboard(host, states, api){
  let session = sessions.get(host);
  if (session) {
    session.states = states;
    session.favoriteIds = session.config.favoriteDeviceIds.length ? session.config.favoriteDeviceIds : session.favoriteIds;
    renderDevices(session); renderHomeStatus(session);
    if (Date.now() - (session.calendarUiAt || 0) > 60000) { session.calendarUiAt = Date.now(); renderCalendar(session); }
    const musicRefresh = session.music?.available ? 5000 : 60000;
    if (Date.now() - (session.stocksAt || 0) > 300000) renderStocks(session);
    if (Date.now() - (session.musicAt || 0) > musicRefresh) { session.musicAt = Date.now(); renderMusic(session); }
    return;
  }
  const config = loadConfig();
  const defaultFavorites = states.filter(item => !item.read_only && ["switch","light"].includes(item.type)).slice(0, 6).map(item => item.id);
  session = {host, states, api, config, favoriteIds: config.favoriteDeviceIds.length ? config.favoriteDeviceIds : defaultFavorites};
  sessions.set(host, session); shell(session);
}
