import dgram from "dgram";
import { WebSocketServer } from "ws";

const WS_PORT = 30002;
const WS_CHECK_PORT = 30001;   // app bridge-check probe
const UDP_PORT = 54950;
const BIND_HOST = "0.0.0.0";

function createBroadcastServer(port) {
  const wss = new WebSocketServer({ port, host: BIND_HOST });

  wss.on("listening", () => {
    const addr = wss.address();
    console.log(
      "[TelemetryBridge] WebSocket server listening on ws://" +
        addr.address +
        ":" +
        addr.port
    );
  });

  wss.on("connection", (ws) => {
    const remote =
      ws._socket && ws._socket.remoteAddress
        ? ws._socket.remoteAddress
        : "unknown";
    console.log("[TelemetryBridge] Client connected on port " + port + ": " + remote);
    ws.on("close", () => {
      console.log("[TelemetryBridge] Client disconnected on port " + port + ": " + remote);
    });
  });

  return wss;
}

const wssMain = createBroadcastServer(WS_PORT);
const wssCheck = createBroadcastServer(WS_CHECK_PORT);

const udp = dgram.createSocket("udp4");

udp.on("error", (err) => {
  console.error("[TelemetryBridge] UDP error:", err.message);
  udp.close();
  process.exit(1);
});

udp.on("listening", () => {
  const addr = udp.address();
  console.log("[TelemetryBridge] Listening UDP on " + addr.address + ":" + addr.port);
});

udp.on("message", (msg) => {
  let json = null;
  try {
    const text = msg.toString("utf-8");
    json = JSON.parse(text);
  } catch (e) {
    json = {
      game: "ets2",
      rawData: msg.toString("hex"),
    };
  }

  if (!json.game) {
    json.game = "ets2";
  }

  const payload = JSON.stringify(json);

  for (const client of wssMain.clients) {
    if (client.readyState === 1) client.send(payload);
  }
  for (const client of wssCheck.clients) {
    if (client.readyState === 1) client.send(payload);
  }
});

udp.bind(UDP_PORT, BIND_HOST);
