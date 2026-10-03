# State that outlives a reload

`render(…, { state })` seeds `runtime.state` when the page starts — the way a host hands a space what it already knows.
`settings: { keepState: true, stateStorage: 'localStorage' }` keeps `runtime.state` across reloads, filed under
whoever is signed in (a guest's state is the browser's; another account never sees it). Keep only what a person would
expect back — favourites, a chosen theme. Everything else goes in `transientState`, which is never written and never
brought back:

```ts
settings: { keepState: true, transientState: ['filter', 'tourStep', 'panelOpen'] }
```

Do not reset kept state from `onPageLoad` instead: what was kept is restored late — after hydration, once auth knows
who this is — and lands in the middle of that flow, so half of it is undone. A filter restored on the next visit is a
page that looks broken. Keeping state is the SPACE's setting; a page does not take `keepState`.

That lateness shows. Kept state is restored after the server's first paint, so anything kept that changes what is
DRAWN — the tool a toolbar shows as last picked, a name in an avatar, a panel left off — is drawn with its default and
then swapped. List those keys in `paintedState`: they are kept in a cookie too, the server renders with them, and the
page starts from the same values.

```ts
settings: { keepState: true, paintedState: ['shapesPick', 'name', 'color'], transientState: ['panelOpen'] }
```

Only what the first paint shows, and small values: the cookie travels with every request and holds a few kilobytes
(over that, the page falls back to the defaults and the dev tools say so). Never a secret — a key, a token — and never
a key that is also in `transientState` (`authorSpace` refuses it).
