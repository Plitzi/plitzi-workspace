# Motion — good practices

Animation in a space is CSS: keyframes in the space's `customCss`, an `animation` or a `transition` on a class. Nothing
stops a space from animating anything, and that is the risk — a page that looked smooth on the author's machine
stutters on a phone, and stutters everywhere while it loads. This guide says what moves cheaply, what does not, and
how to keep the expensive kind out of the way. It applies to whoever writes the space: a person in the builder, code
written with `@plitzi/sdk-authoring`, or an agent over MCP.

## Declared motion

Most of what a page moves is an arrival — a section fading up as it scrolls in, cards following one another — or a
gentle loop. An element says that with `motion`, and the SDK's stylesheet plays it; no keyframes to write:

```ts
container({ motion: { enter: 'fade-up', on: 'view' }, children })     // arrives once, as it comes into view
container({ class: grid, motion: { enter: 'scale', stagger: 60 }, children: cards })  // its children, one by one
image({ src, alt, motion: { loop: 'float' } })                         // keeps rising and falling, gently
```

| Field | Values |
| --- | --- |
| `enter` | `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right`, `scale` |
| `on` | `load` (default); `view` — once, the first time it comes into view, and then it stays; `scroll` — with the scroll itself, both ways (it goes back out as the reader scrolls up past it), on load where the browser has no scroll timelines |
| `duration`, `delay` | ms (600 and 0 by default); `duration` does not apply under `scroll`, which follows the scroll |
| `stagger` | ms between children: they arrive instead of the element, the first 24 one by one |
| `loop` | `float`, `pulse`, `spin`, `sway` — held until the page is live (`data-hydrated`) |

Every preset moves only `opacity` and the transforms — an arrival the individual `translate`/`scale` properties, so it
composes with a `transform` of the element's own, a loop `transform` — and a visitor who asked for less motion gets
none of it. It is refused where it could not play (`motion-invalid`, `motion-no-tag` on a provider with no tag). In the
builder it is the element's **Motion** tab — each preset a tile that plays it while the pointer rests on it, and the
choices read back as a sentence; the canvas holds it still while editing, and **▶** in the header (or **Play on the
canvas** in the tab) plays it from the start — the space's own `[data-hydrated]` loops with it. **Preview** plays it as
the published page does: loops running, arrivals played as they come into view. Over MCP, `motion` is a field of `upsertElement` and
`patchElement`; `npx plitzi explain motion` lists every preset. Anything the presets do not cover is CSS, by the practices below.

## Why some animations are cheap

A browser draws a frame in three steps: **layout** (where every box goes), **paint** (the pixels of each layer) and
**composite** (the layers put together, on the GPU). An animation costs whatever steps it forces on every frame:

| Animating | Forces, each frame | Cost |
|---|---|---|
| `opacity`, `transform` (and `translate`, `scale`, `rotate`) | Composite only | Cheap — the browser runs it on its own thread, apart from the page's scripts |
| `color`, `background-color`, `background-position`, a gradient, a custom property, `box-shadow`, `clip-path`, `mask` | Paint, then composite | Main thread; grows with the area repainted |
| `filter: blur()`, `backdrop-filter` | Paint of a blur | Expensive at any size, very expensive over a large area |
| `width`, `height`, `top`/`left`, `margin`, `padding`, `font-size`, `gap` | Layout of the page, paint, composite | The most expensive: every box after it may move |

The first row is the only one that keeps running smoothly while the page's scripts are busy. Everything else waits
for the main thread — and a page's main thread is busiest exactly when it loads: the SDK hydrates the server's HTML in
a few long tasks (a couple of hundred milliseconds on a large page), and an animation on the main thread freezes for
each of them.

## The practices

1. **Animate `opacity` and `transform`.** A slide is `translate`, a grow is `scale`, a fade is `opacity` — never
   `left`, `width` or `margin`. A cursor or a marker that travels across a box is a `transform: translate(%)` on an
   element as large as the box, not a `top`/`left` in pixels.
