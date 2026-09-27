import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import 'maplibre-gl/dist/maplibre-gl.css';
import './SeismicMap.css';

import declaration from './declaration';
import {
  EMPTY_COLLECTION,
  RANGE_RINGS_KM,
  graticule,
  quakeFeatures,
  rangeRings,
  ringLabelPosition,
  shakingBounds,
  shakingFeatures,
  shakingLabels,
  toGeography,
  toQuakes,
  toShaking
} from './geo';
import {
  LAYERS,
  PLATE_LAYERS,
  PULSE_PHASE,
  QUAKE_LAYERS,
  REPLAY_CLOCK,
  SOURCES,
  applyPalette,
  pulseFilter,
  quakeFilter,
  style
} from './layers';
import { SHOCKWAVE_MS, reticle, ringLabel, shakingLabel, shockwave, tooltip } from './overlays';
import { readPalette } from './palette';

import type { Geography, MapQuake, Shaking } from './geo';
import type { InteractionCallback } from '@plitzi/plitzi-sdk';
import type { FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';

/**
 * The globe: the element this space ships to draw what cannot be arranged out of boxes.
 *
 * **Why this is a plugin.** A position on the Earth is a projection and a magnitude is an area: neither can be
 * arranged out of boxes. Everything that IS text in a box — the counters, the log, the target dossier, the filters —
 * is authored in the space, and this element draws only what cannot be.
 *
 * **It is an element like any other.** Its attributes are its props, so the page binds them: the events and the
 * magnitude floor to the server's answer and the page's own filter, the selection and every switch to `state`, the
 * colour scheme to `theme`. It holds no URL of its own and asks nobody for data.
 *
 * **It talks back through events, never through the page's state.** Picking an event fires `onQuakeSelect`; one
 * arriving live fires `onQuakeArrival`, and `onArrivalSettled` once its moment is over if it still holds the lock; the
 * end of a replay fires `onReplayEnd`. The flows the space hangs on those
 * decide what they mean — which is why the same click can select from the map, the log or the "strongest" card, and
 * every one of them is visible in the space rather than buried in here.
 *
 * **MapLibre is imported inside the effect.** It reaches for the browser as it loads, and the server imports this
 * module to render the page; loaded from an effect, it can only ever run where there is a document.
 */

export type SeismicMapProps = {
  /** Every event in the window. An array from a binding; JSON text when somebody typed it into the builder. */
  events?: MapQuake[] | string;
  /** The world's outlines, as `public/geo/world.json` holds them. Nothing but a graticule until it arrives. */
  geography?: Geography | string;
  /** Events below this are not drawn. Filtered on the GPU, so moving it is instant however many events there are. */
  minMagnitude?: number | string;
  /** `all`, or the one depth band to draw: `shallow`, `intermediate`, `deep`. */
  depthBand?: string;
  /**
   * An event at least this big arriving while the page is open is announced with `onQuakeArrival`. Smaller arrivals
   * still throw out a shockwave if they are on screen; they are simply not news. Above any magnitude, nothing is.
   */
  alertMagnitude?: number | string;
  /**
   * How long an announced arrival has the stage. When it is over and the arrival is still the event selected, the map
   * fires `onArrivalSettled` — and not when the reader has picked something else in the meantime, or a newer arrival
   * took the lock: those are not the arrival's to give back.
   */
  arrivalSeconds?: number | string;
  /** The event to lock on to. Changing it flies there; an id the events do not hold clears the lock. */
  selectedId?: string;
  /** `globe` or `flat`. */
  projection?: string;
  showPlates?: boolean | string;
  showHeat?: boolean | string;
  /** Turn the globe slowly while nobody is touching it and nothing is selected — the display left running on a wall. */
  autoRotate?: boolean | string;
  /** Replay the window from its first event to its last. Turning it off stops the replay where it is. */
  replay?: boolean | string;
  /** How long a replay takes, whatever the window's length. */
  replaySeconds?: number | string;
  /** The page's resolved colour scheme. Bound so a theme switch reaches a canvas that cannot see CSS change. */
  scheme?: string;
  /**
   * What the events ARE — the window they came from.
   *
   * An event is "arriving" when it was not in the last answer. When the reader switches from a day to a week, every
   * event of the week is new to the map and none of them arrived: a new key is a new dataset, primed silently.
   */
  feedKey?: string;
  /** Where MapLibre's worker is served. It is a module of its own and cannot be bundled into this one. */
  workerUrl?: string;
  /**
   * How hard the ground shook around an event — its ShakeMap contours, with the event's id. Drawn only while that
   * event is the one locked, so contours that arrive late for an event the reader has left are never shown.
   */
  shaking?: Shaking | string | null;
  /**
   * Tour the window: every `tourSeconds`, the map moves on to the next of its strongest events that pass the filters
   * and says so with `onTourStep`. A reader who grabs the map ends it with `onTourEnd`.
   */
  tour?: boolean | string;
  tourSeconds?: number | string;
  /** After this long with nobody touching the page, `onIdle`. `0` never. The display left on a wall uses it. */
  idleSeconds?: number | string;
  className?: string;
};

type MapLibreModule = typeof MapLibre;

/** Where the globe opens: the western Pacific, where most of the planet's large earthquakes are. */
const HOME_CENTER: [number, number] = [150, 8];

/**
 * The part of the box the space's panels leave clear, as camera padding.
 *
 * On a wide screen the panels run down both sides; on a narrow one the header sits on top and the log fills the lower
 * half. The globe is centred in what is left rather than in the box, or on a phone it sits behind the log.
 */
const clearArea = (element: HTMLElement): MapLibre.PaddingOptions => {
  const { width, height } = element.getBoundingClientRect();
  if (width < 768) {
    return { top: height * 0.24, bottom: height * 0.5, left: 0, right: 0 };
  }

  return { top: 60, bottom: 20, left: width * 0.19, right: width * 0.21 };
};

/**
 * The zoom at which the globe fills that clear area.
 *
 * A globe's diameter is the world's pixel size over π, and the world is 512px at zoom 0 — so the zoom that makes the
 * disc as big as the area's short side is a logarithm, not a constant that fits one screen.
 */
const homeZoom = (element: HTMLElement): number => {
  const { width, height } = element.getBoundingClientRect();
  const { top = 0, bottom = 0, left = 0, right = 0 } = clearArea(element);
  const side = Math.max(Math.min(width - left - right, height - top - bottom), 200);

  return Math.log2((side * 0.92 * Math.PI) / 512);
};

const IDLE_BEFORE_ROTATING_MS = 6000;

/** Degrees of longitude a second. Slow enough to read a label while it passes. */
const ROTATION_SPEED = 4;

/** More arrivals than this in one refresh are announced as the largest few — a backlog, not a sequence. */
const MAX_ANNOUNCED = 3;

/**
 * Every marker is ON the globe, and goes behind it with the Earth. MapLibre's default leaves a covered marker at 0.2 —
 * a reticle, a label, a shockwave showing through the planet from the far side.
 */
const ON_SURFACE = { opacityWhenCovered: '0' } as const;

/** One beat of a fresh event's pulse. */
const PULSE_MS = 2600;

/** How many of the window's strongest events a tour visits before starting again. */
const TOUR_STOPS = 8;

/** What counts as somebody at the page, for `idleSeconds`. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

/** Shockwaves on screen at once during a replay. A busy hour would otherwise be a thousand DOM nodes. */
const MAX_REPLAY_SHOCKS = 24;

/** Events smaller than this appear in a replay without a shockwave: at M1 a ring says more than the event does. */
const REPLAY_SHOCK_MAGNITUDE = 3.5;

/**
 * How often the replay's camera may move on to the next event — long enough for a flight to land and be read.
 *
 * It flies to the LARGEST event the clock passed since the last flight, not to each one: a busy hour is dozens of
 * events a second of replay, and a camera that chased every one would never arrive anywhere.
 */
const REPLAY_FLIGHT_MS = 2800;

/** A reader who grabbed the map during a replay keeps it for this long before the camera moves again. */
const HANDS_OFF_MS = 5000;

/**
 * A pan control moves the CENTRE, in degrees — not the picture, in pixels.
 *
 * On a globe a pixel is not a direction: dragging the picture up near the rim or a pole turns the Earth sideways, so a
 * button labelled "north" did something different on every press. Latitude and longitude are the same direction
 * wherever the camera is, on the globe and on the flat map alike. The step shrinks as the reader zooms in, so one
 * press is always about a third of what is on screen.
 */
const PAN_DIRECTIONS: Record<string, [number, number]> = {
  north: [0, 1],
  south: [0, -1],
  east: [1, 0],
  west: [-1, 0]
};

const panStep = (zoom: number): number => Math.min(Math.max(45 / 2 ** (zoom - 1.5), 1.5), 45);

/** How far north or south the centre may go: past this a globe is looking at a pole, and a flat map at nothing. */
const MAX_LATITUDE = 75;

/** Bindings deliver booleans as booleans, and the builder — and a template — as text. */
const flag = (value: boolean | string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') {
    return fallback;
  }

  return value === true || value === 'true';
};

