import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Point, Position } from 'geojson';

/** One event, as the space hands it over. Only what the map draws is read; everything else rides along untouched. */
export type MapQuake = {
  id: string;
  region: string;
  magnitude: number;
  magnitudeLabel: string;
  depthLabel: string;
  band: string;
  latitude: number;
  longitude: number;
  coordinates: string;
  time: number;
  isFresh: boolean;
};

/** The world the map draws, as `yarn geography` writes it into `public/geo/world.json`. */
export type Geography = {
  land: FeatureCollection<MultiPolygon>;
  borders: FeatureCollection<MultiLineString>;
  plates: FeatureCollection<LineString, { kind: string; boundary: string; rate: number }>;
};

export const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isQuake = (value: unknown): value is MapQuake =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.magnitude === 'number' &&
  typeof value.latitude === 'number' &&
  typeof value.longitude === 'number';

/** JSON text is what the builder hands over when somebody types a value; a binding hands over the value itself. */
const parsed = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

export const toQuakes = (events: unknown): MapQuake[] => {
  const value = parsed(events);

  return Array.isArray(value) ? value.filter(isQuake) : [];
};

const isCollection = (value: unknown): value is FeatureCollection =>
  isRecord(value) && value.type === 'FeatureCollection' && Array.isArray(value.features);

export const toGeography = (geography: unknown): Geography | undefined => {
  const value = parsed(geography);
  if (!isRecord(value) || !isCollection(value.land) || !isCollection(value.borders) || !isCollection(value.plates)) {
    return undefined;
  }

  // Checked structurally above; the per-feature geometry types are the generator's contract, not something a
  // runtime check could add anything to.
  return value as Geography;
};

/**
 * The events as map features, carrying only what the style reads.
 *
 * `id` is promoted to the feature id so a click resolves back to the event without searching, and `time` rides along
 * because the replay filters on it.
 */
export const quakeFeatures = (quakes: MapQuake[]): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: quakes.map((quake): Feature<Point> => ({
    type: 'Feature',
    properties: {
      id: quake.id,
      magnitude: quake.magnitude,
      band: quake.band,
      time: quake.time,
      fresh: quake.isFresh
    },
    geometry: { type: 'Point', coordinates: [quake.longitude, quake.latitude] }
  }))
});

/**
 * A graticule every fifteen degrees — the one reference a display with no labels needs to be read as a globe.
 *
 * Meridians stop short of the poles, where they would converge into a solid disc.
 */
export const graticule = (): FeatureCollection<LineString> => {
  const lines: Feature<LineString>[] = [];
  for (let longitude = -180; longitude < 180; longitude += 15) {
    const points: Position[] = [];
    for (let latitude = -80; latitude <= 80; latitude += 2) {
      points.push([longitude, latitude]);
    }

    lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } });
  }

  for (let latitude = -75; latitude <= 75; latitude += 15) {
    const points: Position[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 2) {
      points.push([longitude, latitude]);
    }

    lines.push({
      type: 'Feature',
      properties: { equator: latitude === 0 },
      geometry: { type: 'LineString', coordinates: points }
    });
  }

  return { type: 'FeatureCollection', features: lines };
};

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Where you arrive walking `distanceKm` from a point on a bearing — a great circle, so a ring stays round on a globe. */
const destination = (longitude: number, latitude: number, distanceKm: number, bearing: number): Position => {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const lat1 = toRadians(latitude);
  const lon1 = toRadians(longitude);
  const theta = toRadians(bearing);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [((toDegrees(lon2) + 540) % 360) - 180, toDegrees(lat2)];
};

/** The distances the range rings are drawn at, and the label each one carries. */
export const RANGE_RINGS_KM = [100, 300, 1000] as const;

/**
 * Range rings around the selected event: how far the shaking reached, in the one unit everyone can picture.
 *
 * Built as true geodesic circles, so a thousand kilometres near Alaska is the same thousand kilometres as near the
 * equator — a circle in screen space would lie by a factor of two at those latitudes.
 */
export const rangeRings = (longitude: number, latitude: number): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: RANGE_RINGS_KM.map((distance): Feature<LineString> => ({
    type: 'Feature',
    properties: { distance },
    geometry: {
      type: 'LineString',
      coordinates: Array.from({ length: 97 }, (_, step) =>
        destination(longitude, latitude, distance, (step * 360) / 96)
      )
    }
  }))
});

/**
 * Where each ring's label sits: on the ring, south-south-west of the event — the one side the reticle's crosshair,
 * its tag (east) and the dossier's flight padding leave clear.
 */
export const ringLabelPosition = (longitude: number, latitude: number, distanceKm: number): [number, number] => {
  const [lon, lat] = destination(longitude, latitude, distanceKm, 205);

  return [lon, lat];
};
