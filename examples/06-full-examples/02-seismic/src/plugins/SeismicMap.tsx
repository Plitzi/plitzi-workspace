import { RootElement, useRscRefresh, useStore } from '@plitzi/plitzi-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import 'leaflet/dist/leaflet.css';

import type * as Leaflet from 'leaflet';

/**
 * The map, and the only element this space ships itself.
 *
 * **Why this is a plugin and not a stack of containers.** A position on the Earth is a PROJECTION and a magnitude
 * is an AREA: neither can be arranged out of boxes, and a grid of absolutely-positioned divs standing in for one
 * gives you a picture nobody can pan, zoom or click. That is the line — a space ships an element of its own when
 * the thing it wants to show is not text in a box.
 *
 * **It uses a map library, because a map is a solved problem.** Leaflet and a tile server give a real projection,
 * real panning and a real zoom for a few kilobytes; a hand-drawn wireframe of the continents gives an approximation
 * nobody can navigate. The tiles are CARTO's dark basemap — no key, no account, and dark to begin with, so the
 * display is not a light map with a filter over it.
 *
 * **Leaflet is imported inside the effect, not at the top.** It reaches for `window` as it loads, and this element
 * is rendered on the server too — a static import makes the whole module unloadable there, and the page then
 * renders with a hole in it where the map should be. Loaded from the effect it cannot run anywhere there is no
 * document, which is exactly the rule.
 *
 * **It is still an element like any other.** The events arrive as an attribute, so the page binds them to the same
 * server action the readouts read; it holds no URL of its own and asks nobody for data. What it DOES own is the
 * two things only it can know: which event the pointer is on, and when what it was handed is old enough to ask
 * for again.
 */

export type MapQuake = {
  id: string;
  place: string;
  region: string;
  magnitude: number;
  magnitudeLabel: string;
  depthKm: number;
  depthLabel: string;
  latitude: number;
  longitude: number;
  time: number;
  significance: number;
  tsunami: boolean;
  url: string;
};

export type SeismicMapProps = {
  /** The events to plot. An array from a binding; JSON text when somebody typed it into the builder. */
  events?: MapQuake[] | string;
  /**
   * How often to ask the server for a fresh answer, in seconds. `0` never asks.
   *
   * The refresh re-runs the RENDER action — the same one that built the page — so the browser still never talks to
   * the USGS, and the answer is still shared between everyone watching.
   */
  refreshSeconds?: number;
  /**
   * The `runtime.state` key the selected event is written to, so the rest of the page can bind to it.
   *
   * The map is the only thing that knows what the pointer is on, and the panel that describes an event is an
   * ordinary container authored in `space.ts`. This is the seam between them, and it is the same one an
   * interaction's `setState` writes — nothing here is private to plugins.
   */
  selectionKey?: string;
  /**
   * Where the view starts, before there is anything to frame.
   *
   * Only ever seen for the instant between the map appearing and the first batch being drawn: once there are
   * events the view is fitted to THEM, which is the right answer for every window at once — a day of small
   * events frames wherever they happened, a month of M4.5+ frames the Pacific.
   */
  centerLatitude?: number;
  centerLongitude?: number;
  zoom?: number;
};

/**
 * No key and no account, and dark before anything is done to it.
 *
 * The unlabelled basemap on purpose: CARTO's label layer renders every name in whatever languages the source has
 * for it, so a display of it reads "AFRIKA / أفريقيا" and "AMÉRICA DO SUL;AMÉRICA DEL SUR". A coastline is all
 * the reference this needs — the panels say what the events are, and the names were noise over the data.
 */
const TILES = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO · USGS';

/**
 * Depth is what decides whether an earthquake is felt, so it is what the display encodes as colour.
 *
 * A magnitude 6 at 15 km flattens a town; the same magnitude at 500 km is an instrument reading. Sizing by
 * magnitude and colouring by depth puts both facts in one glyph.
 */
const depthBand = (depthKm: number): string => {
  if (depthKm < 33) {
    return 'shallow';
  }

  if (depthKm < 70) {
    return 'upper';
  }

  return depthKm < 300 ? 'mid' : 'deep';
};