const numeric = (value: number | string | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');

  return Number.isFinite(parsed) ? parsed : fallback;
};

const projectionOf = (value: string | undefined): 'globe' | 'mercator' => (value === 'flat' ? 'mercator' : 'globe');

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What a flow started by one of the map's events can read about the event. */
const payloadOf = (quake: MapQuake): Record<string, unknown> => ({
  id: quake.id,
  magnitude: quake.magnitude,
  magnitudeLabel: quake.magnitudeLabel,
  region: quake.region,
  depthLabel: quake.depthLabel
});

const formatCursor = (longitude: number, latitude: number): string =>
  `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}  ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const two = (value: number): string => String(value).padStart(2, '0');

/** `21 SEP 08:49 UTC` — the readout the rest of the display uses, spelled here because a locale spells it its own way. */
const replayTime = (time: number): string => {
  const date = new Date(time);

  return `${two(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())} UTC`;
};

/**
 * Where a flight puts the event: in the part of the screen the space leaves clear.
 *
 * The overlay covers the sides and the foot of the display on a wide screen, and the lower half on a narrow one; an
 * event flown to the geometric centre would land under a panel.
 */
const focusPadding = (element: HTMLElement): MapLibre.PaddingOptions => {
  const { width, height } = element.getBoundingClientRect();
  if (width < 768) {
    return { top: height * 0.12, bottom: height * 0.45, left: 16, right: 16 };
  }

  return { top: height * 0.12, bottom: height * 0.3, left: width * 0.2, right: width * 0.24 };
};

/** The events the map fires, as declared — nothing about them depends on the mounted element. */
const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

const setData = (map: MapLibre.Map, source: string, data: FeatureCollection): void => {
  const target = map.getSource<MapLibre.GeoJSONSource>(source);
  void target?.setData(data);
};

const SeismicMap = ({
  events,
  geography,
  minMagnitude,
  depthBand = 'all',
  alertMagnitude,
  arrivalSeconds = 8,
  selectedId = '',
  projection = 'globe',
  showPlates = true,
  showHeat = false,
  autoRotate = true,
  replay = false,
  replaySeconds = 24,
  scheme = 'dark',
  feedKey = '',
  workerUrl = '/vendor/maplibre/maplibre-gl-worker.mjs',
  shaking,
  tour = false,
  tourSeconds = 10,
  idleSeconds = 0,
  className
}: SeismicMapProps) => {
  const quakes = useMemo(() => toQuakes(events), [events]);
  const world = useMemo(() => toGeography(geography), [geography]);
  const floor = numeric(minMagnitude, 0);
  const alertFrom = numeric(alertMagnitude, 99);
  const arrivalMs = numeric(arrivalSeconds, 8) * 1000;
  const replaying = flag(replay, false);
  const rotating = flag(autoRotate, true);
  const touring = flag(tour, false);
  const stopMs = Math.max(numeric(tourSeconds, 10), 3) * 1000;
  const idleMs = Math.max(numeric(idleSeconds, 0), 0) * 1000;
  const contours = useMemo(() => toShaking(shaking), [shaking]);

  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);

  const host = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const replayClock = useRef<HTMLSpanElement>(null);
  const replayProgress = useRef<HTMLSpanElement>(null);
  const tourStop = useRef<HTMLSpanElement>(null);
  const tourTrack = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const libraryRef = useRef<MapLibreModule | null>(null);
  const [ready, setReady] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  const fire = useCallback(
    (trigger: keyof typeof declaration.triggers, payload: Record<string, unknown>) =>
      void interactionsManager.interactionTrigger(id, declaration.triggers[trigger].action, payload),
    [interactionsManager, id]
  );

  /**
   * What the map's own handlers read when they fire.
   *
   * They are attached once, when the map is created, and a click lands whenever it lands — so they read the props of
   * THAT moment through here rather than the ones they closed over.
   */
  const latest = useRef({ quakes, floor, depthBand, alertFrom, arrivalMs, selectedId, projection, fire });
  useEffect(() => {
    latest.current = { quakes, floor, depthBand, alertFrom, arrivalMs, selectedId, projection, fire };
  });

  /** Where the replay's clock is. Past the end of time outside a replay, so every event counts as having happened. */
  const clock = useRef(Number.MAX_SAFE_INTEGER);
  /** The last moment the camera moved on anybody's behalf: rotation waits for it to have settled. */
  const lastTouched = useRef(0);
  /** The last moment the READER moved it — which the replay's camera defers to, and its own flights do not count as. */
  const handsOn = useRef(0);
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null);
  const lock = useRef<{ target: string; markers: MapLibre.Marker[] }>({ target: '', markers: [] });
  /** The arrivals still on stage, each waiting to hand back its lock. */
  const onStage = useRef(new Set<number>());
  useEffect(() => {
    const timers = onStage.current;

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, []);

  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    lastTouched.current = performance.now();
    const container = map.getContainer();
    map.flyTo({
      center: HOME_CENTER,
      zoom: homeZoom(container),
      padding: clearArea(container),
      bearing: 0,
      pitch: 0,
      speed: 0.8,
      essential: true
    });
  }, []);

  /** Whether an event passes the reader's filters right now — the same test the map's layers apply on the GPU. */
  const onScreen = useCallback((quake: MapQuake): boolean => {
    const { floor: min, depthBand: band } = latest.current;

    return quake.magnitude >= min && (band === 'all' || quake.band === band);
  }, []);

  /** Camera moves a flow can ask for. Each one counts as a touch, so a globe being driven stops turning by itself. */
  const zoomBy = useCallback((step: 1 | -1) => {
    const map = mapRef.current;
    lastTouched.current = performance.now();
    map?.easeTo({ zoom: map.getZoom() + step, duration: 450 });
  }, []);

  const pan = useCallback(({ direction }: { direction?: unknown }) => {
    const map = mapRef.current;
    const vector = typeof direction === 'string' ? PAN_DIRECTIONS[direction] : undefined;
    if (!map || !vector) {
      return;
    }

    lastTouched.current = performance.now();
    const step = panStep(map.getZoom());
    const center = map.getCenter();
    // Longitude wraps; latitude stops short of the poles.
    const longitude = ((center.lng + vector[0] * step + 540) % 360) - 180;
    const latitude = Math.min(Math.max(center.lat + vector[1] * step, -MAX_LATITUDE), MAX_LATITUDE);
    map.easeTo({ center: [longitude, latitude], duration: 550 });
  }, []);

  /** A shockwave at a position, gone when its animation is. */
  const burst = useCallback((quake: MapQuake) => {
    const map = mapRef.current;
    const library = libraryRef.current;
    if (!map || !library) {
      return;
    }

    const marker = new library.Marker({
      ...ON_SURFACE,
      element: shockwave(quake.band, quake.magnitude >= 5),
      subpixelPositioning: true
    })
      .setLngLat([quake.longitude, quake.latitude])
      .addTo(map);
    window.setTimeout(() => marker.remove(), SHOCKWAVE_MS);
  }, []);

  /**
   * The map itself, created once.
   *
   * In an effect because MapLibre needs a DOM node, and because the palette it is created with is read off the page:
   * the element's `--seismic-*` properties exist only once the space's stylesheet has reached it.
   */
  useEffect(() => {
    const node = host.current;
    const colours = probe.current;
    if (!node || !colours) {
      return undefined;
    }

    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let popup: MapLibre.Popup | undefined;

    void import('maplibre-gl').then(library => {
      // The effect may have been torn down while the module was in flight — a route change, a remount — and creating
      // a map on a node React has already dropped leaks the whole instance and its GPU context.
      if (cancelled) {
        return;
      }

      library.setWorkerUrl(workerUrl);
      const map = new library.Map({
        container: node,
        style: style(readPalette(colours), projectionOf(latest.current.projection)),
        center: HOME_CENTER,
        zoom: homeZoom(node),
        minZoom: 0.8,
        maxZoom: 9,
        // The data credits are in the space's legend, where the reader looks for them — not in a control that sits
        // under the display's own furniture.
        attributionControl: false,
        // One Earth. A second copy of the world with no events on it is a display that has scrolled off its data.
        renderWorldCopies: false
      });

      // The centre is the centre of what the panels leave clear, not of the box.
      map.setPadding(clearArea(node));
      libraryRef.current = library;
      mapRef.current = map;
      popup = new library.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'seismic__tip',
        offset: 14,
        maxWidth: 'none'
      });

      const touch = (): void => {
        lastTouched.current = performance.now();
        handsOn.current = lastTouched.current;
      };

      map.on('mousedown', touch);
      map.on('touchstart', touch);
      map.on('wheel', touch);

      /**
       * A click resolves to the largest event under it, in a box rather than at a point: a M2 is a few pixels wide, and
       * a target a finger cannot hit is not a target. The sea deselects — but only something that was selected, so
       * panning around an empty map does not start a flow on every click.
       */
      map.on('click', event => {
        const { x, y } = event.point;
        const hits = map.queryRenderedFeatures(
          [
            [x - 8, y - 8],
            [x + 8, y + 8]
          ],
          { layers: [LAYERS.quake] }
        );
        const { quakes: current, selectedId: selected, fire: emit } = latest.current;
        const found = hits
          .map(hit => current.find(quake => quake.id === hit.properties.id))
          .filter((quake): quake is MapQuake => quake !== undefined && quake.time <= clock.current)
          .sort((a, b) => b.magnitude - a.magnitude)
          .at(0);

        if (found) {
          emit('onQuakeSelect', payloadOf(found));
        } else if (selected) {
          emit('onQuakeSelect', { id: '', magnitudeLabel: '', region: '' });
        }
      });

      map.on('mousemove', event => {
        if (cursor.current) {
          cursor.current.textContent = formatCursor(event.lngLat.lng, event.lngLat.lat);
        }
      });

      map.on('mousemove', LAYERS.quake, event => {
        const hit = event.features?.[0];
        const quake = latest.current.quakes.find(entry => entry.id === hit?.properties.id);
        map.getCanvas().style.cursor = 'pointer';
        if (quake && popup) {
          popup.setLngLat([quake.longitude, quake.latitude]).setDOMContent(tooltip(quake)).addTo(map);
        }
      });

      map.on('mouseleave', LAYERS.quake, () => {
        map.getCanvas().style.cursor = '';
        popup?.remove();
      });

      map.on('load', () => {
        setData(map, SOURCES.graticule, graticule());
        setReady(true);
      });

      /**
       * The box belongs to the page, not to this element. A map measures its container once, and this one is sized by
       * CSS the SPACE owns, so the first measurement can land before the layout that decides it. Watching the box
       * covers the first paint, a window resize and a panel beside it changing width.
       */
      observer = new ResizeObserver(() => map.resize());
      observer.observe(node);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      popup?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [workerUrl]);

  /** The world, once it has arrived. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !world) {
      return;
    }

    setData(map, SOURCES.land, world.land);
    setData(map, SOURCES.borders, world.borders);
    setData(map, SOURCES.plates, world.plates);
  }, [ready, world]);

  /**
   * The events, and the ones among them that just arrived.
   *
   * The first answer for a feed is primed silently — none of it arrived while anybody was watching. After that, an id
   * the map has not seen before throws out a shockwave if it is on screen, and — when it reaches `alertMagnitude` — is
   * announced with `onQuakeArrival`, the largest first. What the page does with the news is the page's: a toast, a
   * flight to it, or nothing.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) {
      return;
    }

    setData(map, SOURCES.quakes, quakeFeatures(quakes));

    const ids = new Set(quakes.map(quake => quake.id));
    const previous = seen.current;
    seen.current = { key: feedKey, ids };
    if (!previous || previous.key !== feedKey) {
      return;
    }

    const arrived = quakes.filter(quake => !previous.ids.has(quake.id)).sort((a, b) => b.magnitude - a.magnitude);
    arrived.filter(onScreen).forEach(burst);
    arrived
      .filter(quake => quake.magnitude >= latest.current.alertFrom)
      .slice(0, MAX_ANNOUNCED)
      .forEach((quake, index) => {
        // The largest of the refresh leads: it is the one a space locks on, the rest are announced.
        fire('onQuakeArrival', { ...payloadOf(quake), lead: index === 0 });
        // Read when the time is up, not now: the flow that locks on it runs after this, and the reader may move on.
        const timer = window.setTimeout(() => {
          onStage.current.delete(timer);
          if (latest.current.selectedId === quake.id) {
            latest.current.fire('onArrivalSettled', { id: quake.id });
          }
        }, latest.current.arrivalMs);
        onStage.current.add(timer);
      });
  }, [ready, quakes, feedKey, burst, fire, onScreen]);

  /**
   * A ring that keeps pulsing on every event logged in the feed's last hour — drawn on the globe (see `PULSE_PHASE`).
   *
   * One number moved a frame, and only while there is a fresh event to pulse: an empty last hour costs nothing. Still
   * under `prefers-reduced-motion`, where the ring stays, half grown. Hidden during a replay, which has its own clock.
   */
  const pulsing = useMemo(() => quakes.some(quake => quake.isFresh), [quakes]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) {
      return undefined;
    }

    map.setLayoutProperty(LAYERS.pulse, 'visibility', isReplaying || !pulsing ? 'none' : 'visible');
    if (isReplaying || !pulsing) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      map.setGlobalStateProperty(PULSE_PHASE, 0.5);

      return undefined;
    }

    let frame = 0;
    const beat = (now: number): void => {
      const phase = (now % PULSE_MS) / PULSE_MS;
      // Out fast, then slowing as it fades: the shape of a wave leaving the point it started from.
      map.setGlobalStateProperty(PULSE_PHASE, 1 - (1 - phase) ** 2);
      frame = requestAnimationFrame(beat);
    };
    frame = requestAnimationFrame(beat);

    return () => cancelAnimationFrame(frame);
  }, [ready, pulsing, isReplaying]);

  /** The magnitude floor and the depth band, applied on the GPU to every layer that draws an event. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) {
      return;
    }

    QUAKE_LAYERS.forEach(layer => map.setFilter(layer, quakeFilter(floor, depthBand)));
    map.setFilter(LAYERS.pulse, pulseFilter(floor, depthBand));
  }, [ready, floor, depthBand]);

  /**
   * The lock: the selected event's reticle, its range rings and a flight to it.
   *
   * Rebuilt only when the SELECTION changes. The events are replaced wholesale on every refresh, and a reticle
   * rebuilt with them would restart its lock-on animation every thirty seconds under a reader who has not moved.
   */
  useEffect(() => {
    const map = mapRef.current;
    const library = libraryRef.current;
    if (!ready || !map || !library) {
      return;
    }

    const quake = quakes.find(entry => entry.id === selectedId);
    const target = quake ? `${quake.id}@${quake.longitude},${quake.latitude}` : '';
    if (target === lock.current.target) {
      return;
    }

    lock.current.markers.forEach(marker => marker.remove());
    lock.current = { target, markers: [] };
    map.setFilter(LAYERS.selected, ['==', ['get', 'id'], quake?.id ?? '']);
    if (!quake) {
      setData(map, SOURCES.rings, EMPTY_COLLECTION);

      return;
    }

    setData(map, SOURCES.rings, rangeRings(quake.longitude, quake.latitude));
    lock.current.markers = [
      new library.Marker({ ...ON_SURFACE, element: reticle(quake), subpixelPositioning: true }).setLngLat([
        quake.longitude,
        quake.latitude
      ]),
      ...RANGE_RINGS_KM.map(distance =>
        new library.Marker({ ...ON_SURFACE, element: ringLabel(distance), anchor: 'top-right' }).setLngLat(
          ringLabelPosition(quake.longitude, quake.latitude, distance)
        )
      )
    ].map(marker => marker.addTo(map));

    lastTouched.current = performance.now();
    map.flyTo({
      center: [quake.longitude, quake.latitude],
      zoom: Math.max(map.getZoom(), 3.6),
      padding: focusPadding(map.getContainer()),
      speed: 0.9,
      curve: 1.6,
      essential: true
    });
  }, [ready, quakes, selectedId]);

  /**
   * Every change of the lock, whoever made it — a click, a row of the log, an arrival, the tour — said once.
   *
   * A space that wants to do something about "the map is looking at this event now" hangs ONE flow here, instead of
   * repeating it in every place that can select an event.
   */
  const announced = useRef(selectedId);
  useEffect(() => {
    if (announced.current === selectedId) {
      return;
    }

    announced.current = selectedId;
    fire('onLock', { id: selectedId });
  }, [selectedId, fire]);

  /**
   * The locked event's shaking: its ShakeMap contours and a numeral on each whole level.
   *
   * Drawn only when the contours are the locked event's own — they arrive from a request, and the reader may have moved
   * on before it answered.
   */
  const shakingMarkers = useRef<MapLibre.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    const library = libraryRef.current;
    if (!ready || !map || !library) {
      return;
    }

    shakingMarkers.current.forEach(marker => marker.remove());
    shakingMarkers.current = [];
    const shown = contours?.id === selectedId ? contours : undefined;
    setData(map, SOURCES.shaking, shown ? shakingFeatures(shown) : EMPTY_COLLECTION);
    if (!shown) {
      return;
    }

    shakingMarkers.current = shakingLabels(shown).map(({ mmi, position }) =>
      new library.Marker({ ...ON_SURFACE, element: shakingLabel(mmi) }).setLngLat([position[0], position[1]]).addTo(map)
    );

    // Frame the shaking: an M5's contours are a blot under the reticle at the lock's zoom, an M7's run off the screen.
    const bounds = shakingBounds(shown);
    if (bounds) {
      lastTouched.current = performance.now();
      map.fitBounds(bounds, { padding: focusPadding(map.getContainer()), maxZoom: 6.5, duration: 1600 });
    }
  }, [ready, contours, selectedId]);

  /**
   * The tour: the window's strongest events, one after another, for a display nobody is driving.
   *
   * The map does not select anything itself — it says which event is next (`onTourStep`) and the space selects it,
   * so a tour stop is the same lock, dossier and shaking as a click. A reader who grabs the map ends it (`onTourEnd`).
   * The stops are read afresh at each step, so a refresh or a filter changed mid-tour is honoured at the next one.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !touring) {
      return undefined;
    }

    let visited = 0;
    let timer = 0;
    tourTrack.current?.style.setProperty('--seismic-tour-ms', `${stopMs}ms`);
    const step = (): void => {
      timer = window.setTimeout(step, stopMs);
      const stops = latest.current.quakes
        .filter(onScreen)
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, TOUR_STOPS);
      if (!stops.length) {
        return;
      }

      const index = visited % stops.length;
      visited += 1;
      const stop = `${index + 1} / ${stops.length}`;
      if (tourStop.current) {
        tourStop.current.textContent = stop;
      }

      // A fresh bar restarts its CSS animation: one stop's time, filling.
      const progress = document.createElement('span');
      progress.className = 'seismic__tour-progress';
      tourTrack.current?.replaceChildren(progress);
      latest.current.fire('onTourStep', { ...payloadOf(stops[index]), stop });
    };
    const end = (): void => latest.current.fire('onTourEnd', {});
    map.on('mousedown', end);
    map.on('touchstart', end);
    map.on('wheel', end);
    step();

    return () => {
      window.clearTimeout(timer);
      map.off('mousedown', end);
      map.off('touchstart', end);
      map.off('wheel', end);
    };
  }, [ready, touring, stopMs, onScreen]);

  /** Nobody at the page for `idleSeconds`: said once, and again only after somebody came back and left. */
  useEffect(() => {
    if (!idleMs) {
      return undefined;
    }

    let last = Date.now();
    let told = false;
    const active = (): void => {
      last = Date.now();
      told = false;
    };
    ACTIVITY_EVENTS.forEach(type => window.addEventListener(type, active, { passive: true }));
    const check = window.setInterval(() => {
      if (!told && Date.now() - last >= idleMs) {
        told = true;
        latest.current.fire('onIdle', {});
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach(type => window.removeEventListener(type, active));
      window.clearInterval(check);
    };
  }, [idleMs]);

  /**
   * A projection switch keeps what the reader was looking at: the locked event if there is one, the whole view if not.
   *
   * Left where it was, a globe zoomed on Tonga becomes a flat map of empty ocean at the same zoom — the camera numbers
   * mean different things in the two projections.
   */
  const shape = useRef(projectionOf(projection));
  useEffect(() => {
    const map = mapRef.current;
    const next = projectionOf(projection);
    if (!ready || !map || shape.current === next) {
      return;
    }

    shape.current = next;
    map.setProjection({ type: next });
    const locked = latest.current.quakes.find(quake => quake.id === latest.current.selectedId);
    if (!locked) {
      resetView();

      return;
    }

    map.flyTo({
      center: [locked.longitude, locked.latitude],
      zoom: 3.6,
      padding: focusPadding(map.getContainer()),
      essential: true
    });
  }, [ready, projection, resetView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) {
      return;
    }

    const plates = flag(showPlates, true) ? 'visible' : 'none';
    PLATE_LAYERS.forEach(layer => map.setLayoutProperty(layer, 'visibility', plates));
    map.setLayoutProperty(LAYERS.heat, 'visibility', flag(showHeat, false) ? 'visible' : 'none');
  }, [ready, showPlates, showHeat]);

  /**
   * A theme switch, reaching a canvas that cannot see CSS change.
   *
   * Read a frame late: the scheme arrives as a prop in the same render that flips the page's theme, and the custom
   * properties the palette is read from change when that render is committed — not before.
   */
  useEffect(() => {
    const map = mapRef.current;
    const colours = probe.current;
    if (!ready || !map || !colours) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => applyPalette(map, readPalette(colours)));

    return () => cancelAnimationFrame(frame);
  }, [ready, scheme]);

  /**
   * The display left running: the globe turns while nobody is touching it and nothing is locked.
   *
   * Paused by any touch for a few seconds rather than switched off, and never on a flat map, where turning is
   * scrolling sideways off the data. `prefers-reduced-motion` keeps it still.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !rotating || prefersReducedMotion()) {
      return undefined;
    }

    let frame = 0;
    let previous = performance.now();
    const turn = (now: number): void => {
      const elapsed = now - previous;
      previous = now;
      const { selectedId: selected, projection: shape } = latest.current;
      const idle = now - lastTouched.current > IDLE_BEFORE_ROTATING_MS && !map.isMoving();
      if (idle && !selected && projectionOf(shape) === 'globe') {
        const center = map.getCenter();
        map.setCenter([center.lng - (ROTATION_SPEED * elapsed) / 1000, center.lat]);
      }

      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);

    return () => cancelAnimationFrame(frame);
  }, [ready, rotating]);

  /**
   * The window, replayed: every event appears in the order it happened, compressed into `replaySeconds`.
   *
   * The clock is map state that the paint reads (see `REPLAY_CLOCK`), so this loop moves one number a frame. Events
   * above M3.5 throw out a shockwave as the clock passes them, and the camera goes after them — the same flight a pick
   * makes, to the largest event passed since the last one, every few seconds. A reader who grabs the map keeps it: the
   * camera waits until they let go. When the clock reaches the end the map says so with `onReplayEnd`, and the space
   * decides what that means — here, putting its button back.
   */
  useEffect(() => {
    const map = mapRef.current;
    // The events as they are when the replay STARTS: a refresh landing halfway through must not restart it.
    const ordered = [...latest.current.quakes].sort((a, b) => a.time - b.time);
    if (!ready || !map || !replaying || ordered.length === 0) {
      return undefined;
    }

    const start = ordered[0].time;
    const end = ordered[ordered.length - 1].time;
    const duration = numeric(replaySeconds, 24) * 1000;
    const reduced = prefersReducedMotion();
    let next = 0;
    let shocks = 0;
    let frame = 0;
    let began = 0;
    let lastFlight = 0;
    let target: MapQuake | undefined;

    const follow = (now: number): void => {
      if (!target || now - lastFlight < REPLAY_FLIGHT_MS || now - handsOn.current < HANDS_OFF_MS) {
        return;
      }

      lastFlight = now;
      lastTouched.current = now;
      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: 3.2,
        padding: clearArea(map.getContainer()),
        speed: 1.1,
        curve: 1.5,
        essential: true
      });
      target = undefined;
    };

    setIsReplaying(true);
    const step = (now: number): void => {
      began ||= now;
      const progress = Math.min((now - began) / duration, 1);
      const until = start + (end - start) * progress;
      clock.current = until;
      map.setGlobalStateProperty(REPLAY_CLOCK, until);

      while (next < ordered.length && ordered[next].time <= until) {
        const quake = ordered[next];
        next += 1;
        if (!onScreen(quake)) {
          continue;
        }

        if (!target || quake.magnitude > target.magnitude) {
          target = quake;
        }

        if (!reduced && quake.magnitude >= REPLAY_SHOCK_MAGNITUDE && shocks < MAX_REPLAY_SHOCKS) {
          shocks += 1;
          burst(quake);
          window.setTimeout(() => (shocks -= 1), SHOCKWAVE_MS);
        }
      }

      follow(now);

      if (replayClock.current) {
        replayClock.current.textContent = replayTime(until);
      }

      if (replayProgress.current) {
        replayProgress.current.style.transform = `scaleX(${progress})`;
      }

      if (progress < 1) {
        frame = requestAnimationFrame(step);

        return;
      }

      latest.current.fire('onReplayEnd', {});
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      clock.current = Number.MAX_SAFE_INTEGER;
      map.setGlobalStateProperty(REPLAY_CLOCK, null);
      setIsReplaying(false);
    };
  }, [ready, replaying, replaySeconds, burst, onScreen]);

  /** The declared camera actions, with what only a mounted element has: the functions that do them. */
  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      resetView: { ...declaration.callbacks.resetView, callback: resetView },
      zoomIn: { ...declaration.callbacks.zoomIn, callback: () => zoomBy(1) },
      zoomOut: { ...declaration.callbacks.zoomOut, callback: () => zoomBy(-1) },
      pan: { ...declaration.callbacks.pan, callback: pan }
    }),
    [resetView, zoomBy, pan]
  );

  return (
    <RootElement
      tag="div"
      className={className}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={interactionCallbacks}
    >
      <div
        ref={host}
        className="seismic__canvas"
        role="application"
        aria-label={`World seismic map, ${quakes.length} events in the window`}
      />
      <span ref={probe} className="seismic__probe" aria-hidden="true" />
      <div className="seismic__cursor" aria-hidden="true" data-hidden={isReplaying || touring}>
        <span className="seismic__cursor-label">CURSOR</span>
        <span ref={cursor}>—</span>
      </div>
      <div className="seismic__replay" role="status" data-active={isReplaying}>
        <span className="seismic__replay-label">REPLAY</span>
        <span ref={replayClock} className="seismic__replay-clock" />
        <span className="seismic__replay-track">
          <span ref={replayProgress} className="seismic__replay-progress" />
        </span>
      </div>
      <div className="seismic__tour" role="status" data-active={touring}>
        <span className="seismic__tour-label">TOUR</span>
        <span ref={tourStop} className="seismic__tour-stop" />
        <span ref={tourTrack} className="seismic__tour-track" />
      </div>
    </RootElement>
  );
};

export default SeismicMap;
