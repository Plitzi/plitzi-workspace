# Tremor — a live global seismic monitor

Every earthquake the USGS publishes, on a WebGL globe you can spin, zoom and flatten: size is magnitude, colour is
focal depth, plate boundaries are drawn by kind. Around it, a heads-up display that filters, counts, explains and
replays the window — and locks on to any event you pick.

```bash
yarn workspace @plitzi/example-seismic start
# http://127.0.0.1:4014/
```

No account, no database, no API key, no tile server. The whole deployment is a space, one server task, one action
document and one element of the space's own.

---

## What this example is for

The blog next door is about **pages** — routes, sessions, who may publish. This one is about the other half: **one
screen, live data, and an element the SDK does not ship, wired to everything else by the space.** It is the example to
read for how far a space goes before you write a component, and for how a component you did write talks to it.

| File | What it is |
| --- | --- |
| [`src/feed.ts`](./src/feed.ts) | The USGS feed, reshaped into what the page draws — with every total counted per magnitude floor |
| [`src/tasks.ts`](./src/tasks.ts) · [`src/actions.ts`](./src/actions.ts) | That, registered as a task, and the `render` action that runs it |
| [`src/space/`](./src/space) | The display: one file per panel, the state it keeps, its palette and its CSS |
| [`src/plugins/SeismicMap/`](./src/plugins/SeismicMap) | The globe — component, declaration, layers, overlays |
| [`scripts/geography.ts`](./scripts/geography.ts) | Writes `public/geo/world.json`: coastlines, borders and plate boundaries |

---

## What Plitzi does here, and what the component does

The globe is the only code that draws. Everything else on the screen is **authored**: 270-odd elements in
`src/space`, checked by `authorSpace` with zero warnings.

| On screen | How |
| --- | --- |
| Data in the first paint | `apiContainer` with `runtime: 'server'` naming a `render` action — the HTML ships with the window in it |
| Live | `refreshSeconds` on that provider, **bound** to the reader's choice (10 · 30 · 60 s · pause): the provider re-arms itself |
| Window (1H · 24H · 7D · 30D) | Links to `/?window=…`; the render action reads the query string. The page never reloads |
| Magnitude · depth filters | `state.floor` / `state.depth`, read through `computed`; one twig predicate every panel shares |
| Counters, activity strip | Counted by the server under every magnitude × depth, picked with `stats[computed.floor][computed.depth]` |
| Contact log | `items` is a template that returns its value — filtered, searched by place, sorted newest or strongest |
| Strongest in window | A list of at most one (the same predicate, sorted, cropped) whose button sets `state.selectedId` |
| Target dossier | A list of at most one: the records filtered to `state.selectedId` — no second request, nothing copied |
| New-event alerts | The map fires `onQuakeArrival` at the reader's threshold; a flow raises a toast and, with FOLLOW, locks it |
| Replay | A button toggles `state.replay`; the camera follows the events; the map fires `onReplayEnd` to turn it off |
| Camera buttons | Plain buttons whose flows call the map's declared callbacks — `zoomIn`, `zoomOut`, `pan`, `resetView` |
| Settings | A gear, a panel and a backdrop: three elements and one state key, closed by a click anywhere outside |
| Size (DESK · WALL · TV) | A variant on the HUD, scaled as one piece — a TV and a monitor can be the same pixels wide |
| Night · Day · Auto | `themeToggle`, two schemes of tokens; the globe re-reads its colours when `theme.resolved` changes |
| Remembered | `keepState` keeps every setting per screen; `transientState` never keeps the lock, a replay or a search |

### The map talks back through events, never through state

The plugin declares what it fires and what it answers to in [`declaration.ts`](./src/plugins/SeismicMap/declaration.ts):

```ts
triggers: { onQuakeSelect, onQuakeArrival, onReplayEnd },
callbacks: { resetView }
```

and the space hangs flows on them like on any element:

```ts
seismicMap({
  bind: { events: 'feed.records', selectedId: 'state.selectedId', minMagnitude: 'computed.minMagnitude', … },
  flows: [
    [named('picked', on('onQuakeSelect')), setState({ key: 'selectedId', type: 'text', value: '{{ picked.id }}' })],
    [named('arrived', on('onQuakeArrival')), when(…, addNotification(…)),
      setState({ key: 'selectedId', type: 'text', value: "{{ state.followOff ? state.selectedId : arrived.id }}" })],
    [on('onReplayEnd'), setState({ key: 'replay', type: 'boolean', value: false })]
  ]
});
```

