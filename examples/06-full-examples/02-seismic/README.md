# Tremor — a live global seismic monitor

Every earthquake the USGS has published, on one screen: a real map you can pan and zoom, a column of the latest
events, and a readout that says what the window holds. It refreshes itself while you watch.

```bash
yarn workspace @plitzi/example-seismic start
# http://127.0.0.1:4014/
```

No account, no database, no API key. The whole deployment is a space, one server task and one action document.

---

## What this example is for

The blog next door is about **pages** — routes, sessions, who may publish. This one is about the other half:
**one screen, live data, and an element the SDK does not ship.** It is the shortest full example in the repository
because there is nothing to sign into, and almost all of it is the three files below.

| File | What it is |
| --- | --- |
| [`src/feed.ts`](./src/feed.ts) | The USGS feed, reshaped into what a page can draw |
| [`src/tasks.ts`](./src/tasks.ts) | That, registered as a step this deployment's flows can chain |
| [`src/actions.ts`](./src/actions.ts) | The action document: a `render` trigger, the task, the answer |
| [`src/space.ts`](./src/space.ts) | The screen — the map layer, the overlay, and every class it wears |
| [`src/plugins/SeismicMap.tsx`](./src/plugins/SeismicMap.tsx) | The map, which is an element like any other |

---

## The browser never talks to the USGS

The provider is an `apiContainer` with `runtime: 'server'` naming the action, so the feed is fetched **while the
page is being built**. The HTML arrives with the events already in it: nothing to load after the paint, no request
from the browser, and the USGS never learns who is watching.

`cacheSeconds: 30` on the trigger is what makes a public monitor affordable. A render answer is **shared** — one
run answers everyone asking at that moment — and the feed itself only regenerates once a minute, so asking more
often buys nothing and costs one outbound request per visitor.

Then the map asks again on a timer, through `useRscRefresh`:

```ts
useEffect(() => {
  const timer = setInterval(() => void refresh(), refreshSeconds * 1000);

  return () => clearInterval(timer);
}, [refresh, refreshSeconds]);
```

That re-runs the same **render** action, so live data does not mean a second endpoint, a second contract, or a
credential in the page. It is the page asking the server for its own data again.

---

## Reshaping is a task, not a template

GeoJSON is a transport format: a `features` array of coordinate triples and a properties bag of eighteen fields.
A map needs six of them, in the units it draws in. That is real work, so it is a **task** — a twig expression
pretending to flatten GeoJSON would be a worse example than the honest version.

A task is the extension point a deployment owns. Registered in `main.ts`, offered in the builder's step catalogue,
and addressed from a document as `seismic.feed`.

The task also formats. `magnitudeLabel` is `"M4.6"` and `depthLabel` is `"10 km"`, because a plot wants numbers and
a column wants units — computed once on the server so every visitor reads the same string.

And it answers `isDay` / `isWeek` / `isMonth`. A binding shows an element when a field is true; it cannot compare
two values. So the range control is **two chips per range** and the data decides which one is on screen.

Each chip also states its magnitude floor — `ALL`, `M2.5+`, `M4.5+` — because the three ranges are three different
datasets rather than three lengths of the same one. Without that on the control, switching from the week to the
month looks like a fault: a M3 in California is on one and gone from the other, and nothing says why.

---

## The map is an element, and it uses a map library

A position on the Earth is a projection and a magnitude is an area. Neither can be arranged out of containers, so
this is the case for a space shipping an element of its own — and inside it, Leaflet, because a map is a solved
problem. The tiles are CARTO's dark basemap: no key, no account, dark to begin with.

Three things about it are worth copying:

- **It declares `runtime: 'client'`.** A map library needs a document, so there is nothing the server could
  usefully produce. Saying so is better than letting it try.
- **Leaflet is imported inside the effect.** It reaches for `window` as it loads, and a static import makes the
  whole module unloadable on the server.
- **It ships no colours.** Every one comes from the space's custom properties, so the display is re-themed from
  `space.ts`. They are applied as CSS rather than through Leaflet's colour options — those become SVG presentation
  attributes, where a custom property resolves in Chrome and nowhere else.

The view is **fitted to the events** rather than to a fixed meridian: which corner of the world matters depends
entirely on the window, and a day of small events is mostly California while a month of M4.5+ is the Ring of Fire.

---

## How the map talks to the page

The map is the only thing that knows what the pointer is on. The panel that describes an event is an **ordinary
container** authored in `space.ts`. Between them is one line each way:

```ts
// In the element
setSelection(quake ?? {});

// In the space
container({ class: selectionPanel, visible: 'state.selected.id', children: [ … ] })
```

`runtime.state` is the same seam an interaction's `setState` writes through. Nothing about the plugin is private,
and the panel is not part of it.

---

## The classes live where they are used

This space is one screen, so the rule for a readout is declared next to the readout with `styles()`:

```ts
const panel = styles('panel', { 'background-color': 'var(--panel)', border: '1px solid var(--edge)', … });

container({ class: panel, children: [ … ] })
```

One selector, however many elements name it. `theme.ts` keeps only the two things that cannot be co-located: the
palette, and the internals of the map element, which renders markup no class in the space can reach.

---

## Where the data comes from

[USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — public domain,
no key, regenerated every minute. The threshold rises with the range on purpose: a day of everything is a few
hundred events, a month of everything is tens of thousands, and a map of that is the same map with the coastlines
buried. So a week drops what is under M2.5 and a month what is under M4.5 — and each chip says so, because a
control that quietly changes what it is counting is a control nobody can trust.

A ring around a marker means the event was logged in the last twenty minutes. It is the only animation on the map
that carries information, and the key says so.
