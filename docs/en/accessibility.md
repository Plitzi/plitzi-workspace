# Accessibility and browser agents

A Plitzi page has three kinds of reader:

- **People who see it.**
- **People who hear it**, through a screen reader, or who work it from a keyboard.
- **Browser agents** such as Claude in Chrome. An agent like this acts on the page as
  its person would.

The second and third read the page the same way: through the **accessibility tree** the browser builds from the
markup, where every control is a role and a name. An icon-only button with no name is announced as "button" and
nothing more, so neither kind of reader can tell it from the next one. A `div` with a click handler does not show
up as a control at all. Both of these look fine on screen, so nothing else would tell you about them.

This page covers what the elements already do, what an author still has to say, how the linter holds a space to it,
and how to check a page the way these readers get it.

---

## 1. What a browser agent needs

We learned this building [Pizarra](https://pizarra.plitzi.app), the collaborative whiteboard on the platform, with
Claude in Chrome working on real boards:

- **It finds controls by their role and name.** A button called "Close" can be found. An unnamed `<i class="fa-xmark">`
  inside a `div` cannot.
- **It clicks by position.** It looks the control up in the tree, then clicks where that control sits on screen. A
  control that only appears on hover or on focus is in the tree, but there is nothing on screen to click. What an
  agent has to use must be visible.
- **A canvas is a picture.** Everything drawn on a `<canvas>` (a chart, a board, a map) is one image to both
  readers. Pizarra added a **List view**: the board's frames, columns, cards and notes as real elements, with a
  named button for every change (add, edit, tick off, move, remove). The canvas label, the invite panel and the
  `/agents` guide all tell the agent to open it.
- **State must be announced, not only styled.** A toggle styled as "active" with a class is not on or off in the
  tree. `aria-pressed` makes it so.

All of this helps screen readers too. Neither kind of reader needs something the other doesn't.

## 2. What the elements do for you

| Element | Built in |
|---|---|
| `modalContainer` | A `dialog` with `aria-modal`, named by its title. Takes the focus when it opens, keeps Tab inside, closes on Escape, and gives the focus back when it closes |
| `dialogContainer` | The same, as an `alertdialog`. Escape turns it down (`onDialogReject`) and never accepts it |
| `tabContainer` | A `tablist` of `tab`s with `aria-selected`, each tab controlling its `tabpanel`. Only the selected tab is in the Tab order. The arrow keys, Home and End move between tabs; Enter and Space select one |
| `formControl` | The `<label for>` of every field. A field that breaks a rule gets `aria-invalid` and is described by its message (`aria-describedby`), and the message is an `alert`. The password eye is a real button, "Show password", with `aria-pressed` |
| `dropdown` | Marks the button that opens it with `aria-haspopup` and `aria-expanded`. Opened from the keyboard, the focus moves to the popup's first control (the popup can come before the button in the page, where Tab would never reach it). When the popup closes with the focus inside, the focus goes back to the button |
| `pagination` | A `nav` named "Pagination" (`label`). The current page has `aria-current="page"` |
| `link` | A link to the page being shown has `aria-current="page"`, from the address the page was rendered at — and the `current` style state to dress it, the state of any chosen item (a pressed toggle, a selected tab) |
| `themeToggle` | The switch is named by its two labels. The segmented form is a `group` whose options say which one is pressed |
| `fontAwesome` | Decoration: `aria-hidden`, unless `label` gives it a meaning |
| `button` | `ariaPressed` and `ariaExpanded` as attributes you can bind; `controls` names what it shows and hides (`aria-controls`). The focus ring is hidden for a pointer only (`:focus:not(:focus-visible)`), never for a keyboard |

Beyond the elements, the SDK's own stylesheet: a visitor whose machine asks for less motion
(`prefers-reduced-motion: reduce`) gets every animation and transition cut to an instant and no smooth scrolling, on
every space.

## 3. What an author says

| To say | Write |
|---|---|
| What an icon-only button does | `button({ title: 'Close', children: [icon] })` (also its tooltip) |
| What a button does when its words do not say it (a key hint, a count) | `button({ label: 'Select (V)', children: [icon, text('V')] })`: its `aria-label`, read in place of what it shows |
| Where a link wrapping a whole card goes | `link({ label: 'Read “Field notes”', … })`. Without it, the name is every word in the card |
| What a field is for, when the design already shows it | `formControl({ label: 'Search the docs', hideLabel: true })`: out of sight, still read |
| What a picture shows | `image({ alt: 'Maya presenting the roadmap' })`: its purpose on this page, not what file it is |
| That a picture adds nothing | `image({ decorative: true })`: an ornament, or a photo next to a caption that already says it |
| What an icon means when nothing else says it | `fontAwesome({ icon: 'fa-solid fa-triangle-exclamation', label: 'Overdue' })` |
| A toggle's state | `button({ bind: { ariaPressed: 'computed.gridOn' } })` |
| That a button opens something | `button({ bind: { ariaExpanded: 'state.menuOpen' } })` |
| What a button opens | `button({ controls: 'faq-answer' })`, by the element's id: authoring gives that element the anchor `aria-controls` needs, and refuses an id the space does not have (`controls-unknown`) |
| That words change while a visitor reads | `container({ live: 'polite' })` (`aria-live`): a count, a total, a status said aloud when it changes; `assertive` for what cannot wait |
| A part of the page an assistant can jump to | `container({ subType: 'nav', label: 'Main navigation' })`. A `section` with a `label` is a region |
| A group of controls | `container({ label: 'Filters' })`. A named `div` is a `group` |
| An illustration built from elements | `container({ decorative: true })`: a mock of a page or a piece of art, left out of the tree (`aria-hidden`). What it shows must be reachable some other way |
| What opens a dropdown | A `button` among the dropdown's children, outside its popup: `button({ content: '', title: 'Account', children: [avatar] })` |

A `placeholder` names only a field you type into (text, number, email, password, textarea), and only until
something is typed. A colour swatch, a date, a select or a checkbox is never named by one.

Put clicks on controls. A `button` holds children, so a whole card can be one. A `link` is the right control when the
click goes somewhere. A click flow on a `container`, `text` or `image` works with a mouse, but a keyboard can't reach
it and no agent finds it.

Give headings their level for the outline and their size through their class. An `h2` can look like anything.

## 4. The linter

The same linter every writer of a space goes through (`authorSpace`, the builder's problems panel, the MCP's
`plitzi_validate` and `plitzi_apply`, `yarn spaces:lint`) warns about these. They are warnings: the page renders,
and a publish is not blocked.

| Code | What it finds | The fix it gives |
|---|---|---|
| `control-without-name` | A button or link with no words: only an icon, a picture without `alt`, or nothing. Also a field with no `label` (or, for a typed field, no `placeholder`) | `title` on the button, `label` on the link, `label` + `hideLabel` on the field |
| `image-without-alt` | An image with no `alt` that is not `decorative` | Say what it shows, or `decorative: true` |
| `click-on-static-element` | A click flow on a `container`, `text`, `heading`, `paragraph`, `image`, icon or list item that holds something. An empty backdrop that closes a panel is left alone | Move the flow to a `button` (it holds children) or a `link` |
| `heading-level-skipped` | A heading more than one level below the one before it on the page | Step down one level; size it with its class |
| `label-ignored` | A `label` on a container whose tag takes its name from what it holds (`li`, the headings) | Put the words inside, or use a landmark tag |
| `dropdown-without-control` | A dropdown opened from a box or an icon: nothing a keyboard reaches opens it | Make what opens it a `button` |
| `control-in-decorative` | A button, link or field inside a `decorative` container: Tab reaches it and nothing announces it | Move it out of the illustration |
| `controls-no-anchor` | A button whose `controls` names an id no element of a saved document carries | Give the element it shows and hides that anchor |
| `embed-without-title` | An `embed` with no `title`: a frame a screen reader cannot describe | Say what it shows in `title` |

Nothing inside a `decorative` container is held to the other rules: assistive technology is told to skip it.

A child the linter cannot read into (a plugin, `custom`, raw HTML or JSX) is taken to have words. The linter never
reports something it cannot prove.

## 5. Canvases and plugins

A plugin that draws owns its own markup, and what the linter can't see is up to the plugin:

- Render what the canvas shows as real elements too: a list, a table, a named row for each item. Give each row a
  button for each thing a person can do to it, named after the item ("Mark done: Ship the beta"). See Pizarra's
  List view (Shift+L).
- Keep that view visible when someone asks for it: a toolbar button, a shortcut, or `:focus-within`. A list that
  exists only for screen readers can't be clicked by an agent that clicks by position.
- Name the canvas itself (`aria-label`) and say in the name where the list is.
- Buttons with only a glyph need `aria-label`, and glyphs need `aria-hidden`.

## 6. Checking a page

- **Through MCP:** `plitzi_screenshot` with `view: "accessibility"` renders the page, unsaved `operations` included,
  and returns its accessibility tree as an outline (`- button "Close"`, `- heading "Plans" [level=1]`). Every
  control or picture with no name is listed in `unnamed`. It is text, far cheaper than an image. `view: "both"`
  returns both. It needs the same browser as the image: the cluster's screenshot service (from 0.1.9) or Playwright or
  Puppeteer on the machine.
- **In a Playwright test:** `await expect(page.locator('main')).toMatchAriaSnapshot(…)` pins the same outline.
  `page.getByRole('button', { name: 'Close' })` fails when the name is missing, which makes it a useful test on its
  own.
- **On a running build:** the dev tools' **QA** tab (wherever debugging is authorized — a pre-production deployment,
  say) lists every control or picture with no name, every line of text under AA contrast against what is actually
  behind it, a heading outline with no h1 or a skipped level, and every touch target under 24 × 24 px that has another
  within its circle (WCAG 2.2 Target Size, Minimum); it outlines them on the page and scrolls to each. Its **Tab order**
  numbers the controls in the order the Tab key walks them, and its inspector shows any element's contrast as you point
  at it. It can also show the page without one kind of colour (protanopia, deuteranopia, tritanopia), in grayscale or
  out of focus, and its **X-ray** marks what is shown on a condition — what a screen reader may meet or miss.
- **By hand:** Chrome DevTools, Elements, Accessibility pane. Or tab through the page: everything you can click, you
  should be able to reach and press from the keyboard.

## 7. Agents on a Plitzi page

A space can be worked by an agent in two ways, and they suit different jobs:

- **Claude in Chrome** works the page the person has open, as that person, only while asked. It needs nothing
  installed and nothing from the space except everything above. It is the right fit for "help me fill this in" or
  "tick off what we finished".
- **An MCP server** gives an agent tools of its own: the space's MCP ([AI agents and the MCP server](./mcp.md)) for
  editing the space, or one the space's own server offers for what the page does. Pizarra serves one at `/mcp`, where
  an agent joins a board with its own cursor and stays while people work. This is the right fit for an agent that
  collaborates rather than assists.

A site that offers both says so where its people will look: Pizarra's invite panel has a tab per app (Claude Code,
the Claude app, Claude in Chrome, OpenCode), and its `/agents` page says what to paste into each.
