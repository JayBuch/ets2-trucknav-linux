#!/bin/bash
# Single-command launcher for ETS2/ATS + TruckNav-Sim on Linux.
#
# Assumes you have cloned the three original projects side-by-side with
# this repo:
#
#   ets2-telemetry-udp/
#   telemetry-bridge-node/
#   TruckNav-Sim/
#   ets2-trucknav-linux/   <- this repo
#
# If your directories are named differently, set the variables below.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

TRUCKNAV_DIR="${TRUCKNAV_DIR:-${SCRIPT_DIR}/../TruckNav-Sim}"
BRIDGE_DIR="${BRIDGE_DIR:-${SCRIPT_DIR}/../telemetry-bridge-node}"

cd "${TRUCKNAV_DIR}/server"
node telemetry-bridge.mjs &
TRUCKNAV_PID=$!

cd "${BRIDGE_DIR}"
node bridge.mjs &
BRIDGE_PID=$!

echo "[Launcher] TruckNav relay PID ${TRUCKNAV_PID}, bridge PID ${BRIDGE_PID}"
echo "[Launcher] Press Ctrl+C to stop both."

wait ${TRUCKNAV_PID} ${BRIDGE_PID}