The map never writes the page's state. It says what happened, and the space decides what that means — which is why a
pick on the globe, a click on a log row and the "strongest" card are the same act: one `setState` of one key, which the
dossier, the log's highlight and the map's own lock all read. The space is authored from the same `declaration.ts` the
component registers from (`defineElement(declaration)`), so a flow can only start on an event the component fires.

---

## The browser never talks to the USGS

Every number on the screen is real and comes through a **server action**: the feed is fetched **while the page is
being built**, by the render action, and every refresh asks this server for its slice again. The browser never learns
the upstream URL, holds no credential and receives only what the action chose to answer — the same seam a deployment
uses when the source DOES need a key. The only file the browser fetches itself is `public/geo/world.json`, which is
public geometry. There is no mock data anywhere: a live arrival is announced only when the USGS publishes one.

`cacheSeconds: 10` makes a public monitor affordable: a render answer is shared between everyone asking within ten
seconds of each other, so a room of screens on the fastest setting is one outbound request, not one per screen.

**Reshaping is a task.** GeoJSON is a transport format; a monitor wants a dozen fields in the units it shows them in —
`M4.0` not `4`, `38.21°N 142.37°E`, `12 km`, a depth band, an age relative to the feed — plus what it leads with. Every
counter is computed on the server at each magnitude floor (`counts.m0 … counts.m6`, and each activity bin's height per
floor), so moving the filter picks a number rather than making a template count two thousand rows.

**Filters.** The page has two kinds on purpose. The DISPLAY filters — window, magnitude, depth — change every panel at
once, so they sit in the command bar. How the page BEHAVES while it is open — refresh, alert threshold, follow — is set
once and left, so it sits behind the gear. The alert threshold is independent of the display: watch everything, be
told only about the M4s.

**Energy released** sums `10^(1.5 M + 4.8)` joules over the window, in TNT: the one total of a logarithmic scale that
means something physical — and shows how much of a week one big event carried.

---

## The globe

A position on the Earth is a projection and a magnitude is an area: neither can be arranged out of boxes. So this is
the case for a component, and inside it **MapLibre GL** — a globe and a flat map, in WebGL, for free.

- **No tiles.** The first version of this example drew CARTO's basemap; CARTO began asking for a key and every screen
  became a wall of "API KEY REQUIRED". The world is now a file this server serves (`public/geo/world.json`, written once
  by `yarn geography` and committed): Natural Earth 1:50m coastlines and borders, and Peter Bird's PB2002 plate
  boundaries, each segment classified as convergent, divergent or transform.
- **It ships no colours.** It paints with `--seismic-*` custom properties, which `src/space/css.ts` points at the
  space's tokens. A theme switch changes the tokens; the element re-reads them (through a one-pixel canvas, so any CSS
  colour syntax works) and the world recolours with everything else.
- **The replay clock is map state, not a filter.** `global-state` read by a paint property moves one number a frame;
  a filter would re-lay out every event in a worker, sixty times a second.
- **The worker is served, not bundled.** MapLibre 6's worker is a module of its own; `main.ts` mounts the package's
  `dist` at `/vendor/maplibre` and the element's `workerUrl` points there.
- **Imported inside the effect.** The server imports the plugin to render the page; MapLibre reaches for the browser as
  it loads. The element also declares `runtime: 'client'`, so the server does not try.
- **The camera obeys directions, not pixels.** The pan buttons move the centre in degrees: on a globe, dragging the
  picture "up" near a pole turns the Earth sideways, and a button labelled north must go north.
- **A replay is followed.** Every few seconds the camera flies to the largest event the clock has passed — the same
  flight a pick makes — and waits while the reader has their hands on the map.
- **Markers are DOM on purpose.** The lock-on reticle, the range rings' labels, shockwaves and the tooltip are CSS —
  animated, themable, and silenced by `prefers-reduced-motion`. A marker's root is MapLibre's to position: give it a
  `position` of your own and every marker lands offset by the ones before it.

---

## Where the data comes from

- Events — [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), public
  domain, regenerated every minute. Every magnitude for the hour, day and week; the month starts at M2.5, and the
  filter bar says so.
- Coastlines and borders — [Natural Earth](https://www.naturalearthdata.com) via `world-atlas`, public domain.
- Plate boundaries — Bird, P. (2003), *An updated digital model of plate boundaries*, G³ 4(3), as converted by
  [Hugo Ahlenius](https://github.com/fraxen/tectonicplates), Open Data Commons Attribution. Credited on the display.

All times are UTC, and every one of them says so.
