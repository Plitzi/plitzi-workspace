# Usable without sight

A screen reader and a browser agent (Claude in Chrome) read a page the same way. They use the **accessibility
tree** the browser builds from the markup, where every control is a role and a name. If a control has no name, or a
click sits on a box that is not a control, those readers can't find it, even though the page looks fine. The linter
warns about each case below (`control-without-name`, `image-without-alt`, `click-on-static-element`,
`dropdown-without-control`, `heading-level-skipped`, `label-ignored`, `control-in-decorative`, `embed-without-title`,
`controls-no-anchor`). Fix them the same way you fix any other warning.

## Controls have words

```ts
// Words of its own: nothing to add.
button({ content: 'Save' })

// An icon only: `title` is its name, and also its tooltip. The icon is hidden from the tree by itself.
button({ content: '', title: 'Close', icon: 'fa-solid fa-xmark' })

// Words that do not say what it does — a key hint, a count: `label` is read in their place.
button({ content: 'V', label: 'Select (V)', title: 'Select — V', icon: 'fa-solid fa-arrow-pointer' })

// A link around a whole card: without `label` it is announced as every word inside the card.
link({ href: '/posts/field-notes', label: 'Read “Field notes”', children: [ /* cover, topic, title, byline */ ] })

// A field whose design says what it is: the label stays, out of sight.
formControl({ name: 'q', label: 'Search the docs', hideLabel: true, placeholder: 'Search…' })
formControl({ name: 'tint', subType: 'color', label: 'Highlight colour', hideLabel: true })
```

A `placeholder` names only a field you type into, and only until something is typed. A swatch, a date, a select or a
checkbox always needs its `label`.

## Pictures say what they show, or that they only decorate

```ts
image({ src: '/team.jpg', alt: 'The team at the 2026 offsite' })   // what it shows, for this page
image({ src: '/grain.png', decorative: true })                      // an ornament: left out of the tree
image({ decorative: true, bind: { src: 'post.record.cover' } })     // a cover under its own headline adds nothing
image({ bind: { src: 'row.item.cover', alt: 'row.item.title' } })   // …unless it is alone in a link: then it names it
fontAwesome({ icon: 'fa-solid fa-triangle-exclamation', label: 'Overdue' })  // an icon that says something alone
```

## Clicks go on controls

A `button` holds children, so a clickable card is a button with the card's class:

```ts
button({
  content: '',
  class: planCard,
  children: [text('Pro', { class: planName }), text('12 € a month', { class: planPrice })],
  flows: [[onClick(), setState({ key: 'plan', type: 'text', value: 'pro' })]]
})
```

Never put a click on a `container`, `text`, `image` or list item. A keyboard can't reach it, and a browser agent
won't find it among the page's controls. A button's children are its name, so keep headings, links and other
buttons out of it. If a card needs any of those, make its title a link and let the rest of the card be plain
content. An empty backdrop that closes a panel is fine, because the panel's close button and Escape are the ways
everyone has.

A filter chip, a tab you built yourself, a row that selects: all of them are buttons. Remember that a class starts
with the SDK button look (padding, radius), so reset what you don't want.

A dropdown opens from a button too: put one among its children, outside the popup. The dropdown marks it
(`aria-haspopup`, `aria-expanded`) and moves the focus into the menu and back out.

```ts
dropdown({ children: [dropdownPopup({ children: [ /* menu entries: buttons or links */ ] }), button({ content: '', title: 'Account', children: [avatar] })] })
```

## State is said, not only styled

```ts
button({ content: 'Grid', bind: { ariaPressed: 'computed.gridOn' }, class: chip })        // a toggle
button({ content: 'Menu', bind: { ariaExpanded: 'state.menuOpen' }, flows: [[onClick(), toggleState({ key: 'menuOpen' })]] })
```

An "active" variant is for the eyes. `ariaPressed` and `ariaExpanded` are for everyone else. Use both. A button that
opens a panel also names it — `controls: 'menu-panel'`, the panel's id (authoring gives the panel the anchor
`aria-controls` needs; [recipes/accordion.ts](../recipes/accordion.ts)). Words that change while somebody is on the page
— a count, a total, a status — sit in `container({ live: 'polite', … })`, so a screen reader says them when they change.

## The page has an outline

- Headings go down one level at a time: h1, then h2, then h3. The class sets the size, so an `h2` can look small.
- Landmarks are containers with a tag: `header`, `nav`, `main`, `aside`, `footer`. When a page has two of one kind,
  give each a `label`: `container({ subType: 'nav', label: 'Docs sections' })`. A `section` with a `label` becomes a
  region an assistant can jump to.

## Illustrations

A mock of a page, a diagram, some art built from elements: `container({ decorative: true, children: [ … ] })`. The
readers skip it, and the linter asks nothing of what is inside, except that nothing in it can be tabbed to
(`control-in-decorative`). Whatever it lets a mouse do needs a real control somewhere else.

## Built in, nothing to add

Modals and dialogs (named by their title; they take the focus, keep Tab inside and close on Escape), tabs (arrow
keys), a field's error (marked invalid and described by its message), the pager's current page, and the theme
toggle's pressed option.

## A canvas or a plugin

Anything drawn on a canvas is one picture to these readers. Render what it shows as elements too: a list with a
named button per action. Keep that list visible when someone asks for it, because an agent clicks by position and
can't click something that only appears on focus.

## Checking

- `authorSpace` warnings: zero, as always.
- In a test, `page.getByRole('button', { name: 'Close' })` fails when the name is missing.
  `expect(locator).toMatchAriaSnapshot(…)` pins the whole outline.
- Through MCP, `plitzi_screenshot` with `view: "accessibility"` returns the page's tree and lists everything that has
  no name.
