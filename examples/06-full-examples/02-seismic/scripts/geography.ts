import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { feature, mesh } from 'topojson-client';

import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/**
 * The world the map draws, written once into `public/geo/world.json`.
 *
 * Run by hand — `yarn geography` — and its output is committed, so neither the server nor the browser ever needs a
 * tile server, a key or a network route to draw a coastline. That is the whole reason this file exists: the first
 * version of this example drew CARTO's basemap, CARTO started asking for an API key, and every screen of the monitor
 * turned into a wall of "API KEY REQUIRED". A basemap you do not hold is a basemap somebody else can switch off.
 *
 * Three layers, all public:
 *
 * - **Land** — Natural Earth 1:50m via `world-atlas` 2.0.2. Public domain.
 * - **Borders** — the same, countries-50m, meshed so a border shared by two countries is drawn once.
 * - **Plate boundaries** — Peter Bird's PB2002 model (Bird, 2003, G³ 4(3)), as converted by Hugo Ahlenius.
 *   Open Data Commons Attribution: the map credits it. Pinned to one commit, because a moving source makes a
 *   committed output nobody can reproduce.
 *
 * The plate file is read at STEP level — five thousand short segments, each classified by what the two plates are
 * doing there — and merged back into runs of one kind. A boundary is not one thing: the Pacific–North America edge
 * is a transform in California and a subduction zone off Alaska, and the earthquakes know the difference.
 */

const PB2002_STEPS =
  'https://raw.githubusercontent.com/fraxen/tectonicplates/339b0c56563c118307b1f4542703047f5f698fae/GeoJSON/PB2002_steps.json';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../public/geo/world.json');
const require = createRequire(import.meta.url);

/**
 * Two decimals of a degree is about a kilometre — finer than a 1:50m source knows, and a third of the bytes of the
 * full-precision output. The map never zooms past the point where that would show.
 */
const round = (position: Position): Position => [
  Math.round(position[0] * 100) / 100,
  Math.round(position[1] * 100) / 100
];

/** Rounding folds neighbouring vertices onto one another; a ring of repeated points is bytes that draw nothing. */
const roundLine = (line: Position[]): Position[] =>
  line
    .map(round)
    .filter((point, index, all) => index === 0 || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1]);

const roundPolygon = (rings: Position[][]): Position[][] => rings.map(roundLine).filter(ring => ring.length >= 4);

const readTopology = (file: string): Topology =>
  JSON.parse(fs.readFileSync(require.resolve(`world-atlas/${file}`), 'utf8')) as Topology;

const land = (): FeatureCollection<MultiPolygon> => {
  const topology = readTopology('land-50m.json');
  const collection = feature(topology, topology.objects.land as GeometryCollection) as FeatureCollection<
    Polygon | MultiPolygon
  >;
  const polygons = collection.features.flatMap(entry =>
    entry.geometry.type === 'Polygon' ? [entry.geometry.coordinates] : entry.geometry.coordinates
  );

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: polygons.map(roundPolygon).filter(polygon => polygon.length > 0)
        }
      }
    ]
  };
};

const borders = (): FeatureCollection<MultiLineString> => {
  const topology = readTopology('countries-50m.json');
  // Only the edges two countries share: a coastline is already the land's outline, and drawing it again as a border
  // doubles every shore.
  const shared = mesh(topology, topology.objects.countries as GeometryCollection, (a, b) => a !== b);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: shared.coordinates.map(roundLine) }
      }
    ]
  };
};

type PlateKind = 'convergent' | 'divergent' | 'transform';

/**
 * PB2002's seven step classes, folded into the three a reader can tell apart on a map.
 *
 * SUB subduction, OCB/CCB oceanic and continental convergence; OSR spreading ridges and CRB continental rifts; OTF and
 * CTF transform faults. The finer split is a geologist's; the three that remain are the ones that decide what kind
 * of earthquake a boundary makes.
 */
const KIND_OF_CLASS: Record<string, PlateKind> = {
  SUB: 'convergent',
  OCB: 'convergent',
  CCB: 'convergent',
  OSR: 'divergent',
  CRB: 'divergent',
  OTF: 'transform',
  CTF: 'transform'
};

type Step = {
  properties: {
    PLATEBOUND: string;
    SEQNUM: number;
    STEPCLASS: string;
    VELOCITYLE: number;
    STARTLONG: number;
    STARTLAT: number;
    FINALLONG: number;
    FINALLAT: number;
  };
};

type PlateProperties = { kind: PlateKind; boundary: string; rate: number };

/**
 * Consecutive steps of one boundary and one kind become one line.
 *
 * A step that crosses the antimeridian is where a line is cut: joined across it, a run in Fiji would draw a stroke the
 * whole width of a flat map.
 */
const plates = async (): Promise<FeatureCollection<LineString, PlateProperties>> => {
  const response = await fetch(PB2002_STEPS);
  if (!response.ok) {
    throw new Error(`PB2002 answered ${response.status}`);
  }

  const { features: steps } = (await response.json()) as { features: Step[] };
  const lines: Feature<LineString, PlateProperties>[] = [];
  let run: { kind: PlateKind; boundary: string; points: Position[]; rates: number[]; last: number } | undefined;

  const close = (): void => {
    if (run && run.points.length > 1) {
      const rate = run.rates.reduce((sum, value) => sum + value, 0) / run.rates.length;
      lines.push({
        type: 'Feature',
        properties: { kind: run.kind, boundary: run.boundary, rate: Math.round(rate * 10) / 10 },
        geometry: { type: 'LineString', coordinates: roundLine(run.points) }
      });
    }

    run = undefined;
  };

  steps
    .map(step => step.properties)
    .sort((a, b) => a.PLATEBOUND.localeCompare(b.PLATEBOUND) || a.SEQNUM - b.SEQNUM)
    .forEach(step => {
      const kind = KIND_OF_CLASS[step.STEPCLASS];
      const start: Position = [step.STARTLONG, step.STARTLAT];
      const end: Position = [step.FINALLONG, step.FINALLAT];
      if (!kind) {
        close();

        return;
      }

      const wraps = Math.abs(end[0] - start[0]) > 180;
      const continues = run && run.kind === kind && run.boundary === step.PLATEBOUND && run.last === step.SEQNUM - 1;
      if (!continues || wraps) {
        close();
      }

      if (wraps) {
        return;
      }

      if (!run) {
        run = { kind, boundary: step.PLATEBOUND, points: [start], rates: [], last: step.SEQNUM };
      }

      run.points.push(end);
      run.rates.push(step.VELOCITYLE);
      run.last = step.SEQNUM;
    });
  close();

  return { type: 'FeatureCollection', features: lines };
};

const world = { land: land(), borders: borders(), plates: await plates() };

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(world));

const counts = `${world.plates.features.length} plate segments`;
console.log(
  `[geography] wrote ${path.relative(process.cwd(), output)} — ${(fs.statSync(output).size / 1024).toFixed(0)} KB, ${counts}`
);
