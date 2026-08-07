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
| `ets2-telemetry-udp/src/telemetry.cpp` | Modified SCS SDK plugin that sends position, heading, fuel, time, rest, and navigation data over UDP to `127.0.0.1:49001`. |
| `ets2-telemetry-udp/include/` | SCS SDK headers needed to build the plugin. |
| `ets2-telemetry-udp/CMakeLists.txt` | CMake build config for the plugin. |
| `telemetry-bridge-node/bridge.mjs` | UDP bridge that converts plugin output into the TruckNav packet format and forwards it to `127.0.0.1:54950`. |
| `telemetry-bridge.mjs` | UDP/WebSocket relay. Receives telemetry on UDP `54950` and broadcasts it over WebSocket `30001` (app check) and `30002` (telemetry). **It does not serve the web UI on port `3000`;** use the TruckNav-Sim Nuxt dev server (or the official mobile app) for that. |
| `ats-telemetry-launcher.sh` | Steam launch wrapper for **American Truck Simulator**. |
| `ets2-telemetry-launcher.sh` | Steam launch wrapper for **Euro Truck Simulator 2**. |
| `start.sh` | Single-command launcher that starts both the relay and the bridge. |
| `ets2-trucknav.service` | systemd service template to run the relay/bridge in the background. |

This repo contains the Linux server-side pieces you need to feed telemetry into TruckNav-Sim. You still need one of the following to view the dashboard:
- The official **TruckNav-Sim mobile app** (Android/iOS) from the upstream project.
- A browser pointed at the TruckNav-Sim Nuxt dev server (see the upstream repo) if you want the full web UI on port `3000`.

The original `TruckNav-Sim` repo is linked below for credit, for the app source, and for the Nuxt web dashboard.

## Requirements

- Linux host running ETS2 / ATS (Steam build).
- `cmake`, `g++`, `make`.
- `node` v18+.

## Quick start

### 1. Clone this repo (and the upstream dashboard if you want the web UI)

```bash
cd ~/
git clone https://github.com/JayBuch/ets2-ats-trucknav-linux.git
cd ets2-ats-trucknav-linux
```

You do **not** need to clone the original `ets2-telemetry-udp` repository — the modified plugin and SDK headers are included here.

If you want to use a browser for the dashboard (rather than the official mobile app), you also need to clone the upstream `TruckNav-Sim` repo:

```bash
cd ~/
git clone https://github.com/Rares-Muntean/TruckNav-Sim.git
```

The `telemetry-bridge.mjs` in this repo handles WebSocket telemetry. The TruckNav-Sim repo provides the Nuxt dev server that serves the web UI on port `3000`.

### 2. Build the plugin

```bash
cd ets2-telemetry-udp
mkdir -p build
cd build
cmake ..
cmake --build . -j
cp libets2_telemetry_udp.so \
  "$HOME/.steam/steam/steamapps/common/Euro Truck Simulator 2/bin/linux_x64/plugins/"
cp libets2_telemetry_udp.so \
  "$HOME/.steam/steam/steamapps/common/American Truck Simulator/bin/linux_x64/plugins/"
```

If your Steam library lives somewhere else, adjust the destination paths. The launcher scripts use `$HOME/Games/Steam/steamapps/common/`, so edit them if your install path differs.

### 3. Start the relay and bridge

```bash
cd ~/ets2-ats-trucknav-linux
./start.sh
```

This starts:
- The telemetry bridge-node, listening on UDP `49001` and forwarding to the relay on UDP `54950`.
- The telemetry relay, listening on UDP `54950` and broadcasting WebSocket telemetry on `0.0.0.0:30001` (app check) and `0.0.0.0:30002` (telemetry).

Press `Ctrl+C` to stop both.

If you also want the browser web UI on port `3000`, start the TruckNav-Sim Nuxt dev server in another terminal:

```bash
cd ~/TruckNav-Sim
npm install
npx nuxi dev --host 0.0.0.0
```

> **Note:** `start.sh` will auto-build the plugin if it's missing and auto-install it into the Steam plugin directories if they're present. You only need to run the build step manually if your Steam path is different.

### 4. Launch the game with the Steam telemetry wrapper

Right-click the game in Steam → **Properties…** → **General** → **Launch Options**, then paste the matching wrapper:

**Euro Truck Simulator 2:**
```bash
bash "$HOME/ets2-telemetry-launcher.sh"
```

**American Truck Simulator:**
```bash
bash "$HOME/ats-telemetry-launcher.sh"
```

When you start the game, the wrapper runs the game binary from your Steam library path. The plugin sends telemetry to `127.0.0.1:49001`; the bridge forwards it to the relay on UDP `54950`, and the relay broadcasts it over WebSocket `30002` to the TruckNav browser / mobile app.

- Connect the **mobile app** to your host's IP address.
- Open the **browser dashboard** at `http://your-host:3000` (only if you started the TruckNav-Sim Nuxt dev server).

## How it works

1. The SCS SDK plugin streams truck data as JSON over UDP `127.0.0.1:49001`.
2. `telemetry-bridge-node/bridge.mjs` converts that JSON into a TruckNav `TelemetryPacket` and forwards it to `127.0.0.1:54950`.
3. `telemetry-bridge.mjs` receives the packet on UDP `54950` and broadcasts it over WebSocket `30002` to the TruckNav browser / mobile app.

The TruckNav-Sim dashboard itself is opened in your browser or via the mobile app. This repo's relay handles WebSocket telemetry; the TruckNav-Sim repo provides the browser web UI on port `3000`.

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
# Terminal 1: telemetry relay (WebSocket telemetry only; no web UI on port 3000)
cd ~/ets2-ats-trucknav-linux
node telemetry-bridge.mjs

# Terminal 2: bridge
cd ~/ets2-ats-trucknav-linux/telemetry-bridge-node
node bridge.mjs

# Terminal 3 (optional): TruckNav-Sim Nuxt dev server for the browser web UI on port 3000
cd ~/TruckNav-Sim
npm install
npx nuxi dev --host 0.0.0.0
```

## Verification

Check that the plugin is sending data:

```bash
nc -klu 49001
```

You should see JSON packets arriving every ~100–250 ms when the game is running.

## Credits

- Original plugin: [MrHokss/ets2-telemetry-udp](https://github.com/MrHokss/ets2-telemetry-udp)
- Dashboard: [Rares-Muntean/TruckNav-Sim](https://github.com/Rares-Muntean/TruckNav-Sim)
- Linux integration patches: community contribution, provided as-is.

## License

Original plugin license applies to `telemetry.cpp` and the included SCS SDK headers. The bridge/relay patches are released as-is for the community.
