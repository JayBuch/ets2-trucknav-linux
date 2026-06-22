# ETS2 / ATS → TruckNav-Sim (Linux)

Linux-native integration for the official [SCS Telemetry SDK](https://modding.scssoft.com/wiki/Documentation/Engine/Telemetry) so you can use the [TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim) web/mobile dashboard with **Euro Truck Simulator 2** or **American Truck Simulator** on Linux.

## What this gives you

- Live GPS truck position on the TruckNav map.
- Real heading, speed, RPM, gear.
- In-game clock and remaining rest/sleep timer.
- Real fuel level, consumption, range, and low-fuel warning.
- Navigation distance, ETA, and current road speed limit.
- Mobile app support over LAN (the app bridge-check port is handled).

## How it works

1. The native SCS SDK plugin (`ets2-telemetry-udp`) streams truck data as JSON over UDP `127.0.0.1:49001`.
2. The Node bridge (`telemetry-bridge-node`) converts that JSON into a TruckNav `TelemetryPacket` and forwards it to the TruckNav relay over UDP `127.0.0.1:54950`.
3. The patched TruckNav relay ([`TruckNav-Sim/server`](https://github.com/Rares-Muntean/TruckNav-Sim/tree/main/server)) serves:
   - Web UI on `0.0.0.0:3000`
   - Mobile app bridge-check on `0.0.0.0:30001`
   - Telemetry WebSocket on `0.0.0.0:30002`

## Requirements

- Linux host running ETS2 / ATS (Steam build).
- `cmake`, `g++`, `make`.
- `node` v18+.
- A copy of the [TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim) project checked out locally.

## Files in this repo

| File | Purpose |
|------|---------|
| `ets2-telemetry-udp/src/telemetry.cpp` | Modified SCS SDK plugin that sends position, heading, fuel, time, rest, and navigation data over UDP. |
| `ets2-telemetry-udp/CMakeLists.txt` | CMake build config for the plugin. |
| `telemetry-bridge-node/bridge.mjs` | UDP bridge that converts plugin output into the TruckNav packet format. |
| `TruckNav-Sim/server/telemetry-bridge.mjs` | Patched relay that listens on `30001` + `30002` for LAN mobile support. |
| `start.sh` | Single-command launcher that starts both the relay and the bridge. |

## Installation

### 1. Clone the three original projects and this repo side-by-side

```bash
cd ~/trucknav
git clone https://github.com/MrHokss/ets2-telemetry-udp.git
git clone https://github.com/Rares-Muntean/TruckNav-Sim.git
mkdir telemetry-bridge-node
git clone https://github.com/JayBuch/ets2-trucknav-linux.git
```

### 2. Copy the modified files into place

```bash
cd ets2-trucknav-linux
cp ets2-telemetry-udp/src/telemetry.cpp   ../ets2-telemetry-udp/src/telemetry.cpp
cp ets2-telemetry-udp/CMakeLists.txt     ../ets2-telemetry-udp/CMakeLists.txt
cp telemetry-bridge-node/bridge.mjs        ../telemetry-bridge-node/bridge.mjs
cp TruckNav-Sim/server/telemetry-bridge.mjs ../TruckNav-Sim/server/telemetry-bridge.mjs
```

### 3. Build and install the plugin

```bash
cd ../ets2-telemetry-udp
mkdir -p build
cd build
cmake ..
cmake --build . -j
cp libets2_telemetry_udp.so \
  "$HOME/.steam/steam/steamapps/common/Euro Truck Simulator 2/bin/linux_x64/plugins/"
```

If your Steam library lives somewhere else, adjust the destination path.

The launcher script is `start.sh`. It assumes the three project directories are side-by-side with this repo:

- `TruckNav-Sim/`
- `telemetry-bridge-node/`
- `ets2-trucknav-linux/` (this repo)

From inside this repo just run:

```bash
./start.sh
```

It starts the relay and the bridge as background jobs, then waits. Press `Ctrl+C` to stop both cleanly.

If you put the projects in different places, override the paths:

```bash
TRUCKNAV_DIR=/path/to/TruckNav-Sim BRIDGE_DIR=/path/to/telemetry-bridge-node ./start.sh
```

### 4. Launch the game

Start ETS2 / ATS. The plugin loads automatically. Open TruckNav at `http://your-host:3000` or connect the mobile app to `your-host`.

## Manual start (if you prefer)

```bash
# Terminal 1: TruckNav relay
cd TruckNav-Sim/server
node telemetry-bridge.mjs

# Terminal 2: ETS2 bridge
cd telemetry-bridge-node
node bridge.mjs
```

## Verification

A quick way to check the plugin is sending data:

```bash
nc -klu 49001
```

You should see JSON packets arriving every ~100–250 ms.

## Important notes

- The in-game GPS destination is **not** exposed by the SCS SDK as a world coordinate. To make TruckNav route you, set the matching destination waypoint manually in the TruckNav map after setting it in-game.
- A `+90°` heading correction is applied in `bridge.mjs` so the TruckNav arrow aligns correctly with the Linux plugin's output on this setup. If your arrow points the wrong way, adjust the `correctedHeading` line in `bridge.mjs`.
- If port `30001` is already in use by another program (e.g. VS Code), the mobile app bridge-check will fail. Either free that port or bind the relay to a different address.

## Credits

- Original plugin: [MrHokss/ets2-telemetry-udp](https://github.com/MrHokss/ets2-telemetry-udp)
- Dashboard: [Rares-Muntean/TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim)
- Linux integration patches: community contribution, provided as-is.

## License

Original plugin license applies to `telemetry.cpp`. The bridge/relay patches are released as-is for the community.
