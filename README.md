# ETS2 / ATS → TruckNav-Sim (Linux)

Linux-native integration for the official [SCS Telemetry SDK](https://modding.scssoft.com/wiki/Documentation/Engine/Telemetry) so you can use the [TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim) web/mobile dashboard with **Euro Truck Simulator 2** or **American Truck Simulator** on Linux.

## What this gives you

- Live GPS truck position on the TruckNav map.
- Real heading, speed, RPM, gear.
- In-game clock and remaining rest/sleep timer.
- Real fuel level, consumption, range, and low-fuel warning.
- Navigation distance, ETA, and current road speed limit.
- Mobile app support over LAN (the app bridge-check port is handled).

## What you get in this repo

| File | Purpose |
|------|---------|
| `ets2-telemetry-udp/src/telemetry.cpp` | Modified SCS SDK plugin that sends position, heading, fuel, time, rest, and navigation data over UDP. |
| `ets2-telemetry-udp/include/` | SCS SDK headers needed to build the plugin. |
| `ets2-telemetry-udp/CMakeLists.txt` | CMake build config for the plugin. |
| `telemetry-bridge-node/bridge.mjs` | UDP bridge that converts plugin output into the TruckNav packet format. |
| `telemetry-bridge.mjs` | Patched relay that serves the web UI and WebSocket telemetry (ports `3000`, `30001`, `30002`). |
| `start.sh` | Single-command launcher that starts both the relay and the bridge. |

This repo is self-contained for the server-side part. You still need the official **TruckNav-Sim mobile app** (or a browser pointed at the relay) to view the dashboard. The original `TruckNav-Sim` repo is linked below for credit and for the app source.

## Requirements

- Linux host running ETS2 / ATS (Steam build).
- `cmake`, `g++`, `make`.
- `node` v18+.

## Quick start

### 1. Clone this repo

```bash
cd ~/
git clone https://github.com/JayBuch/ets2-trucknav-linux.git
cd ets2-trucknav-linux
```

You do **not** need to clone the original `TruckNav-Sim` or `ets2-telemetry-udp` repositories; all modified files and SDK headers are included here.

### 2. Build the plugin

```bash
cd ets2-telemetry-udp
mkdir -p build
cd build
cmake ..
cmake --build . -j
cp libets2_telemetry_udp.so \
  "$HOME/.steam/steam/steamapps/common/Euro Truck Simulator 2/bin/linux_x64/plugins/"
```

If your Steam library lives somewhere else, adjust the destination path.

### 3. Start the relay and bridge

```bash
cd ~/ets2-trucknav-linux
./start.sh
```

This starts:
- TruckNav relay on `0.0.0.0:3000` (web UI), `0.0.0.0:30001` (app check), `0.0.0.0:30002` (telemetry).
- ETS2 bridge listening on UDP `49001` and forwarding to the relay.

Press `Ctrl+C` to stop both.

### 4. Launch the game

Start ETS2 / ATS. The plugin loads automatically. Open TruckNav at `http://your-host:3000` or connect the mobile app to `your-host`.

## How it works

1. The native SCS SDK plugin streams truck data as JSON over UDP `127.0.0.1:49001`.
2. `telemetry-bridge-node/bridge.mjs` converts that JSON into a TruckNav `TelemetryPacket` and forwards it to `127.0.0.1:54950`.
3. `telemetry-bridge.mjs` receives the packet on UDP `54950` and broadcasts it over WebSocket `30002` to the TruckNav browser / mobile app.

The TruckNav-Sim dashboard itself is opened in your browser or via the mobile app; the modified relay code is included in this repo so you don't need the original TruckNav-Sim server project to run it.

## Running as a systemd system service

If you want the relay and bridge to start automatically and stay running in the background:

1. Copy the service file into place:

```bash
sudo cp ets2-trucknav.service /etc/systemd/system/
sudo systemctl daemon-reload
```

2. Edit `/etc/systemd/system/ets2-trucknav.service` and make sure `User`, `Group`, `WorkingDirectory`, and `ExecStart` match your install path and Linux user.

3. Enable and start it:

```bash
sudo systemctl enable ets2-trucknav.service
sudo systemctl start ets2-trucknav.service
```

4. Check status and logs:

```bash
sudo systemctl status ets2-trucknav.service
sudo journalctl -u ets2-trucknav.service -f
```

## Manual start (if you prefer)

```bash
# Terminal 1: relay
cd ets2-trucknav-linux
node telemetry-bridge.mjs

# Terminal 2: bridge
cd ets2-trucknav-linux/telemetry-bridge-node
node bridge.mjs
```

## Verification

Check that the plugin is sending data:

```bash
nc -klu 49001
```

You should see JSON packets arriving every ~100–250 ms.

## Important notes

- The in-game GPS destination is **not** exposed by the SCS SDK as a world coordinate. To make TruckNav route you, set the matching destination waypoint manually in the TruckNav map after setting it in-game.
- `bridge.mjs` computes the truck heading from the projected GPS movement direction that TruckNav itself uses. This keeps TruckNav's internal heading offset near zero and prevents the arrow from drifting.
- If port `30001` is already in use by another program (e.g. VS Code:), the mobile app bridge-check will fail. Either free that port or bind the relay to a different address.

## Credits

- Original plugin: [MrHokss/ets2-telemetry-udp](https://github.com/MrHokss/ets2-telemetry-udp)
- Dashboard: [Rares-Muntean/TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim)
- Linux integration patches: community contribution, provided as-is.

## License

Original plugin license applies to `telemetry.cpp` and the included SCS SDK headers. The bridge/relay patches are released as-is for the community.
