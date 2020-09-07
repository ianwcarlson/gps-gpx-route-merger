const { parseGpx, buildGpx } = require("practical-gpx-to-js");
const path = require("path");
const fs = require("fs");

const ZOOM_LEVEL = 19;
const EARTH_RADIUS_METERS = 6378137;
const adjacentOffsets = [
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
];
const originShift = (2 * Math.PI * EARTH_RADIUS_METERS) / 2.0;
const tileSize = 256;
const initialResolution = (2 * Math.PI * EARTH_RADIUS_METERS) / tileSize;
const resolution = initialResolution / Math.pow(2, ZOOM_LEVEL);
console.log("resolution: ", resolution);

// https://www.maptiler.com/google-maps-coordinates-tile-bounds-projection/

// const latDelta = convLat2YTile(1, ZOOM_LEVEL) - convLat2YTile(0, ZOOM_LEVEL);
// const longDelta = convLon2XTile(1, ZOOM_LEVEL) - convLon2XTile(0, ZOOM_LEVEL);

// console.log('latDelta: ', latDelta);
// console.log('longDelta: ', longDelta);

const pathToFile = path.resolve(
  __dirname,
  "assets",
  "Canada-de-Los-Alamos-1.gpx"
);

// const geoJsonContent = toGeoJSON.gpx(
//   new DOMParser().parseFromString(
//     fs.readFileSync(pathToFile, { encoding: "utf8" }),
//     "text/xml"
//   )
// );

async function main() {
  const parsedFile = await parseGpx(fs.readFileSync(pathToFile));
  // console.log(parsedFile.tracks[0].trackpoints[0]);
  // console.log(parsedFile.tracks);

  const points = parsedFile.tracks[0].trackpoints.reduce((acc, c) => {
    // const lat = convLat2YTile(convDecToRad(c.lat), ZOOM_LEVEL);
    // const long = convLon2XTile(convDecToRad(c.lon), ZOOM_LEVEL);
    const { tx, ty } = convLatLongToTile(c.lat, c.lon);
    const key = serializeKey(tx, ty);
    // console.log(key);
    return acc.set(key, new Map(Object.entries({ visited: false, altitude: c.altitude })));
  }, new Map());
  console.log("points: ", points.keys().next().value);
  console.log("Num points: ", points.size);

  const pointsIter = points.keys();
  const route = [];
  let result = pointsIter.next();
  while (!result.done) {
    const deserializedKey = deserializeKey(result.value);
    // console.log('deserializedKey: ', deserializedKey);
    route.push(tileToLatLon(deserializedKey[0], deserializedKey[1]));
    result = pointsIter.next();
  }

  const tracks = [
    {
      name: "Test",
      trackpoints: route,
      segments: [route.length],
    },
  ];
  // console.log("route: ", JSON.stringify(tracks, null, 2));

  const newGpxString = buildGpx({
    metadata: parsedFile.metadata,
    waypoints: [],
    tracks,
  });

  fs.writeFileSync(path.join(__dirname, "build", "NewTrack.gpx"), newGpxString);
}

main().then();

function serializeKey(lat, long) {
  return `${lat}_${long}`;
}

function deserializeKey(key) {
  return key.split("_").map((o) => Number(o));
}

// function convLon2XTile(lon, zoom) {
//   return Math.floor((((lon * 180) / Math.PI + 180) / 360) * Math.pow(2, zoom));
// }

// function convLat2YTile(lat, zoom) {
//   return Math.floor(
//     ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) *
//       Math.pow(2, zoom)
//   );
// }

function convLatLongToTile(lat, lon) {
  const { mx, my } = latLonToMeters(lat, lon);
  const { px, py } = metersToPixels(mx, my, ZOOM_LEVEL);
  const { tx, ty } = pixelsToTile(px, py);
  return { tx, ty };
}

function latLonToMeters(lat, lon) {
  // "Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913"

  const mx = (lon * originShift) / 180.0;
  let my =
    Math.log(Math.tan(((90 + lat) * Math.PI) / 360.0)) / (Math.PI / 180.0);

  my = (my * originShift) / 180.0;
  return { mx, my };
}

function metersToPixels(mx, my, zoom) {
  // "Converts EPSG:900913 to pyramid pixel coordinates in given zoom level"

  const px = (mx + originShift) / resolution;
  const py = (my + originShift) / resolution;
  return { px, py };
}

function pixelsToTile(px, py) {
  // "Returns a tile covering region in given pixel coordinates";

  const tx = Math.floor(px / tileSize) - 1;
  const ty = Math.floor(py / tileSize) - 1;
  return { tx, ty };
}

function tileToLatLon(tx, ty) {
  const { mx, my } = pixelsToMeters(tx * tileSize, ty * tileSize);
  const { lat, lon } = metersToLatLon(mx, my);
  return { lat, lon };
}

function metersToLatLon(mx, my) {
  // "Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum"

  const lon = (mx / originShift) * 180.0;
  let lat = (my / originShift) * 180.0;

  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180.0)) - Math.PI / 2.0);
  return { lat, lon };
}

function pixelsToMeters(px, py) {
  // "Converts pixel coordinates in given zoom level of pyramid to EPSG:900913"

  const mx = px * resolution - originShift;
  const my = py * resolution - originShift;
  return { mx, my };
}

function convDecToRad(dec) {
  return (dec * Math.PI) / 180;
}
