# Colours, themes and motion

## Animations

- **Keyframes go in the space's `customCss`** (`'@keyframes marquee { to { transform: translateX(-50%); } }'`) and
  the class names them: `animation: 'marquee 30s linear infinite'`.
- **An element hidden by `visible` is `display: none`**, so an animation in its class runs again every time it is
  shown — the way to animate a slide in (see recipes/every-few-seconds.ts).
- **Pause on hover** from the element around it: `ancestors: { [band.name]: { states: { hover:
  { 'animation-play-state': 'paused' } } } }`.
- **A stagger** — rows arriving one after another — is `animation-delay` per `:nth-child` in `customCss`, against the
  row's class.
- Keep motion for meaning. Whoever asks their machine for less motion gets it without a word from you: the SDK cuts
  every animation and transition to an instant for them. Write a `prefers-reduced-motion` rule only for what that does
  not cover — a hover that moves a card (`transform: none`), a decoration better not shown at all.

## Motion — good practices

Only `opacity` and `transform` (`translate`, `scale`, `rotate`) animate off the main thread: they stay smooth while
the page hydrates and on a slow phone. Everything else repaints, or lays the page out again, on every frame.

- **Slide, grow, fade** with `transform` and `opacity` — never `left`, `top`, `width`, `height` or `margin`. Something
  that travels across a box is `transform: translate(%)` on an element as large as the box.
- **No animated blur:** no `filter: blur()` in an entrance or a loop, no `backdrop-filter` over moving content. A soft
  shape is a `radial-gradient` fading to transparent.
- **Fake the expensive ones:** a growing shadow is a second shadow on a pseudo-element whose `opacity` changes; a
  pulsing glow is a static gradient whose `opacity` or `scale` changes.
- **Main-thread decoration waits for hydration:** a sweep on a custom property, a `background-position` seam — start
  it paused, run it once the SDK's root says `data-hydrated`:
  `'.glow { animation: glow 8s linear infinite paused; } [data-hydrated] .glow { animation-play-state: running; }'`.
- **Entrances:** `opacity` + a small `translateY`, under ~600ms, staggered by tens of ms.
- **One ambient loop per screen**, slow — not one per card. `infinite` runs on every visitor's battery for as long
  as the page is open.
- **Name what transitions:** `transition: 'transform 200ms, opacity 200ms'`, never `all` (a hover that changes
  `padding` becomes a layout animation).
- **`will-change`** only on the few elements about to move, never on every item of a list.

`authorSpace` suggests `heavy-animation` for keyframes a class or `customCss` runs off the compositor, naming each
property and the way out.

## Colours and themes

Every colour is a **variable** with both values, and elements say `var(--name)`:

```ts
variables: {
  color: {
    foreground: { light: '#0c0c14', dark: '#ededf3', default: '#0c0c14' },
    card: { light: '#ffffff', dark: '#101019', default: '#ffffff' },
    primary: { light: '#5b3df5', dark: '#6e52f7', default: '#5b3df5' }
  }
}
```

- **`tokens(variables)`** names them for a rule: declare the variables once (`satisfies SpaceSpec['variables']`), hand
  the same object to the space, and `const t = tokens(variables)` gives `t.primary === 'var(--primary)'` — a name the
  space does not declare is a type error. A `var(--x)` written by hand that nothing declares is warned
  `unknown-variable`; one that may be missing on purpose takes a fallback, `var(--x, 8px)`.
- Choose each value against its own background: a colour picked on white is not the same colour on near-black.
- Fixed colours are only for surfaces that are fixed in both themes (a brand panel that is always dark) — and then
  the text on them is fixed too. Theme-following text on a fixed background is the bug.
- A tint of a token is `color-mix(in srgb, var(--primary) 12%, transparent)`, which follows the theme for free.
- `themeToggle()` is the switch; `theme.resolved` (`light`/`dark`) is a global source for anything else that needs it.
