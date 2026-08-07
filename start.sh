#!/bin/bash
set -e

REPO_DIR="$HOME/ets2-ats-trucknav-linux"
BRIDGE_DIR="$REPO_DIR/telemetry-bridge-node"

# Optional: build the plugin if not present
if [ ! -f "$REPO_DIR/ets2-telemetry-udp/build/libets2_telemetry_udp.so" ]; then
    echo "[start.sh] Plugin not built. Building now..."
    cd "$REPO_DIR/ets2-telemetry-udp"
    mkdir -p build
    cd build
    cmake ..
    cmake --build . -j
fi

# Optional: install the plugin if not present in ETS2/ATS
ETS2_PLUGIN_DIR="$HOME/.steam/steam/steamapps/common/Euro Truck Simulator 2/bin/linux_x64/plugins"
ATS_PLUGIN_DIR="$HOME/.steam/steam/steamapps/common/American Truck Simulator/bin/linux_x64/plugins"

for dir in "$ETS2_PLUGIN_DIR" "$ATS_PLUGIN_DIR"; do
    if [ -d "$dir" ] && [ ! -f "$dir/libets2_telemetry_udp.so" ]; then
        echo "[start.sh] Installing plugin to $dir"
        cp "$REPO_DIR/ets2-telemetry-udp/build/libets2_telemetry_udp.so" "$dir/"
    fi
done

# Start the bridge in the background
if [ -f "$BRIDGE_DIR/bridge.mjs" ]; then
    echo "[start.sh] Starting telemetry bridge-node (49001 -> 54950)..."
    (cd "$BRIDGE_DIR" && exec node bridge.mjs) &
    BRIDGE_PID=$!
fi

# Start the relay in the foreground
if [ -f "$REPO_DIR/telemetry-bridge.mjs" ]; then
    echo "[start.sh] Starting telemetry relay (WebSocket 30001/30002, UDP 54950)..."
    (cd "$REPO_DIR" && exec node telemetry-bridge.mjs) &
    RELAY_PID=$!
fi

# Trap Ctrl+C to stop both
cleanup() {
    echo "[start.sh] Stopping relay and bridge..."
    [ -n "${BRIDGE_PID:-}" ] && kill "$BRIDGE_PID" 2>/dev/null || true
    [ -n "${RELAY_PID:-}" ] && kill "$RELAY_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

wait
