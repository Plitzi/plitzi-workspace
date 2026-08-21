# A blog

WordPress, in the parts that matter: a front page that leads with a story, a page per post at its own URL, a
sidebar, an editor behind a sign-in, and an account that may publish while another may not. Nothing is stubbed —
the sessions are real, the permission is checked on the server, and every page is rendered before the browser
gets it.

```bash
yarn workspace @plitzi/example-blog start
# http://127.0.0.1:4013
```

Sign in at [/login](http://127.0.0.1:4013/login) as **ada / password** and write one. Then sign in as **grace /
password**: the editor link is not in her header, and if she reaches the page anyway the server refuses her.

## What it took

Seven files, and only two of them are about blogging:

| File | Lines | What it is |
|---|---:|---|
| [`src/space.ts`](./src/space.ts) | 580 | The five pages — a declaration, not code |
| [`src/theme.ts`](./src/theme.ts) | 440 | The stylesheet, as data: ~40 classes and the palette |
| [`src/posts.ts`](./src/posts.ts) | 294 | The posts, in memory. The one file a real blog replaces |
| [`src/tasks.ts`](./src/tasks.ts) | 101 | List, read, publish, and who is looking |
| [`src/accounts.ts`](./src/accounts.ts) | 92 | Two people, their sessions, and the adapters over them |
| [`src/actions.ts`](./src/actions.ts) | 89 | Four flows, as documents |
| [`src/main.ts`](./src/main.ts) | 33 | The server |

Lines of code, without the comments — which outnumber them here, because an example is read more often than it is
run. Two of those files are content and paint: take the posts and the stylesheet out and the whole mechanism is
under three hundred lines.

There is no router, no controller, no template, no data-loading code, no session handling, no CSRF, no permission
middleware, no client-side state and no build step for the pages. Those are not omitted — they are what
`createAuth` and `createServer` already are.

## The pages

| Route | Who sees it | What feeds it |
|---|---|---|
| `/` | everybody | `list-posts`, twice: the feed and the sidebar |
| `/post/{{slug}}` | everybody | `get-post`, given the slug from the route |
| `/write` | a signed-in visitor | nothing — it is a form |
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
plus whatever the element declared, which is the whole of how `/post/six-files` becomes `{{input.slug}}`:

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
  params: { actionId: 'publish-post', input: '{"title":"{{submitted.values.title}}", … }', mode: 'await' } },
{ id: 'refused', type: 'globalCallback', action: 'setState', on: 'state',
  params: { key: 'notice', value: 'The server refused this: {{publish.reason}}' },
  when: { combinator: 'and', rules: [{ field: 'publish.status', operator: '!=', value: 'completed' }] } }
```

## The header knows who is looking

It is an element like any other — an `apiContainer` naming the `site-chrome` action — so what it shows comes from
the session, resolved on the server with the rest of the page:

```ts
run: (_params, ctx) => ({
  signedIn: Boolean(ctx.user),
  canWrite: Boolean(ctx.user?.permissions.includes('postPublish')),
  accountLabel: ctx.user ? ctx.user.username : 'Sign in'
})
```

The editor link binds its **visibility** to `canWrite` and the account button binds its **text** to
`accountLabel`. So a signed-out visitor gets "Sign in", `ada` gets her name and the editor, and `grace` gets her
name and no editor — with no condition written into the page.

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
few type defaults per element type, and about forty classes. Nothing in the pages is styled inline, so changing
`--accent` re-themes every chip, link and button at once.

Two things worth knowing before you write one of your own:

- **The style vocabulary is a closed list of properties and has no shorthands.** There is `row-gap` but no `gap`,
  four corner radii but no `border-radius`, `outline-style` but no `outline`. A space authored with shorthands
  renders and then cannot be read back by the builder's style editor, so the helpers at the top of the file
  expand them at authoring time.
- **The covers are drawn, not fetched.** Each is an SVG data URI with a hue derived from the post's slug, so the
  example has real artwork with no media library, no external host, and nothing to go missing when the wifi in
  the room is bad. A real blog puts its uploaded URL in exactly the same field.

## What is missing on purpose

The posts live in an array, so restarting the server forgets what you wrote. That is the same choice every example
here makes: a database in front of the thing being shown is a setup step between you and it. `posts.ts` is where
yours goes, and nothing else in this example changes when it does.

Comments, drafts, media uploads, RSS and search are not here either — none of them would show a mechanism this does
not already use.
