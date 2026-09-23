# Testing what you authored

## Handles

`authorSpace` returns `handles`: every element by id, with the selector that finds it in the rendered page
(`[data-plitzi-el="<id>"]`). `handles.element(id)` throws on a name that does not exist, and `locate(page, handles)`
turns an id into a Playwright locator. Pages are in `handles.pages` (each with its `path` and `elements`); a layout's
elements are in `handles.layouts` and render on every page that names the layout.

Three flags say what an "every named element is visible" check must skip:

- `conditional` — on screen only under a condition of its own or of an ancestor;
- `repeated` — inside a list row, so rendered once per row: several copies, or none while the list is empty. Address
  one with `.first()` / `.nth(i)`, in a test that knows the data;
- `boxless` — a provider with no tag, which renders its children and no element of its own.

A `formControl`'s id names its wrapper: type into `locate('email').locator('input')`.

Select by `data-plitzi-el`, never by a generated class name: authoring derives `<type>-<hash>` for an element's own
rules, and that name changes when the rules do.

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