2. **Fake the expensive ones with the cheap ones.** A shadow that grows on hover is a second shadow on a pseudo-element
   whose `opacity` goes from 0 to 1. A glow that pulses is a static `radial-gradient` whose `opacity` or `scale`
   changes. A moving gradient is a larger static gradient `translate`d behind an `overflow: hidden` box.
3. **Do not animate blur.** No `filter: blur()` in an entrance or a loop, and no `backdrop-filter` on something that
   moves or sits over moving content. A soft shape is a `radial-gradient` that fades to transparent — it looks the
   same and costs nothing per frame.
4. **Hold main-thread decoration until the page is hydrated.** When a decoration needs a property from the second row
   (a conic sweep on a custom property, a seam in `background-position`), start it paused and let it run once the
   SDK's root says `data-hydrated`:

   ```css
   .glow { animation: glow 8s linear infinite paused; }
   [data-hydrated] .glow { animation-play-state: running; }
   ```

   The page loads still, then comes alive; nothing stutters. An entrance of your own that plays **once** as the page
   goes live is applied under `[data-hydrated]` rather than held paused on its first frame —
   `[data-hydrated] .disc { animation: unfold 2s backwards; }` — so a page that never goes live (the builder's canvas
   while editing, one read without scripts) shows it where it ends, not where it starts.
5. **Entrances are short and cheap.** What appears as the page loads fades and rises — `opacity` and a small
   `translateY`, under ~600 ms, with a stagger of tens of milliseconds between rows. Not a blur that clears, not a
   height that opens.
6. **One ambient loop per screen.** An `infinite` animation runs for as long as the page is open, on every visitor's
   battery. Keep loops for what they mean (a live indicator, a marquee someone came to see) and give a decoration one
   slow loop at most — not one per card.
7. **Transition what changes, not `all`.** `transition: all 200ms` animates every property that changes, layout ones
   included — a hover that changes `padding` becomes a layout animation. Name the properties:
   `transition: transform 200ms, opacity 200ms`.
8. **`will-change` only on what is about to move.** It reserves a layer — memory on the GPU — for as long as it is
   set. On a few elements that animate, fine; on every card of a list, it costs more than it saves.
9. **Large areas cost more.** A paint-bound animation over a full-width hero repaints the whole hero every frame.
   Keep the animated surface as small as the effect allows, or make it a `transform`.

Reduced motion is already handled: a visitor whose machine asks for less motion (`prefers-reduced-motion: reduce`)
gets every animation and transition cut to an instant by the SDK's stylesheet — see
[Accessibility](./accessibility.md). Write a `prefers-reduced-motion` rule only for what that does not cover, like a
hover that moves a card or a page that scrolls itself.

## Checking a page

On a running build, the dev tools' **QA** tab pauses every animation where it is, to look at a moment of it, plays them
at a quarter of their speed (**Slow**), plays the declared motion again from the start (**Replay**), and shows the page
with reduced motion — the SDK's own rule, applied by the class `plitzi-reduced-motion` on the document — without
changing the machine's setting. Its **X-ray** marks every element that declares motion, beside what else is wired to
it.

The authoring linter reads the space's keyframes: one that animates anything but `opacity` and `transform`, and that
something runs, is suggested `heavy-animation` — in `authorSpace`'s and `plitzi_validate`'s `suggestions` and the
builder's problems panel — with each property it animates and the way out of its cost. A property from the second row
counts only in a loop — once, it is a few frames — and a loop that starts `paused` and runs under `[data-hydrated]` is
let through; a size, a position, a blur or a shadow counts every time.
It is a suggestion: nothing blocks, and the page renders as written.

Measure with the production SDK: a local server with debugging authorized serves the development build of React,
whose hydration is about twice as long, so a page that stutters locally may not in production — and one that is smooth
locally will be smooth there too. In Chrome's Performance panel, record a reload: long tasks are the red-cornered
blocks on the main thread, and an animation that freezes during them is one from the second or third row of the table.
The Rendering panel's **Paint flashing** shows, in green, what repaints every frame — on a page at rest, nothing should
flash.
