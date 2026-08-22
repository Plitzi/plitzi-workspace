# A blog

**Fieldnotes**, a small wildlife magazine: a front page that leads with a story, a page per post at its own URL, a
sidebar, an editor behind a sign-in, and an account that may publish while another may not. Nothing is stubbed —
the photographs are real, the sessions are real, the permission is checked on the server, and every page is
rendered before the browser gets it.

```bash
yarn workspace @plitzi/example-blog start
# http://127.0.0.1:4013
```

Sign in at [/login](http://127.0.0.1:4013/login) as **ada / password** and write one. Then sign in as **grace /
password**: the editor link is not in her header, and if she reaches the page anyway the server refuses her.

The dev tools are on — the badge in the corner, or **shift+alt+D**. Logs, the store, the elements, the variables,
every server action this page ran, and the switch that puts the whole thing in light, dark or system.

## What it took

Eight files, and only two of them are about blogging:

| File | Lines | What it is |
|---|---:|---|
| [`src/space.ts`](./src/space.ts) | 878 | The six pages — a declaration, not code |
| [`src/theme.ts`](./src/theme.ts) | 689 | The stylesheet, as data: ~55 classes, the palette, both schemes |
| [`src/posts.ts`](./src/posts.ts) | 444 | Seven articles and their subjects. The one file a real blog replaces |
| [`src/tasks.ts`](./src/tasks.ts) | 146 | List, read, publish, edit, and who is looking |
| [`src/actions.ts`](./src/actions.ts) | 131 | Five flows, as documents |
| [`src/plugins/SpeciesStatus.tsx`](./src/plugins/SpeciesStatus.tsx) | 130 | The one element this space ships itself |
| [`src/accounts.ts`](./src/accounts.ts) | 92 | Two people, their sessions, and the adapters over them |
| [`src/main.ts`](./src/main.ts) | 44 | The server |

Lines of code, without the comments — which outnumber them here, because an example is read more often than it is
run. Two of those files are the pages and two more are content and paint. What is left is the **mechanism** —
sessions, permissions, the five flows and the server — and it is under four hundred lines.

There is no router, no controller, no template, no data-loading code, no session handling, no CSRF, no permission
middleware, no client-side state and no build step for the pages. Those are not omitted — they are what
`createAuth` and `createServer` already are.

## The pages

| Route | Who sees it | What feeds it |
|---|---|---|
| `/` | everybody | `list-posts`, twice: the feed and the sidebar |
| `/post/{{slug}}` | everybody | `get-post`, given the slug from the route |
| `/write` | a signed-in visitor | nothing — it is a form |
| `/edit/{{slug}}` | the post's own author | `get-post` again — one action, two pages |
| `/login` | signed out **and** signed in | two pages on one path |

The last row is the pattern worth stealing. `accessLevel: 'public'` does not mean "for everybody" — it means
*signed-out visitors* — so a sign-in page and the account page behind it sit on one path and the router picks
between them. Neither page contains a condition. `/write` is `authenticated` and names `unauthorizedRedirect`, so
somebody who follows the link with no session lands on the sign-in rather than on a 403.

## Where the data comes from

Each section of a page is an `apiContainer` with `runtime: 'server'` naming an **action**:

```ts
element('ApiContainer', {
  idRef: 'posts',
  runtime: 'server',
  attributes: { action: 'list-posts', input: { perPage: 4, featured: true }, pagination: 'url' },
  children: [ /* the hero, the list, the pager — all bound to `apiContainer_posts.*` */ ]
})
```

An action is a document, not code: a trigger and a chain of steps. The three reads are `render` triggers — nobody
calls them, they run while the page is being built — and their input is the page's own route and query params
plus whatever the element declared, which is the whole of how `/post/counting-a-ghost` becomes `{{input.slug}}`:

```ts
{ id: 'start',  type: 'trigger', action: 'render',      params: { access: 'public', input: '…' } },
{ id: 'result', type: 'task',    action: 'blog.getPost', params: { slug: '{{input.slug}}' } },
{ id: 'answer', type: 'task',    action: 'flow.output',  params: { values: '{{ result }}' } }
```

The output step is the contract, and it names one token: what the task returned is what the page receives. A field
the page must never see is a field the **task** does not return.

**The sidebar is the same action asked a different question.** It is a second provider, nested inside the first,
declaring `input: { page: 1, perPage: 5, featured: false }` — one action, two elements, no second endpoint and no
second task. The topic chips beside it come out of the same answer.

`blog.getPost` and its three siblings are this deployment's own tasks, registered in
[`src/tasks.ts`](./src/tasks.ts) and offered to the builder's step catalog for free. Everything Plitzi had to be
taught about blogging is in that file, and it is under a hundred lines of it.

## Who may publish

Two facts, and they never meet in the page:

- `ada` holds the permission `postPublish`; `grace` does not ([`src/accounts.ts`](./src/accounts.ts)).
- The `publish-post` action's trigger declares `access: 'role'` with that permission name.

That check runs before a single step does, so the refusal costs nothing and cannot be worked around by a browser:

```bash
curl -s -X POST localhost:4013/_action -H 'content-type: application/json' \
  -d '{"actionId":"publish-post","input":{"title":"Sneaky","body":"…"}}'
# → 403 {"error":"This action requires a signed-in visitor","reason":"forbidden"}
```

**The author is the session, never the input.** The form has no author field and the action's input contract has
no author key, so there is nothing for a caller to put somebody else's name in — `blog.publishPost` reads
`ctx.user` and credits that.

The page shows what came back and decides nothing:

```ts
{ id: 'publish', type: 'globalCallback', action: 'runServerAction', on: 'actions',
  params: { actionId: 'publish-post', input: { title: '{{submitted.values.title}}', … }, mode: 'await' } },
{ id: 'refused', type: 'globalCallback', action: 'setState', on: 'state',
  params: { key: 'notice', value: 'The server refused this: {{publish.reason}}' },
  when: { combinator: 'and', rules: [{ field: 'publish.status', operator: '!=', value: 'completed' }] } }
```

**Write `input` as an object, not as a line of JSON text.** It is the same values either way until one of them
contains a quotation mark or a newline — a post body, in other words — and then a JSON string with tokens
interpolated into it stops being a document and the action refuses the whole call as invalid input. As an object
each value is its own string and nothing has to be escaped by hand.

## Who may edit

Publishing is a permission. Editing is a permission **and** a question the permission cannot answer.

`ada` holds `postPublish`, and that does not make `grace`'s post hers to rewrite. The `update-post` trigger asks
the first half — before any step runs, with no record in hand, because at that moment there is no record. The
second half is asked by the task, holding the row:

```ts
const post = updatePost(slug, user.id, patch);   // matches on the author id
if (!post) {
  // The same answer for "no such post" and "not yours" ON PURPOSE: telling them apart tells a stranger
  // which slugs exist and who wrote them.
  throw new Error('That post is not yours to edit');
}
```

The page in front of it is the same shape as everything else here — two halves bound to one field. `get-post`
already answers `canEdit`, so the editor and the "not yours to edit" card are both authored, unconditionally, and
the binding picks. The "Edit this post" link on the article binds to the same field, which is why nobody is
offered a door that will not open.

**And the editor arrives filled in.** Every control binds its `defaultValue` to the record the page's own action
returned, so the values are in the markup the server sent rather than painted in a frame later. A field left
blank means *unchanged*, not *emptied* — which is what makes an editor safe to open and close.

## An element the SDK does not ship

Every post here has a subject, and a subject has facts that are not text in a box: a Red List category is a
**position on a scale**, and a population trend is a **shape**. That is the line — arrange built-in elements until
what you want to show stops being text, and then ship one of your own.

[`src/plugins/SpeciesStatus.tsx`](./src/plugins/SpeciesStatus.tsx) is that element. Two halves, and forgetting
either is quiet — a page that names a type the server has no component for renders perfectly, with a hole in it:

```ts
// src/main.ts — the server is handed the file and the type name
const plugins = { speciesStatus: { js: path.resolve(here, 'plugins/SpeciesStatus.tsx'), action: 'compile' } };
createServer({ plugins, adapters: createJsonAdapters({ deployment: { pluginNames: Object.keys(plugins) }, … }) });

// src/space.ts — the page authors it exactly like a heading
elementSpec({ type: 'speciesStatus' }, { bindings: [{ to: 'status', source: 'apiContainer_post.record.species.status' }, …] })
```

Three things about it are worth stealing:

- **Attributes arrive as props.** So every value is a binding onto the answer the post's own action already
  returned — the panel makes no request, holds no data, and cannot disagree with the page it sits on.
- **It ships no colours.** Every rule is written in the space's own variables, which is what lets it follow the
  blog into dark mode without knowing that dark mode exists. The box around it is a class in
  [`theme.ts`](./src/theme.ts), because a border is a decision of the page.
- **It is a real component, not a picture of one.** The scale is a row of buttons: press any category and it
  tells you what that one means, while the species' own stays marked.

## The header knows who is looking

It is an element like any other — an `apiContainer` naming the `site-chrome` action — so what it shows comes from
the session, resolved on the server with the rest of the page:

```ts
run: (_params, ctx) => ({
  signedIn: Boolean(ctx.user),
  signedOut: !ctx.user,
  canWrite: Boolean(ctx.user?.permissions.includes('postPublish')),
  accountLabel: ctx.user?.username ?? ''
})
```

The editor link binds its **visibility** to `canWrite` and the account button binds its **text** to
`accountLabel`. So `ada` gets her name and the editor, and `grace` gets her name and no editor — with no condition
written into the page.

The account control is **two elements rather than one that changes its mind**: an invitation bound to `signedOut`
and a name bound to `signedIn`. A field and its opposite, because a binding shows an element when its field is
true and the vocabulary has no "unless" — and because an invitation and an identity want different shapes, not a
compromise between the two.

Hiding a link is a courtesy, though, and the README of this example would be lying if it stopped there: the lock
is the `access: 'role'` above. `grace` can type the URL, reach the editor, fill it in, and still be refused.

## What the server renders, and what the browser does with it

Every page here is resolved on the server, so the HTML arrives finished: no request from the browser, no
credential in the page, nothing to load after it. Then the browser takes those sections over — they are ordinary
elements again — which is why the pager inside the list works, why a post opens without a page load, and why
coming back to the list refetches it.

The division is worth stating plainly: **`runtime: 'server'` decides where the DATA is resolved, not whether the
page is interactive.** `getRscData` runs on the server and only what it published ever reaches the browser.

A route change asks for the destination's answer **before** it commits, so a page arrives whole rather than
arriving empty and correcting itself a frame later. Where that is not possible — the back button, which changes
the URL before anything can be asked — a section whose answer has not arrived says nothing instead of showing its
authored defaults. The difference is visible in this blog: the editor link would otherwise appear for a moment to
a visitor who may not use it. There is a browser test that watches the painted frames and fails if it does.

That is also why bindings do the work a template language would: the byline, the excerpt, the reading time and the
URL are composed on the server, because a binding names one field.

## The look

[`src/theme.ts`](./src/theme.ts) is the whole of it: a palette with a light and a dark value for every colour, a
few type defaults per element type, and about fifty classes. Nothing in the pages is styled inline, so changing
`--accent` re-themes every chip, link and button at once.

The lead story is **one photograph with the headline inside it**, and that shape is worth reading before you copy
it. The whole card is a single `Link` — picture and words are the same click — and the text sits over the image
because `heroScrim` is positioned over it, carrying a gradient down to `--scrim`. Without that layer the design is
a bet on every future cover being dark in the bottom third. The link also names a `label`, because a card link
with nothing there is announced as every word printed on it: topic, headline, standfirst, byline and button, in
one breath.

Three things worth knowing before you write one of your own:

- **The style vocabulary is a closed list of properties and has no shorthands.** There is `row-gap` but no `gap`,
  four corner radii but no `border-radius`, `outline-style` but no `outline`. A space authored with shorthands
  renders and then cannot be read back by the builder's style editor, so the helpers at the top of the file
  expand them at authoring time.
- **The covers are real photographs, and the cover field is just a URL.** Each post carries one served by
  Unsplash with `auto=format` on it, so the same URL answers with AVIF, WebP or JPEG depending on who asked and
  one field feeds a 16:9 hero and a 4:3 card without shipping two files. The editors on `/write` and `/edit` have
  a **Cover image URL** field, and it is the same field a media library would fill in — there is no second one.
- **A post with no photograph gets a drawn one.** `coverFor` draws an SVG data URI with a hue derived from the
  slug, so a post published without a link has its own colours the moment it exists rather than leaving a hole
  where the front page expects an image.
- **An image element is a `140px` square until something says otherwise**, so that an unbound one can be seen and
  picked up in the builder. A class that gives it a `width` and an `aspect-ratio` and nothing else loses to that
  height, and every cover comes out a letterbox. `height: auto` is what hands the shape back to the ratio — the
  `media()` helper at the top of the file is that, said once.

## Light and dark

Every colour in [`src/theme.ts`](./src/theme.ts) is declared twice, and dark is a design rather than an inversion:
the surfaces lift instead of the text dimming. The machine picks between them — and the switch in the header is a
visitor overruling their machine:

```ts
element('ThemeToggle', { attributes: { subType: 'switch', lightLabel: 'Light', darkLabel: 'Dark' } })
```

That is the whole of it, and the element ships **no colours of its own**. It writes the choice on the document
root (`light` / `dark`, and nothing at all while the answer is still the machine's) and remembers it; the palette
is already keyed on exactly that, because `styleVariablesToCss` emits both a `prefers-color-scheme` rule guarded
on the absence of the class and a rule for the class itself. A space with no switch on it never sees a class and
behaves as it always did.

It ships two icons and no opinion about which one shows either — that is the same question the palette answers, so
this space answers it the same way, in four rules keyed on `data-theme-icon` at the bottom of `theme.ts`. Styling
the control is styling an ordinary element: one class on it, and `subType: 'segmented'` if you would rather offer
the three answers, including handing the decision back to the machine.

**A space only needs to author one of these if its VISITORS should have one.** While you are building, the dev
tools carry the same switch in their toolbar, writing to the same place — so every example here can be seen in
either scheme without a line of authoring, and the panel itself follows along rather than sitting there in white
on top of a dark page.

## What is missing on purpose

The posts live in an array, so restarting the server forgets what you wrote. That is the same choice every example
here makes: a database in front of the thing being shown is a setup step between you and it. `posts.ts` is where
yours goes, and nothing else in this example changes when it does.

Comments, drafts, file uploads, RSS and search are not here — none of them would show a mechanism this does not
already use. A cover is a URL here for the same reason: storing bytes is a storage decision, and the field either
way is the one on the form.

The photographs come from Unsplash over the network, which is the one thing here that needs the wifi to work. That
is the honest trade for real pictures, and it is contained: swap the `photo()` helper in
[`src/posts.ts`](./src/posts.ts) for your own paths and the example runs off a folder.
