import dgram from "dgram";
import proj4 from "proj4";
import fs from "fs";

const UDP_SOURCE_PORT = 49001;
const UDP_TARGET_PORT = 54950;
const UDP_TARGET_HOST = "127.0.0.1";

const source = dgram.createSocket("udp4");
const target = dgram.createSocket("udp4");

const EARTH_RADIUS = 6370997;
const DEG_LEN = (EARTH_RADIUS * Math.PI) / 180;
const ETS2_PROJ_DEF = "+proj=lcc +lat_1=37 +lat_2=65 +lat_0=50 +lon_0=15 +R=6370997";
const ETS2_MAP_OFFSET = [16660, 4150];
const ETS2_MAP_FACTOR = [-0.000171570875, 0.0001729241463];
const ets2Converter = proj4(ETS2_PROJ_DEF);

function convertEts2ToGeo(gameX, gameZ) {
  let x = gameX - ETS2_MAP_OFFSET[0];
  let y = gameZ - ETS2_MAP_OFFSET[1];

  const ukScale = 0.75;
  const calaisBound = [-31100, -5500];

  if (gameX < -31100 && gameZ < -5500) {
    x = (x + calaisBound[0] / 2) * ukScale;
    y = (y + calaisBound[1] / 2) * ukScale;
  }

  const projectedX = x * ETS2_MAP_FACTOR[1] * DEG_LEN;
  const projectedY = y * ETS2_MAP_FACTOR[0] * DEG_LEN;

  const result = ets2Converter.inverse([projectedX, projectedY]);
  return result;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function getBearing(start, end) {
  const startLat = toRad(start[1]);
  const startLng = toRad(start[0]);
  const endLat = toRad(end[1]);
  const endLng = toRad(end[0]);
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

let lastPosition = null;
let movementHeading = 0;
let frame = 0;

function buildTelemetryPacket(data) {
  const speedMs = Number(data.speed ?? 0);
  const speedKph = speedMs * 3.6;
  const gameX = Number(data.x ?? 0);
  const gameZ = Number(data.z ?? 0);
  const sdkHeading = Number(data.heading ?? 0);
  const sdkHeadingDeg = ((sdkHeading * 360.0) % 360 + 360) % 360;

  const currentCoords = convertEts2ToGeo(gameX, gameZ);

  // Update movement bearing every packet with heavy smoothing.
  if (lastPosition && speedMs > 0.5) {
    const dist = Math.sqrt(
      Math.pow(currentCoords[0] - lastPosition[0], 2) +
        Math.pow(currentCoords[1] - lastPosition[1], 2)
    );
    if (dist > 0.000001) {
      const newBearing = getBearing(lastPosition, currentCoords);
      let diff = newBearing - movementHeading;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      movementHeading = (movementHeading + diff * 0.3 + 360) % 360;
    }
  }
  lastPosition = currentCoords;

  // TruckNav helpers.ts: rawDegrees = -rawGameHeading * 360.
  // We want rawDegrees to match the projected movement bearing so the app's
  // internal offset stays near 0 and does not drift.
  const rawGameHeading = (1.0 - movementHeading / 360.0 + 1.0) % 1.0;

  frame++;
  if (frame % 60 === 0) {
    // Debug logging disabled now that heading is stable.
    // fs.appendFileSync(
    //   "/tmp/bridge_debug.log",
    //   `sdk=${sdkHeadingDeg.toFixed(1)} move=${movementHeading.toFixed(1)} raw=${rawGameHeading.toFixed(4)} speed=${speedKph.toFixed(1)}\n`
    // );
  }

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
          currentGear: parseInt(data.gear ?? "0", 10),
          speedKph: speedKph,
          speedMph: speedMs * 2.23694,
          cruiseControlSpeedKph: 0,
          cruiseControlSpeedMph: 0,
          cruiseControlActive: false,
          rpm: Number(data.rpm ?? 0),
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
        heading: rawGameHeading,
        parkingBrake: false,
      },
      positioning: {},
    },
    trailers: [],
    job: {
      remainingDeliveryTime: now,
      cargoLoaded: data.jobCargoLoaded === true || data.jobCargoLoaded === "true",
      specialJob: data.jobSpecial === true || data.jobSpecial === "true",
      jobType: String(data.jobMarket ?? ""),
      cargo: {
        id: "",
        name: String(data.cargoName ?? ""),
        mass: Number(data.cargoMass ?? 0),
        damage: 0,
      },
      cityDestinationId: String(data.jobCityDestinationId ?? ""),
      cityDestination: String(data.jobCityDestination ?? ""),
      companyDestinationId: String(data.jobCompanyDestinationId ?? ""),
      companyDestination: String(data.jobCompanyDestination ?? ""),
      citySourceId: String(data.jobCitySourceId ?? ""),
      citySource: String(data.jobCitySource ?? ""),
      companySourceId: String(data.jobCompanySourceId ?? ""),
      companySource: String(data.jobCompanySource ?? ""),
      income: Number(data.jobIncome ?? 0),
    },
    navigation: {
      distance: navDistance,
      time: navTime,
      speedLimitKph: navSpeedLimit,
    },
    specialEvents: {
      onJob: Boolean(data.jobMarket && data.jobCityDestinationId),
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
    const data = JSON.parse(msg.toString("utf8"));
    const packet = buildTelemetryPacket(data);
    target.send(JSON.stringify(packet), UDP_TARGET_PORT, UDP_TARGET_HOST);
  } catch (e) {}
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
