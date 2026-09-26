# Testing what you authored

## One call: `inspectPage`

```ts
import { authorSpace, inspectPage } from '@plitzi/sdk-authoring';

const { handles } = authorSpace(space);
await page.goto('/');
expect((await inspectPage(page, handles)).problems).toEqual([]);
```

It checks the open page and returns EVERY problem at once, one sentence each, naming the element and the reason:

- every element the page owes is present and visible — its own and those of the layouts around it
  (`heading "hero-title" is on the page but not visible: display:none on "hero"`);
- every image arrived — an image element that failed says so (`data-plitzi-failed`), though its fallback loads;
- nothing scrolls sideways (`the page scrolls sideways by 37px — widest: "cards"`);
- no text is drawn in the colour painted behind it.

It retries for up to 5 s like an assertion does (`timeout`), so a provider still answering is not a failure. Options:
`page` (id or slug; the home page by default), `elements: 'all'` to owe the unnamed elements too, `ignore: ['id']` for
what a test knows is not there yet (a typo is refused), `skip: ['images']` for a check a page breaks on purpose.
`inspectDocument(page)` runs the page checks alone, for a page whose space is not in hand.

## Handles

`authorSpace` returns `handles`: every element by id, with the selector that finds it in the rendered page
(`[data-plitzi-el="<id>"]`). `handles.element(id)` throws on a name that does not exist, and `locate(page, handles)`
turns an id into a Playwright locator. Pages are in `handles.pages` (each with its `path`, `elements` and `layout`); a
layout's elements are in `handles.layouts` and render on every page that names the layout. `onScreen(handles, page)` is
the list `inspectPage` holds a page to.

Three flags say what a bare visit cannot promise, and `onScreen` leaves out:

- `conditional` — on screen only under a condition of its own or of an ancestor;
- `repeated` — inside a list row, so rendered once per row: several copies, or none while the list is empty. Address
  one with `.first()` / `.nth(i)`, in a test that knows the data;
- `boxless` — a provider with no tag, which renders its children and no element of its own.

A `formControl`'s id names its wrapper: type into `locate('email').locator('input')`.

Select by `data-plitzi-el`, never by a generated class name: authoring derives `<type>-<hash>` for an element's own
rules, and that name changes when the rules do.

## Pressing a shortcut

`pressShortcut(page, 'mod+z')` presses a shortcut written the way `onKey` writes it, with the keys the PAGE listens
for: `mod` is ⌘ where the page's user agent is a Mac and Ctrl anywhere else. A driver's own "Control or Meta" asks the
machine running the suite instead, so a suite on a Mac driving an emulated desktop Chrome presses ⌘ at a page waiting
for Ctrl — the flow never runs and nothing says why. Point at the page first (a click on it) so it has the keys.

## Counting what an interaction renders

`inspectRenders(page, act, { max })` runs `act` and answers every element that rendered, how often and what changed
for it; over `max`, `problems` says so. It reads the SDK's render tracing, which is on only under `debugMode` — render
the space with it (the e2e harness: `renderSpace(page, space, { debugMode: true })`). What to do with the answer is in
[performance](performance.md).

## Spaces written for a test

Author them like any space — never as JSON: the validator is what tells a fixture that tests something from one that
tests nothing.

```ts
import { authorSpace, heading, singlePageSpace, withElement } from '@plitzi/sdk-authoring';

const space = singlePageSpace([heading('Hi', { id: 'title', subType: 'h1' })]);   // one page, nothing else
const edited = withElement(space, 'title', { attributes: { content: 'Changed' } }); // same page, one thing different
```

A fixture that must break a check ON PURPOSE — the runtime's answer to a document no author would write is the
subject — names the break: `authorSpace(spec, { allow: [{ code: 'template-unknown-name', element: 'feed', why: '…' }] })`.
One code on one element; it comes back in `warnings` with the reason, and an entry that no longer matches is refused.

## What to check

- **Every viewport and both themes.** Desktop, tablet (48–64rem) and mobile (below 48rem); `colorScheme: 'dark'` as well
  as light.
- **No horizontal scroll on a phone.** A column child grows to its content unless its parent stretches it; a code
  block or a wide table is what finds out.
- **The loading frame, not only the finished one.** A screenshot after the page settles cannot see an element that
  flashed and went. Watch from the first frame:

```ts
await page.addInitScript(ids => {
  const painted: string[] = [];
  (window as unknown as { __painted: string[] }).__painted = painted;
  const watch = (): void => {
    for (const id of ids) {
      const element = document.querySelector(`[data-plitzi-el="${id}"]`);
      if (element && element.getClientRects().length > 0 && !painted.includes(id)) {
        painted.push(id);
      }
    }

    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}, ['empty-state', 'first-steps']);

await page.goto('/', { waitUntil: 'load' });
// … wait for the data to be on screen …
expect(await page.evaluate(() => (window as unknown as { __painted: string[] }).__painted)).toEqual([]);
```

- **Both sides of every condition.** An account that has done everything must not see "get started"; a new one must.
  An empty list shows its empty state; a full one does not.
- **Navigation lands on the new page's content.** After `waitForURL`, wait for an element of the NEW page before typing:
  for a frame the previous page is still mounted, and a form field with the same name there takes the keystrokes.
- **Console errors are failures.** Collect them and assert the list is empty.

## Screenshots and scrolling

The page scrolls the document in development exactly as in production while the dev-tools panel is folded away (the
badge). With the panel OPEN, the page shares the window with it and scrolls inside its own pane — close the panel, or
run with `debugMode: false`, before a `fullPage` screenshot or a scroll measurement. For a screenshot at a width and a
theme: `page.setViewportSize({ width: 390, height: 844 })`, `page.emulateMedia({ colorScheme: 'dark' })`, and seed state
with `render(…, { state })` or a flow the test drives.
