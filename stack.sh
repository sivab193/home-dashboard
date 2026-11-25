#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# CCTV and its computer-vision alerts are deliberately opt-in. They run on a
# dedicated host, not on this home-control dashboard machine.
ALL=(dashboard home homeassistant)
HOST_HOME=false
if [ "$(uname -s)" = "Darwin" ]; then HOST_HOME=true; fi

# The dashboard and home bridge run natively on macOS. Docker is loaded lazily
# only for Home Assistant, CCTV, or camera alerts.
CONTAINER_ENGINE="${CONTAINER_ENGINE:-docker}"

compose() {
  if ! command -v "$CONTAINER_ENGINE" >/dev/null 2>&1; then
    echo "$CONTAINER_ENGINE is required for container services" >&2
    return 1
  fi
  "$CONTAINER_ENGINE" compose "$@"
}

usage() {
  cat <<'EOF'
Usage:
  ./stack.sh start [service ...]    default: dashboard home
  ./stack.sh stop [service ...]
  ./stack.sh restart [service ...]
  ./stack.sh logs [service ...]
  ./stack.sh status
  ./stack.sh down

Services: dashboard home homeassistant cctv alerts all

On macOS, dashboard and home are native services. Docker is needed only for
homeassistant, cctv, and alerts.

`all` starts dashboard, home, and Home Assistant. Start `cctv` and `alerts`
explicitly only on the machine assigned to camera processing.
EOF
}

prepare() {
  mkdir -p data/home data/alerts data/homeassistant .runtime
  if [ ! -f alerts/config.local.yaml ]; then
    printf '# Per-house devices. See config.local.example.yaml for a complete example.\nsmarteefi:\n  strips: []\n' > alerts/config.local.yaml
    echo "Created empty alerts/config.local.yaml — add this house's devices when ready."
  fi
  if [ ! -f data/homeassistant/configuration.yaml ]; then
    printf 'default_config:\n' > data/homeassistant/configuration.yaml
  fi
}

home_log_file="data/home/home.log"
home_launch_label="com.home-dashboard.home"
dashboard_log_file="data/dashboard/dashboard.log"
dashboard_launch_label="com.home-dashboard.dashboard"

dashboard_loaded() {
  launchctl print "gui/$(id -u)/$dashboard_launch_label" >/dev/null 2>&1
}

dashboard_running() {
  dashboard_loaded && curl -fsS http://127.0.0.1:1984/ >/dev/null 2>&1
}

start_host_dashboard() {
  if dashboard_running; then
    echo "Dashboard already running."
    return
  fi
  mkdir -p data/dashboard
  launchctl remove "$dashboard_launch_label" >/dev/null 2>&1 || true
  launchctl submit -l "$dashboard_launch_label" -o /dev/null -e /dev/null -- \
    "$PWD/scripts/run-dashboard-host.sh"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:1984/ >/dev/null 2>&1; then
      echo "Dashboard started."
      return
    fi
    sleep 1
  done
  echo "Dashboard did not become ready; see $dashboard_log_file" >&2
  return 1
}

stop_host_dashboard() {
  if ! dashboard_loaded; then
    echo "Dashboard is not running."
    return
  fi
  launchctl remove "$dashboard_launch_label"
  for _ in 1 2 3 4 5; do
    if ! dashboard_loaded && ! curl -fsS http://127.0.0.1:1984/ >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo "Dashboard stopped."
}

home_loaded() {
  launchctl print "gui/$(id -u)/$home_launch_label" >/dev/null 2>&1
}

home_running() {
  home_loaded && curl -fsS http://127.0.0.1:8090/api/home/config >/dev/null 2>&1
}

start_host_home() {
  if home_running; then
    echo "Home bridge already running."
    return
  fi
  venv_created=false
  if [ ! -x alerts/.venv/bin/python ]; then
    python3 -m venv alerts/.venv
    venv_created=true
  fi
  requirements_hash="$(shasum -a 256 alerts/requirements-home.txt | awk '{print $1}')"
  if $venv_created; then
    installed_hash=""
  else
    installed_hash="$(cat .runtime/home-requirements.sha256 2>/dev/null || true)"
  fi
  if [ "$requirements_hash" != "$installed_hash" ]; then
    if command -v uv >/dev/null 2>&1; then
      uv pip install --python alerts/.venv/bin/python -r alerts/requirements-home.txt
    else
      alerts/.venv/bin/python -m pip install -r alerts/requirements-home.txt
    fi
    printf '%s\n' "$requirements_hash" > .runtime/home-requirements.sha256
  fi
  launchctl remove "$home_launch_label" >/dev/null 2>&1 || true
  launchctl submit -l "$home_launch_label" -o /dev/null -e /dev/null -- \
    "$PWD/scripts/run-home-host.sh"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:8090/api/home/config >/dev/null 2>&1; then
      echo "Home bridge started."
      return
    fi
    sleep 1
  done
  echo "Home bridge did not become ready; see $home_log_file" >&2
  return 1
}

