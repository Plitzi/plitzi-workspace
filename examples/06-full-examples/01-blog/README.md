# A blog

WordPress, in the parts that matter: a home page listing the latest posts, a page per post at its own URL, an
editor behind a sign-in, and an account that may publish while another may not. Nothing is stubbed — the sessions
are real, the permission is checked on the server, and the pages are rendered before the browser gets them.

```bash
yarn workspace @plitzi/example-blog start
# http://127.0.0.1:4013
```

Sign in at [/login](http://127.0.0.1:4013/login) as **ada / password** and write one. Then sign in as **grace /
password** and try: she reaches the same editor and the server refuses her.

## What it took

Six files, and only two of them are about blogging:

| File | Lines | What it is |
|---|---:|---|
| [`src/space.ts`](./src/space.ts) | 457 | The four pages — a declaration, not code |
| [`src/posts.ts`](./src/posts.ts) | 117 | The posts, in memory. The one file a real blog replaces |
| [`src/actions.ts`](./src/actions.ts) | 72 | Three flows, as documents |
| [`src/accounts.ts`](./src/accounts.ts) | 70 | Two people, and the adapters over them |
| [`src/tasks.ts`](./src/tasks.ts) | 48 | List, read, publish — what the server can do |
| [`src/main.ts`](./src/main.ts) | 33 | The server |

Lines of code, without the comments — which outnumber them here, because an example is read more often than it is
run.

There is no router, no controller, no template, no data-loading code, no session handling, no CSRF, no permission
middleware, no client-side state and no build step for the pages. Those are not omitted — they are what
`createAuth` and `createServer` already are.

## The four pages

| Route | Who sees it | What feeds it |
|---|---|---|
| `/` | everybody | the `list-posts` action, run while the page renders |
| `/post/{{slug}}` | everybody | the `get-post` action, given the slug from the route |
| `/write` | a signed-in visitor | nothing — it is a form |
| `/login` | signed out **and** signed in | two pages on one path |

The last row is the pattern worth stealing. `accessLevel: 'public'` does not mean "for everybody" — it means
*signed-out visitors* — so a sign-in page and the account page behind it sit on one path and the router picks
between them. Neither page contains a condition. `/write` is `authenticated` and names `unauthorizedRedirect`, so
somebody who follows the link with no session lands on the sign-in rather than on a 403.

## Where the data comes from

The list and the post are `apiContainer` elements with `runtime: 'server'`, each naming an **action**:

```ts
element('ApiContainer', {
  idRef: 'posts',
  runtime: 'server',
  attributes: { action: 'list-posts' },
  children: [ /* the list, bound to `apiContainer_posts.records` */ ]
})
```

An action is a document, not code: a trigger and a chain of steps. Both reads are `render` triggers — nobody calls
them, they run while the page is being built — and their input is the page's own route and query params, which is
the whole of how `/post/hello-plitzi` becomes `{{input.slug}}`:

```ts
{ id: 'start', type: 'trigger', action: 'render', params: { access: 'public', input: '…' } },
{ id: 'post',  type: 'task',    action: 'blog.getPost', params: { slug: '{{input.slug}}' } },
{ id: 'answer', type: 'task',   action: 'flow.output',  params: { values: '{{ post }}' } }
```

The output step is the contract, and here it names one token: what the task returned is what the page receives.
A field the page must never see is a field the **task** does not return.

`blog.getPost` is this deployment's own task, registered in [`src/tasks.ts`](./src/tasks.ts) and offered to the
builder's step catalog for free. Everything Plitzi had to be taught about blogging is in that file, and it is 48
lines of it.

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
  params: { actionId: 'publish-post', input: '{"title":"{{submitted.values.title}}",…}', mode: 'await' } },
{ id: 'refused', type: 'globalCallback', action: 'setState', on: 'state',
  params: { key: 'notice', value: 'The server refused this: {{publish.reason}}' },
  when: { combinator: 'and', rules: [{ field: 'publish.status', operator: '!=', value: 'completed' }] } }
```

## What the server renders, and what the browser does with it

The list and the post are resolved on the server, so the HTML arrives finished: no request from the browser, no
credential in the page, nothing to load after it. Then the browser takes those sections over — they are ordinary
elements again — which is why the pager inside the list works, why a post opens without a page load, and why
coming back to the list refetches it.

The division is worth stating plainly: **`runtime: 'server'` decides where the DATA is resolved, not whether the
page is interactive.** `getRscData` runs on the server and only what it published ever reaches the browser.

That is also why bindings do the work a template language would: `byline`, `excerpt` and `url` are composed on the
server, because a binding names one field.

## What is missing on purpose

The posts live in an array, so restarting the server forgets what you wrote. That is the same choice every example
here makes: a database in front of the thing being shown is a setup step between you and it. `posts.ts` is where
yours goes, and nothing else in this example changes when it does.

Comments, drafts, categories, media, RSS and search are not here either — none of them would show a mechanism this
does not already use.
