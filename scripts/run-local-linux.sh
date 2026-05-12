#!/usr/bin/env bash
set -euo pipefail

MIN_NODE_MAJOR=18
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PORT="${PORT:-8080}"
OPEN_BROWSER=1
INSTALL_NODE="prompt"
CHECK_ONLY=0
VALIDATE_ASSETS=0

usage() {
  cat <<'EOF'
Run Pieczargotchi locally on Linux.

Usage:
  bash scripts/run-local-linux.sh [options]

Options:
  --port PORT            Local preview port. Defaults to $PORT or 8080.
  --install              Install Node.js without asking when it is missing.
  --no-install           Do not install Node.js; fail if it is missing.
  --no-open              Do not open the browser automatically.
  --check-only           Check prerequisites and files, then exit.
  --validate-assets      Run the PNG asset validator before starting.
  -h, --help             Show this help.

Examples:
  bash scripts/run-local-linux.sh
  bash scripts/run-local-linux.sh --install --port 8090
  bash scripts/run-local-linux.sh --check-only --validate-assets
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for --port." >&2
        usage >&2
        exit 2
      fi
      PORT="$2"
      shift 2
      continue
      ;;
    --install)
      INSTALL_NODE="always"
      ;;
    --no-install)
      INSTALL_NODE="never"
      ;;
    --no-open)
      OPEN_BROWSER=0
      ;;
    --check-only)
      CHECK_ONLY=1
      ;;
    --validate-assets)
      VALIDATE_ASSETS=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$PORT" in
  ''|*[!0-9]*)
    echo "Port must be a number, got: ${PORT}" >&2
    exit 2
    ;;
esac

run_as_root() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "This installer needs root privileges, but sudo is not available." >&2
    exit 1
  fi
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi

  node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0
}

has_usable_node() {
  [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ]
}

install_node() {
  echo "Installing Node.js. This may ask for your system password."

  if command -v apt-get >/dev/null 2>&1; then
    run_as_root apt-get update
    run_as_root apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    run_as_root dnf install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    run_as_root yum install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    run_as_root pacman -Sy --needed nodejs npm
  elif command -v zypper >/dev/null 2>&1; then
    run_as_root zypper --non-interactive install nodejs npm
  elif command -v apk >/dev/null 2>&1; then
    run_as_root apk add nodejs npm
  elif command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "Could not find a supported package manager." >&2
    echo "Install Node.js ${MIN_NODE_MAJOR}+ from https://nodejs.org/, then rerun this script." >&2
    exit 1
  fi
}

ensure_node() {
  if has_usable_node; then
    echo "Node.js $(node -v) found."
    return
  fi

  if command -v node >/dev/null 2>&1; then
    echo "Node.js $(node -v) found, but Pieczargotchi expects Node.js ${MIN_NODE_MAJOR}+."
  else
    echo "Node.js is not installed."
  fi

  if [ "$INSTALL_NODE" = "never" ]; then
    echo "Run again with --install, or install Node.js ${MIN_NODE_MAJOR}+ manually." >&2
    exit 1
  fi

  if [ "$INSTALL_NODE" = "prompt" ]; then
    if [ ! -t 0 ]; then
      echo "Run again with --install, or install Node.js ${MIN_NODE_MAJOR}+ manually." >&2
      exit 1
    fi

    read -r -p "Install Node.js with the system package manager now? [y/N] " answer
    case "$answer" in
      y|Y|yes|YES|Yes) ;;
      *)
        echo "Install cancelled."
        exit 1
        ;;
    esac
  fi

  install_node
  hash -r

  if ! has_usable_node; then
    echo "Node.js ${MIN_NODE_MAJOR}+ is still not available after installation." >&2
    echo "Your distribution package may be too old. Install Node.js LTS from https://nodejs.org/." >&2
    exit 1
  fi

  echo "Node.js $(node -v) ready."
}

check_required_files() {
  local missing=()
  local required_files=(
    "dev-server.mjs"
    "Index.html"
    "Styles.html"
    "Client.html"
    "ClientCore.html"
    "ClientBoot.html"
    "ClientDebug.html"
    "ClientRuntime.html"
    "ClientWeather.html"
    "ClientState.html"
    "ClientActions.html"
    "ClientUi.html"
    "ClientAnimation.html"
    "ClientScene.html"
    "ClientScenePalette.html"
    "ClientSceneCelestial.html"
    "ClientSceneWeather.html"
    "ClientSceneLife.html"
    "ClientSceneGround.html"
    "ClientSprites.html"
    "Config.gs"
    "AnimationConfig.gs"
    "StateModel.gs"
    "GameRules.gs"
    "Actions.gs"
    "AssetService.gs"
    "assets/stages/spore/idle_sheet.png"
    "assets/stages/spore/sleep_sheet.png"
    "assets/stages/spore/wake_sheet.png"
  )

  for relative in "${required_files[@]}"; do
    if [ ! -e "${ROOT_DIR}/${relative}" ]; then
      missing+=("$relative")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Missing required local preview files:" >&2
    printf '  - %s\n' "${missing[@]}" >&2
    echo "Restore them from the repository before running the local preview." >&2
    exit 1
  fi
}

validate_assets() {
  if [ "$VALIDATE_ASSETS" -eq 0 ]; then
    return
  fi

  echo "Validating PNG assets..."
  (cd "$ROOT_DIR" && node scripts/validate-assets.mjs)
}

open_browser_later() {
  local url="$1"

  (
    sleep 1
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$url" >/dev/null 2>&1 || true
    elif command -v gio >/dev/null 2>&1; then
      gio open "$url" >/dev/null 2>&1 || true
    elif command -v wslview >/dev/null 2>&1; then
      wslview "$url" >/dev/null 2>&1 || true
    fi
  ) &
}

ensure_node
check_required_files
validate_assets

URL="http://127.0.0.1:${PORT}/"

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "Local preview checks passed. Start URL: ${URL}"
  exit 0
fi

echo "Starting Pieczargotchi local preview at ${URL}"
echo "Press Ctrl+C to stop the server."

if [ "$OPEN_BROWSER" -eq 1 ]; then
  open_browser_later "$URL"
fi

cd "$ROOT_DIR"
exec node dev-server.mjs "$PORT"