stop_host_home() {
  if ! home_loaded; then
    echo "Home bridge is not running."
    return
  fi
  launchctl remove "$home_launch_label"
  for _ in 1 2 3 4 5; do
    if ! home_loaded && ! curl -fsS http://127.0.0.1:8090/api/home/config >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo "Home bridge stopped."
}

services() {
  if [ "$#" -eq 0 ]; then
    printf '%s\n' dashboard home
  elif [ "$1" = "all" ]; then
    printf '%s\n' "${ALL[@]}"
  else
    printf '%s\n' "$@"
  fi
}

command="${1:-}"
if [ -z "$command" ]; then usage; exit 2; fi
shift || true
mapfile_supported=false
if help mapfile >/dev/null 2>&1; then mapfile_supported=true; fi
if $mapfile_supported; then
  mapfile -t selected < <(services "$@")
else
  selected=($(services "$@"))
fi

container_selected=()
home_selected=false
dashboard_selected=false
for service in "${selected[@]}"; do
  if $HOST_HOME && [ "$service" = "dashboard" ]; then
    dashboard_selected=true
  elif $HOST_HOME && [ "$service" = "home" ]; then
    home_selected=true
  else
    container_selected+=("$service")
  fi
done

case "$command" in
  start)
    prepare
    if [ "${#container_selected[@]}" -gt 0 ]; then
      compose up -d --build "${container_selected[@]}"
    fi
    if $dashboard_selected; then start_host_dashboard; fi
    if $home_selected; then
      start_host_home
    fi
    ;;
  stop)
    if [ "${#container_selected[@]}" -gt 0 ]; then compose stop "${container_selected[@]}"; fi
    if $dashboard_selected; then stop_host_dashboard; fi
    if $home_selected; then stop_host_home; fi
    ;;
  restart)
    prepare
    if [ "${#container_selected[@]}" -gt 0 ]; then
      compose up -d --build --force-recreate "${container_selected[@]}"
    fi
    if $dashboard_selected; then stop_host_dashboard; start_host_dashboard; fi
    if $home_selected; then
      stop_host_home
      start_host_home
    fi
    ;;
  logs)
    if $dashboard_selected && ! $home_selected && [ "${#container_selected[@]}" -eq 0 ]; then
      tail -n 100 -f "$dashboard_log_file"
    elif $home_selected && ! $dashboard_selected && [ "${#container_selected[@]}" -eq 0 ]; then
      tail -n 100 -f "$home_log_file"
    elif $dashboard_selected || $home_selected; then
      if $dashboard_selected; then tail -n 100 "$dashboard_log_file"; fi
      if $home_selected; then tail -n 100 "$home_log_file"; fi
    fi
    if [ "${#container_selected[@]}" -gt 0 ]; then
      compose logs -f --tail=100 "${container_selected[@]}"
    fi
    ;;
  status)
    if command -v "$CONTAINER_ENGINE" >/dev/null 2>&1 && "$CONTAINER_ENGINE" info >/dev/null 2>&1; then
      compose ps -a
    else
      echo "container engine: stopped"
    fi
    if $HOST_HOME; then
      if dashboard_running; then
        echo "dashboard (host Caddy): running"
      else
        echo "dashboard (host Caddy): stopped"
      fi
      if home_running; then
        echo "home (host bridge): running"
      else
        echo "home (host bridge): stopped"
      fi
    fi
    ;;
  down)
    if $HOST_HOME; then
      stop_host_dashboard
      stop_host_home
    fi
    if command -v "$CONTAINER_ENGINE" >/dev/null 2>&1 && "$CONTAINER_ENGINE" info >/dev/null 2>&1; then
      compose down
    fi
    ;;
  *) usage; exit 2 ;;
esac