/**
 * Area with magnitude, not radius.
 *
 * The scale is logarithmic in energy already, so a linear radius makes every event above M6 a blot that covers the
 * coastline under it. Square-rooting keeps a M7 visibly four times the AREA of a M5 and leaves a busy day legible.
 */
const radiusFor = (magnitude: number): number => 3 + Math.sqrt(Math.max(magnitude, 0)) * 3.2;

/** A binding hands over the array; a value typed into the builder arrives as text. Both have to work. */
const toEvents = (events: MapQuake[] | string | undefined): MapQuake[] => {
  if (Array.isArray(events)) {
    return events;
  }

  if (typeof events !== 'string' || !events.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(events);

    return Array.isArray(parsed) ? (parsed as MapQuake[]) : [];
  } catch {
    return [];
  }
};

const SeismicMap = ({
  events,
  refreshSeconds = 60,
  selectionKey = 'selected',
  centerLatitude = 10,
  centerLongitude = 170,
  zoom = 3
}: SeismicMapProps) => {
  const records = useMemo(() => toEvents(events), [events]);
  const refresh = useRscRefresh();
  const [, setSelection] = useStore(`runtime.state.${selectionKey}` as 'runtime.state');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  /** Fitted once per mount. Re-fitting on every refresh would drag the view out from under a reader. */
  const framed = useRef(false);
  /** Flips once the map exists, so the effect that draws the events runs again when it does. */
  const [ready, setReady] = useState(false);

  const select = useCallback(
    (quake: MapQuake | null) => {
      setSelectedId(quake?.id ?? null);
      // Written whole rather than field by field: the panel that draws it binds to `state.selected.<field>`, and a
      // half-written object is a panel showing one event's magnitude beside another's location.
      setSelection(quake ?? {});
    },
    [setSelection]
  );

  /**
   * The map itself, created once.
   *
   * In an effect and not in the render, because Leaflet needs a DOM node and this element is rendered on the
   * server as well — the page arrives with the readouts already filled in and the map builds itself once the
   * markup exists. `zoomControl` is off: the display has its own furniture and Leaflet's belongs to a document.
   */
  useEffect(() => {
    if (!host.current || map.current) {
      return undefined;
    }

    let cancelled = false;
    const node = host.current;

    void import('leaflet').then(module => {
      const L = module.default;
      // The effect may have been torn down while the module was in flight — a route change, a re-render — and
      // creating a map on a node React has already dropped leaks the whole instance and its tile requests.
      if (cancelled) {
        return;
      }

      const instance = L.map(node, {
        center: [centerLatitude, centerLongitude],
        zoom,
        minZoom: 2,
        maxZoom: 8,
        // The display has its own furniture; Leaflet's belongs to a document.
        zoomControl: false,
        scrollWheelZoom: true,
        // Panning sideways stays inside one Earth: a second copy of the world with no events on it is a display
        // that has quietly scrolled off its own data.
        worldCopyJump: true,
        maxBounds: [
          [-90, -180],
          [90, 180]
        ],
        maxBoundsViscosity: 0.9
      });

      L.tileLayer(TILES, {
        attribution: ATTRIBUTION,
        maxZoom: 10,
        className: 'seismic__tiles'
      }).addTo(instance);

      leaflet.current = L;
      layer.current = L.layerGroup().addTo(instance);
      map.current = instance;

      // Clicking the sea is how you put the detail panel away again.
      instance.on('click', () => select(null));

      /**
       * The box belongs to the page, not to this element.
       *
       * A map measures its container once, when it is created, and this one is sized by CSS the SPACE owns — so
       * the first measurement can land before the layout that decides how big it is, and the view opens centred on
       * the wrong meridian with a strip of nothing down one side. Watching the box is the only reliable answer:
       * it covers the first paint, a window resize, and a panel beside it changing width.
       */
      const resize = new ResizeObserver(() => instance.invalidateSize({ animate: false }));
      resize.observe(node);
      observer.current = resize;

      setReady(true);
    });

    return () => {
      cancelled = true;
      observer.current?.disconnect();
      observer.current = null;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      setReady(false);
    };
  }, [centerLatitude, centerLongitude, zoom, select]);

  /**
   * The events, redrawn whenever the server answers again.
   *
   * The whole layer is cleared and refilled rather than diffed: a batch is at most a few hundred circles, the feed
   * replaces it wholesale every time, and matching them up by id would be more code than it saves.
   */
  useEffect(() => {
    const group = layer.current;
    const L = leaflet.current;
    if (!group || !L) {
      return;
    }

    group.clearLayers();

    /**
     * Open framed on the events, not on a fixed meridian.
     *
     * Which corner of the world matters depends entirely on the window: a day of everything is mostly California
     * and Alaska, a month of M4.5+ is the Ring of Fire. Fitting the first batch answers all of them, and it is
     * done ONCE — re-framing on every refresh would drag the view out from under somebody reading it.
     */
    if (!framed.current && records.length > 0 && map.current) {
      map.current.fitBounds(
        L.latLngBounds(records.map(quake => [quake.latitude, quake.longitude] as [number, number])),
        { padding: [60, 60], animate: false }
      );
      framed.current = true;
    }

    // Newest of the batch, which is what "new" is measured against — not the wall clock, which would mark
    // everything old between refreshes and everything new after one.
    const newest = records.reduce((latest, quake) => Math.max(latest, quake.time), 0);

    // Largest last, so a big event is drawn over the small ones around it rather than under them.
    [...records]
      .sort((a, b) => a.magnitude - b.magnitude)
      .forEach(quake => {
        const fresh = newest > 0 && newest - quake.time < 20 * 60 * 1000;
        /**
         * The band goes in the CLASS, and the colour comes from CSS.
         *
         * Not through Leaflet's `color`/`fillColor`, which it writes as SVG presentation attributes: a `var()` in
         * one of those resolves in Chrome and in nothing else, so elsewhere every circle rendered with no fill at
         * all — invisible, and with no surface for a click to land on. In a CSS rule the same custom property
         * resolves everywhere, and this file still ships no colours of its own.
         */
        /**
         * An event that arrived while somebody was watching gets a RING of its own, behind the dot.
         *
         * Animating the marker was the obvious way and the wrong one: the pulse fades to nothing, so the dot it
         * was drawn on vanished twice a second — which does not read as "this is new", it reads as a display with
         * a fault. A separate ring leaves the event solidly on screen and puts the movement around it.
         */
        if (fresh) {
          group.addLayer(
            L.circleMarker([quake.latitude, quake.longitude], {
              radius: radiusFor(quake.magnitude),
              className: `seismic__ping seismic__quake--${depthBand(quake.depthKm)}`,
              interactive: false,
              weight: 1.5
            })
          );
        }

        const marker = L.circleMarker([quake.latitude, quake.longitude], {
          radius: radiusFor(quake.magnitude),
          className: [
            'seismic__quake',
            `seismic__quake--${depthBand(quake.depthKm)}`,
            quake.id === selectedId ? 'seismic__quake--active' : ''
          ]
            .filter(Boolean)
            .join(' '),
          weight: 1,
          // This is the only way into the detail panel, so it has to be a target rather than a decoration.
          interactive: true,
          bubblingMouseEvents: false
        });

        marker.bindTooltip(`${quake.magnitudeLabel} · ${quake.region}`, {
          direction: 'top',
          className: 'seismic__tip',
          opacity: 1
        });
        /**
         * Click, not hover.
         *
         * A detail panel that follows the pointer changes under you every time you cross the map to reach
         * something, and it says nothing at all on a touch screen. Pressing an event is a decision; the tooltip
         * above is what hovering is for.
         */
        marker.on('click', () => select(quake.id === selectedId ? null : quake));
        group.addLayer(marker);
      });
  }, [records, ready, select, selectedId]);

  // Ask again while the page is open. Cleared on unmount AND re-armed when the period changes, so a space that
  // lowers it does not leave the old timer running beside the new one.
  useEffect(() => {
    if (!refreshSeconds) {
      return undefined;
    }

    const timer = setInterval(() => void refresh(), refreshSeconds * 1000);

    return () => clearInterval(timer);
  }, [refresh, refreshSeconds]);

  return (
    <RootElement tag="div">
      <div
        ref={host}
        className="seismic__canvas"
        role="application"
        aria-label={`World seismic map, ${records.length} events plotted`}
      />
    </RootElement>
  );
};

export default SeismicMap;
