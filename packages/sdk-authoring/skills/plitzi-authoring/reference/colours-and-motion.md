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
- Keep motion for meaning: `@media (prefers-reduced-motion: reduce)` in `customCss` turns it off for whoever asks.

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
