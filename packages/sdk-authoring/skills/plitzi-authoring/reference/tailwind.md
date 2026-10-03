# From Tailwind classes

`tw()` turns Tailwind classes into the rules `styles()` takes, when the space is written — nothing of Tailwind runs in
the page, and the class is an ordinary one the builder edits:

```ts
const pill = styles('nav-pill', tw('inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-950/90 hover:scale-105 md:text-sm'));
const t = createTw({ colors: tokens(variables) });   // bg-surface → var(--surface), text-ink/60 → a tint of it
```

- Tailwind v4's scales and palette, its arbitrary values (`w-[220px]`, `shadow-[0_0_20px_rgb(6_182_212/0.35)]`), CSS
  variables (`bg-(--accent)`) and any property (`[mask-type:luminance]`).
- Breakpoints become Plitzi's ranges: `md:` is tablet and desktop, `lg:` desktop, `max-md:` mobile, `max-lg:` tablet and
  mobile. A property only a wider range sets is `revert` below it.
- `hover:`, `focus-visible:`, `active:`… are the class's states; `group-hover/card:` is how it looks inside an
  ancestor wearing the class `card`.
- What has no exact equivalent is refused with what to write instead (`tw-no-equivalent`): `sm:`/`xl:`, `dark:` (a
  token with both values), `space-x-*` (`gap`), `animate-*` (keyframes in `customCss`). An unknown class is
  `tw-unknown-class` with the closest one; two classes that tie on a property are `tw-class-conflict`.
