# Before you say it is done

The feedback a reviewer gives on almost every change to a space, so you can give it to yourself first. Go through all
of it; each line is something that has shipped broken before.

## It renders, and says so

- [ ] `authorSpace` returns **zero warnings**. Each one is written code that will not do what it says.
- [ ] Every **suggestion** is taken, or left for a reason you can say (the copies are about to diverge; three cards a
      person rewords on the canvas) — and then quieted where it is written, `quiet: ['repeated-shape']`, so it stops
      burying the ones that matter. The ones your change opened up first — [efficiency.md](efficiency.md).
- [ ] No console errors on any page you touched.

## Nothing flashes, nothing jumps

- [ ] Nothing appears only to be taken away while data loads: a condition that REVEALS an element starts hidden and
      answers `'false'` until its source arrives. Checked from the FIRST frame, not a screenshot at the end.
- [ ] Nothing that is on screen by default disappears because a flag has not been set yet (a sidebar until it is
      folded). Checked on a fresh visit, with no state kept from before.
- [ ] Empty states show only when the answer arrived and is empty — never while loading.
- [ ] A feature still being built is gated by a [feature flag](feature-flags.md) (`flag: 'x'` / `'!x'`), not hidden
      with `visible` — and checked with the flag on AND off. A flag whose feature shipped is removed, gate and all.
- [ ] No hidden element leaves a hole: the element itself is hidden, not a wrapper around it.
- [ ] Nothing shifts when the data lands: a loading area keeps its size, numbers use tabular figures.

## Every screen, every theme

- [ ] Desktop, tablet and mobile — and nothing scrolls sideways on a phone. A rule for tablets and phones alike is
      written under `compact`.
- [ ] Light AND dark. Every colour is a token with both values; no theme-following text on a fixed background.
- [ ] Focus is visible on everything clickable (`focus-visible`). Animations and transitions stop by themselves for
  `prefers-reduced-motion`; a hover that moves something is turned off there too (`transform: none`).

## Usable without sight

Screen readers and browser agents (Claude in Chrome) work a page through its accessibility tree. See
[accessibility](accessibility.md).

- [ ] Every button and link has words — an icon-only button a `title`, a link around a card a `label` — and every field
      a `label` (`hideLabel: true` when the design shows what it is).
- [ ] Every image has an `alt` saying what it shows, or `decorative: true`.
- [ ] Every click is on a `button` or a `link`; the whole page can be worked from the keyboard.
- [ ] A toggle binds `ariaPressed`, a button that opens something `ariaExpanded` and names it with `controls`; words
      that change on their own are in a `live` container.
- [ ] Headings step down one level at a time; parts of the page a person jumps to are landmarks (`nav`, `main`, a
      labelled `section`).
- [ ] What a canvas or a plugin draws is also there as elements, with a visible way to reach them.

## No copies

- [ ] Chrome shared by pages is a layout; the current menu entry comes from `activeOn`, not per-page styling.
- [ ] A look used twice is a class; a tree used twice is a function or a `map` over data; a list of pages, links or
      plans is ONE array everything reads.
- [ ] No positional ids (`container-45`) in what you wrote; every referenced element is named, and a helper that
      runs more than once builds inside `scope()`.

## True, and in the right place

- [ ] Every number, name and status on screen comes from a source. No placeholder figures, no invented logos or
      testimonials. A panel with nothing true to show is an empty state.
- [ ] Times are formatted with an explicit zone and say which (`… 06:00 UTC`).
- [ ] Logic lives in binding templates or on the server, not in an attribute (where a condition is never evaluated).
- [ ] A filtered or sorted list binds its `items` to a template that returns its value — its rows are not hidden one
      by one.
- [ ] Every link you wrote was followed at least once: an `href` built from a row goes where it says.
- [ ] Writes refresh what they changed — and only that (`invalidateQueries`); a multi-step form does not refresh the
      provider that decides whether to leave.
- [ ] What only an administrator may read is shown only to administrators — and the check is a real boolean, not
      a template left as text.

## Nothing left behind

- [ ] Nothing you made and no longer use is still there — a page, a component, a class, a token, a data file, an
      import, a plugin folder. No commented-out code, no debug `console.log`, no copy of a file kept "just in case".
- [ ] Scratch work — a one-off script, a dump, a picture to look at — went in `tmp/` (never committed) and is gone from
      everywhere else.
- [ ] Nothing secret, and nothing only some visitors may read, is in `public/` or in the space's documents: both reach
      every visitor.
- [ ] `typecheck`, `lint` and `format` are clean.

## Proven

- [ ] You looked at it: the visual check ran, on the pages you changed, in both themes.
- [ ] Both sides of each condition were seen: the empty account and the full one, the admin and the member.
