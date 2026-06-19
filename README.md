# ETS2/ATS → TruckNav-Sim on Linux

This repository contains the changes and helpers needed to run the TruckNav-Sim web/mobile dashboard with Euro Truck Simulator 2 / American Truck Simulator on Linux, using the official SCS Telemetry SDK. https://github.com/Rares-Muntean/TruckNav-Sim

It provides:
1. A native SCS Telemetry SDK plugin (`ets2-telemetry-udp`) that sends truck data over UDP.
2. A small Node.js bridge (`telemetry-bridge-node`) that converts that data into the TruckNav `TelemetryPacket` format.
3. A patched TruckNav-Sim relay that listens on both `30001` and `30002` so the mobile app can connect over LAN.

---

## What was changed

- Plugin now sends real world position, heading, speed, gear, RPM, fuel amount, fuel consumption, fuel range, fuel warning, game time, rest stop, and navigation distance/time/speed limit.
- Bridge converts the plugin's JSON into the TruckNav `TelemetryPacket` JSON and forwards it to the TruckNav relay on UDP `54950`.
- TruckNav-Sim relay also binds `0.0.0.0:30001` so the mobile app bridge-check succeeds.

---

## Requirements

- Linux with ETS2/ATS installed via Steam.
- `cmake`, `g++`, `make`, `node`.
- TruckNav-Sim server running.

## Installation

### 1. Build and install the plugin

```bash
cd ets2-telemetry-udp
mkdir build
cd build
cmake ..
cmake --build . -j
cp libets2_telemetry_udp.so \
  "$HOME/Games/Steam/steamapps/common/Euro Truck Simulator 2/bin/linux_x64/plugins/"
```

### 2. Start the TruckNav relay

```bash
cd TruckNav-Sim/server
node telemetry-bridge.mjs
```

This listens on UDP `54950`, WebSocket `30002`, and the app-check port `30001`.

### 3. Start the ETS2→TruckNav bridge

```bash
cd telemetry-bridge-node
node bridge.mjs
```

This listens for the plugin on UDP `49001` and forwards packets to `127.0.0.1:54950`.

### 4. Start the game

Launch ETS2/ATS. The plugin will load automatically and telemetry will appear in TruckNav.

---

## Files included

- `ets2-telemetry-udp/src/telemetry.cpp` — modified SCS SDK plugin.
- `ets2-telemetry-udp/CMakeLists.txt` — unchanged build file.
- `telemetry-bridge-node/bridge.mjs` — ETS2 plugin → TruckNav relay bridge.
- `TruckNav-Sim/server/telemetry-bridge.mjs` — patched relay with LAN app support.

---

## License

Original plugin by MrHokss https://github.com/MrHokss/ets2-telemetry-udp. All modifications are provided as-is for the community.
