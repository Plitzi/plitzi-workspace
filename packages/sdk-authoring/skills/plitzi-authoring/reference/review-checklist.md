# Before you say it is done

The feedback a reviewer gives on almost every change to a space, so you can give it to yourself first. Go through all
of it; each line is something that has shipped broken before.

## It renders, and says so

- [ ] `authorSpace` returns **zero warnings**. Each one is written code that will not do what it says.
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
- [ ] Focus is visible on everything clickable (`focus-visible`), and `prefers-reduced-motion` stops what moves.

## Usable without sight

Screen readers and browser agents (Claude in Chrome) work a page through its accessibility tree. See
[accessibility](accessibility.md).

- [ ] Every button and link has words — an icon-only button a `title`, a link around a card a `label` — and every field
      a `label` (`hideLabel: true` when the design shows what it is).
- [ ] Every image has an `alt` saying what it shows, or `decorative: true`.
- [ ] Every click is on a `button` or a `link`; the whole page can be worked from the keyboard.
- [ ] A toggle binds `ariaPressed`, a button that opens something `ariaExpanded`.
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

## Proven

- [ ] You looked at it: the visual check ran, on the pages you changed, in both themes.
- [ ] Both sides of each condition were seen: the empty account and the full one, the admin and the member.
