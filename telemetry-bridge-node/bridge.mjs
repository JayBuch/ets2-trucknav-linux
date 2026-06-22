import dgram from "dgram";

const UDP_SOURCE_PORT = 49001;
const UDP_TARGET_PORT = 54950;
const UDP_TARGET_HOST = "127.0.0.1";

const source = dgram.createSocket("udp4");
const target = dgram.createSocket("udp4");

function buildTelemetryPacket(data) {
  const speedMs = Number(data.speed ?? 0);
  const rpm = Number(data.rpm ?? 0);
  const gear = parseInt(data.gear ?? "0", 10);
  const gameX = Number(data.x ?? 0);
  const gameZ = Number(data.z ?? 0);

  // SDK heading: 0 = north, increasing clockwise, normalized 0..1.
  // TruckNav helpers.ts computes rawDegrees = -rawGameHeading * 360.
  // To match that convention we send 1 - heading. Observed app renders
  // 90 deg to the left; subtract 0.25 to rotate arrow 90 deg clockwise.
  const headingDeg = Number(data.heading ?? 0) * 360.0;
  const correctedHeading = (1.0 - (headingDeg / 360.0) + 0.25 + 1.0) % 1.0;

  const baseDate = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
  const gameMinutes = Number(data.gameTime ?? 0);
  const gameDate = new Date(baseDate.getTime() + gameMinutes * 60 * 1000);

  const fuelAmount = Number(data.fuelAmount ?? 200);
  const fuelCapacity = Number(data.fuelCapacity ?? 400);
  const fuelConsumption = Number(data.fuelConsumption ?? 30);
  const fuelRange = Number(data.fuelRange ?? 800);
  const fuelWarning = data.fuelWarning === true || data.fuelWarning === "true";

  const navDistance = Number(data.navDistance ?? 0);
  const navTime = Number(data.navTime ?? 0);
  const navSpeedLimit = Number(data.navSpeedLimit ?? 0) * 3.6;

  const now = new Date().toISOString();

  return {
    paused: false,
    game: "ets2",
    gameVersion: "1.58",
    telemetryVersion: "1.0",
    common: {
      mapScale: 1,
      gameTime: gameDate.toISOString(),
      nextRestStopMinutes: Number(data.restStop ?? 0),
    },
    truck: {
      constants: {
        fuelCapacity: fuelCapacity,
        brand: "Scania",
        name: "R",
      },
      current: {
        dashboard: {
          fuelAmount: fuelAmount,
          averageConsumption: fuelConsumption,
          fuelRange: fuelRange,
          fuelWarning: fuelWarning,
          currentGear: gear,
          speedKph: speedMs * 3.6,
          speedMph: speedMs * 2.23694,
          cruiseControlSpeedKph: 0,
          cruiseControlSpeedMph: 0,
          cruiseControlActive: false,
          rpm: rpm,
          odometer: 0,
        },
        lights: {
          parking: false,
          beamLow: false,
          beamHigh: false,
        },
        damage: {
          engine: 0,
          transmission: 0,
          cabin: 0,
          chassis: 0,
          wheels: 0,
        },
        position: {
          x: gameX,
          y: 0,
          z: gameZ,
        },
        heading: correctedHeading,
        parkingBrake: false,
      },
      positioning: {},
    },
    trailers: [],
    job: {
      remainingDeliveryTime: now,
      cargoLoaded: false,
      specialJob: false,
      jobType: "",
      cargo: {
        id: "",
        name: "",
        mass: 0,
        damage: 0,
      },
      cityDestinationId: "",
      cityDestination: "",
      companyDestinationId: "",
      companyDestination: "",
      citySourceId: "",
      citySource: "",
      companySourceId: "",
      companySource: "",
      income: 0,
    },
    navigation: {
      distance: navDistance,
      time: navTime,
      speedLimitKph: navSpeedLimit,
    },
    specialEvents: {
      onJob: false,
      jobFinished: false,
      jobCancelled: false,
      jobDelivered: false,
      fined: false,
      tollgate: false,
      ferry: false,
      train: false,
      refuel: false,
      refuelPayed: false,
    },
    gamePlayEvents: {
      jobStarted: false,
      jobFinished: false,
      cancelled: false,
      delivered: false,
      fined: false,
      tollgate: false,
      ferry: false,
      train: false,
      refuel: false,
      refuelPayed: false,
    },
  };
}

source.on("message", (msg) => {
  try {
    const text = msg.toString("utf8");
    const data = JSON.parse(text);
    const packet = buildTelemetryPacket(data);
    const payload = JSON.stringify(packet);
    target.send(payload, UDP_TARGET_PORT, UDP_TARGET_HOST);
  } catch (e) {
    // silently drop bad packets
  }
});

source.on("error", (err) => {
  console.error("[TelemetryBridge] source socket error:", err.message);
  source.close();
  process.exit(1);
});

source.on("listening", () => {
  const addr = source.address();
  console.log(
    `[TelemetryBridge] Listening for ETS2 plugin UDP on ${addr.address} ${addr.port}`
  );
});

source.bind(UDP_SOURCE_PORT);
console.log("[TelemetryBridge] Ready. Forwarding real ETS2 coordinates to TruckNav relay.");
