/** The space's server side: connectors, server actions, functions, data, realtime channels and feature flags. */
export const serverGuide = `## Connectors — CMS and API integrations
A **connector** is how a space reads real content from Strapi, WordPress, Contentful, Directus or any REST service.
It is **a manifest, not code**: you declare the base URL, the endpoints, the auth template and the filter operators,
and the **server** executes it during the render. Integrating a new CMS never means shipping an adapter — it means
writing one document, which you can do here with \`upsertConnector\`.

Why the server and not the browser: the request (and the token behind it) never reaches the visitor, and the content
is in the HTML search engines see. That is also the one hard rule below — a provider element that is not
server-rendered ignores its connector entirely.

**Read these two first:**
- \`plitzi://connector-presets\` — **working manifests** for Strapi v5, WordPress, Directus, Contentful and a plain
  REST API, each with the \`credentialKeys\` that provider needs, **plus every template token** the engine binds.
  Start from the preset for the user's provider and edit it; do not invent a shape from memory.
- \`plitzi://connectors/{env}\` — the connectors **this space already has**, each with its read/write endpoint names,
  its filter operators and its published fields. \`plitzi://connectors/{env}/{ref}\` opens one manifest in full.

### Credentials are NOT yours to write
You never create, see or transmit a secret. Author the manifest with the token in place
(\`"value": "Bearer {{credential.token}}"\`) and **leave \`connection.credential\` unset** unless the user hands you an
identifier. The connector **saves fine that way** — validation reports it as a *warning*, not an error — and its
requests go unauthenticated until the space owner creates the credential in the builder and attaches it. Say that to
the user as the last step of any integration you build, naming the keys the preset lists (e.g. Strapi needs \`token\`).

### The manifest
Every string is a template the server renders per request. \`{{resource}}\` is the collection the element asked for;
\`{{limit}}\`/\`{{offset}}\`/\`{{page}}\`/\`{{cursor}}\` the window; \`{{routeParams.x}}\`/\`{{queryParams.x}}\` the
visitor's URL; \`{{credential.x}}\` the secret; \`{{field}}\`/\`{{value}}\` inside an operator; \`{{id}}\`/\`{{values}}\`
inside a write. The op splits it in two, exactly as the engine does:
- **\`connection\`** — what applies to every call: \`credential\`, \`auth\`, \`headers\`, \`pagination\`, \`operators\`,
  \`mediaBaseUrl\`, \`fields\`, \`projection\`.
- **\`endpoints\`** — the individual calls: \`read\` (named; **\`list\` is the one an element addresses when it names
  none**) and \`write\` (named; **omit for read-only** — an undeclared write can never be executed).

A read endpoint says where things live in *that* provider's response: \`itemsPath\` (the array), \`totalPath\` (the
count), \`idPath\` (the record's id), \`valuesPath\` (its fields). Strapi's \`data\` + \`meta.pagination.total\` and
Contentful's \`items\` + \`fields\` are the same manifest with different paths.

Two traps the validator will catch for you, both silent at runtime otherwise:
- An **operator template must render a whole \`key=value\` entry** (\`"eq": "filters[{{field}}][$eq]={{value}}"\`). A
  filter naming an operator the manifest does not declare is **dropped** — the query then returns *unfiltered*
  records, not none.
- **Paging must appear in the request.** Declaring \`pagination: "page"\` without \`{{page}}\` in the query makes every
  page resolve to the first one.

Example — Strapi, from the preset:
\`\`\`json
{ "type": "upsertConnector", "ref": "strapi-blog", "name": "Blog CMS",
  "baseUrl": "https://cms.example.com",
  "connection": {
    "auth": { "in": "header", "name": "Authorization", "value": "Bearer {{credential.token}}" },
    "pagination": "offset",
    "operators": { "eq": "filters[{{field}}][$eq]={{value}}", "contains": "filters[{{field}}][$containsi]={{value}}" },
    "mediaBaseUrl": "https://cms.example.com" },
  "endpoints": { "read": { "list": {
    "path": "/api/{{resource}}",
    "query": { "pagination[start]": "{{offset}}", "pagination[limit]": "{{limit}}", "populate": "*" },
    "itemsPath": "data", "totalPath": "meta.pagination.total", "idPath": "documentId" } } } }
\`\`\`
\`patchConnector\` changes part of one (endpoints merge **by name**; \`null\` removes one) — that is how you add a
\`detail\` read to a large manifest without resending it. \`deleteConnector\` is destructive: every element pointing
at it stops resolving, so confirm first.

### Using a connector on a page
The provider element is \`apiContainer\`, and it needs **both halves**:
1. \`runtime: "server"\` — set it on \`upsertElement\`/\`patchElement\`. **Without it the connector is ignored** and the
   element falls back to fetching its own \`query\` URL from the browser. This is the single most common mistake; the
   validator warns when it sees one half without the other.
2. props: \`connector\` (the ref), \`resource\` (the collection → \`{{resource}}\`), and optionally \`endpoint\` (a read
   other than \`list\`), \`filters\`, \`limit\`, \`singleRecord\`, \`pagination\`, \`pageParam\`.

It then publishes one source **to its descendants only** (like any provider — bind *inside* its subtree):
\`apiContainer_<name>.records\` (an array of \`{ id, values }\` — a record's fields are under \`values\`, so a row
reads \`list_<name>.item.values.<field>\`), \`.pageInfo\` (\`page\`, \`pageCount\`, \`total\`, \`hasNextPage\`…),
\`.isEmpty\`, \`.hasError\`, \`.errorMessage\`, \`.isLoading\`. With \`singleRecord: true\` it publishes \`.record\`
instead of \`.records\` — that is what a **detail page** uses. Bind an empty-state block's visibility to \`.isEmpty\`
and an error block's to \`.hasError\`; they are ordinary bindings, no special mechanism.

**A list page** — provider, then a \`list\` inside it bound to the records, then the row template reading the item
(a \`list\` is a \`<ul>\`, or \`<ol>\` by \`subType\`; its row a \`listItem\`, an \`<li>\` — any other row is warned
\`list-row-not-li\`):
\`\`\`json
{ "operations": [
  { "type": "upsertElement", "pageRef": "blog", "element": {
      "ref": "posts-api", "type": "apiContainer", "runtime": "server",
      "props": { "connector": "strapi-blog", "resource": "articles", "limit": "9", "pagination": "url" },
      "children": [ { "ref": "posts", "type": "list", "children": [
        { "ref": "post-row", "type": "listItem", "children": [
          { "ref": "post-title", "type": "text" } ] } ] } ] } },
  { "type": "upsertBinding", "pageRef": "blog", "ref": "posts", "category": "attributes",
    "binding": { "to": "items", "source": "apiContainer_posts-api.records" } },
  { "type": "upsertBinding", "pageRef": "blog", "ref": "post-title", "category": "attributes",
    "binding": { "to": "content", "source": "list_posts.item.values.title" } } ] }
\`\`\`

**A detail page** is the same provider with \`singleRecord\` and a filter resolved from the URL. Create the page with a
route param (\`"slug": "blog/:postSlug"\`), then filter on it — the filter \`value\` is a template the server resolves:
\`\`\`json
{ "type": "upsertElement", "pageRef": "post-detail", "element": {
    "ref": "post-api", "type": "apiContainer", "runtime": "server",
    "props": { "connector": "strapi-blog", "resource": "articles", "singleRecord": true,
      "filters": [ { "field": "slug", "operator": "eq", "value": "{{routeParams.postSlug}}" } ] } } }
\`\`\`
Its children then bind to \`apiContainer_post-api.record.values.<field>\`. A filter whose template resolves to nothing
returns **no records** rather than the whole collection — a URL that addressed one post never renders a different one.

**Paging** is the \`pagination\` prop: \`"none"\`, \`"url"\` (the page number rides the query string, so pages are
shareable and indexable — prefer it) or \`"append"\` (a "load more" list). Give each list on a page its own
\`pageParam\` so two lists page independently. The provider also offers the \`loadMore\` and \`goToPage\` callbacks to
interaction flows, \`performQuery\` to refetch, and \`cancelQuery\` to drop a request in flight (a STOP).

**Writing back** (a form, a "delete" button): declare the endpoint under \`endpoints.write\`, then call the provider's
**\`writeRecord\`** callback from an interaction flow — nodeType \`callback\`, \`elementId\` the apiContainer's ref,
params \`action\` (the write endpoint's name) and \`recordId\`. The write goes through the server, which owns the
credential and refuses any action the manifest does not declare. Writes exist **only** on a server-rendered provider.

**Connectors need a server.** A space published without server rendering has nowhere to resolve one: it works in the
builder and renders empty when published. If the user has no SSR deployment, say so rather than leaving them to
discover it — the alternative is a browser-side \`query\`, which cannot keep a secret.

## Server actions
Work a page cannot do in the browser — charge a card, send mail, read a system only the server reaches. An action
is a stored flow the SERVER runs; a page names it and never learns what it does. Write one with
\`upsertAction\` / \`patchAction\`, then call it from a page flow with the \`runServerAction\` step (mode
\`await\` to use the result, \`detached\` to fire and carry on).

Four rules worth knowing before you write:

- **Steps are server tasks.** \`plitzi://actions/{env}/tasks\` lists what this deployment can run — a browser step
  (\`setState\`, \`navigate\`) has nothing to act on here, and the reverse is true too: a task cannot run in a page
  flow.
- **The contracts.** \`input\` is coerced and anything undeclared is DROPPED. The OUTPUT is whatever the final
  \`flow.output\` step names — there is no separate list to keep in step with it — and that step must be LAST,
  since only the last one that runs is answered. Everything else a step produced stays on the server.
- **Whether it runs lives on its TRIGGERS.** Each trigger step carries \`enabled\`, and the action is on when any
  way into it is — there is no switch beside the flow. So "pause this action" means disabling its trigger step(s),
  never deleting them.
- **A step names the credential it uses**, and sees no other. \`credentials\` on the document says which ones the
  action may ask for at all; the secret itself is never yours to see, exactly as with a connector.

\`deleteAction { ref }\` removes one; every \`runServerAction\` step that names it stops resolving, so confirm first.

## Functions
When no server task does what a flow needs — parse a feed, call an API with its own shape, compute something — the
space can have its own: **functions**, TypeScript the platform builds and runs in a sandbox. Their tasks are steps like
any other (\`<namespace>.<action>\`), listed in \`plitzi://actions/{env}/tasks\` once saved.

- **Write** files with \`upsertFunctionFile { path, content }\` (whole files; \`deleteFunctionFile { path }\` removes
  one). \`index.ts\` default-exports the definition:
  \`export default defineFunctions({ allow: { hosts: ["api.example.com"] }, tasks: [{ namespace, action, title, params, run: async (params, ctx) => … }] })\`,
  \`defineFunctions\` from \`@plitzi/sdk-server/functions\`. Files import each other by relative path — no package,
  no Node built-in.
- **\`ctx\` is all a function reaches:** \`ctx.kv\` (the space's store), \`ctx.fetch(url, init)\` to the hosts
  \`allow.hosts\` names (\`*.example.com\` for subdomains), \`ctx.publish/grant/revoke\` (channels),
  \`ctx.data("products.json")\` (one file of the space's data, parsed — never imported), \`ctx.log\`, \`ctx.user\` (who
  asked, never their session). A secret is NAMED, never read: \`ctx.fetch(url, { credential: "stripe",
  headers: { authorization: "Bearer {{ credential.apiKey }}" } })\`. \`signal\` in the init cuts a slow request short
  (\`AbortSignal.timeout(12000)\`).
- **Refuse with \`ActionRefusal\`** (from \`@plitzi/sdk-server/functions\`): its message is written for whoever asked and
  reaches them (\`{{ step.error }}\`, a route's \`400 { error }\`); anything else thrown stays in the run's record.
  \`new ActionRefusal(message, { code })\` names it for code that catches it — compare \`error.code\`, never the message.
- **An API on behalf of a visitor** (their calendar, their music) is an OAuth connection declared as data:
  \`defineFunctions({ oauth: { calendar: { issuer, credential, scopes } } })\` — \`issuer\` for OpenID, or
  \`authorizeUrl\`/\`tokenUrl\`; the credential holds the app's \`clientId\`/\`clientSecret\`. A route redirects to
  \`(await ctx.oauth.connect("calendar", { returnTo: "/settings" })).url\` (\`authorizeParams\` adds to that one consent:
  \`{ prompt: "select_account" }\`), and \`ctx.oauth.fetch("calendar", url)\` calls the API with the token written in;
  \`status\`, \`disconnect\` beside them. The platform keeps the token sealed and renews it — never put one in \`kv\`. The
  user registers \`/fn/oauth/callback\` on the space's host with the provider (\`ctx.oauth.callbackUrl()\` says the
  exact address, for a page that shows it). Not connected yet is a refusal with
  \`code: "oauth-not-connected"\`. \`token\` hands the access token only to a connection declaring \`exposeToken: true\`.
- **Stateless:** nothing a function keeps in memory outlives the call — a module-level cache or counter starts empty
  every time, on whichever instance runs it. What must last goes in \`ctx.kv\`. A call gets 100 ms of CPU and 10 s;
  a task that needs more says so — \`limits: { cpuMs: 1000, wallMs: 20000 }\`, or \`defineFunctions({ limits })\` for
  all — up to the plan's ceiling. Asking above it is refused at save, never quietly cut.
- **Routes** answer HTTP on the space's own host under \`/fn/\`: \`routes: { "GET /boards/:board": (request, ctx) =>
  Response.json(…) }\` answers \`/fn/boards/kanban\` (\`ctx.params.board\`). No page may live under \`/fn\`.
- **Saving builds and checks** the files: the batch is refused with each problem where it is (file and line). A
  namespace the platform uses (\`kv\`, \`http\`, \`flow\`…) is refused.
- **Try it** with \`plitzi_try_function { task, params }\` before a page relies on it: the value, the logs, the error.
  The live site runs what the space was last published with, never the draft. Running functions is part of the paid
  plans: on another plan they save, and a run answers why it did not start — tell the user rather than work around it.

## Data
JSON the space's pages read on the server and never serve — a catalog, prices, a menu: what a page needs whole and
nobody edits element by element.

- **Read** it as a provider does: \`apiContainer\` with \`runtime: "server"\` and \`query: "/data/products.json"\` reads
  \`products.json\` of \`plitzi://data/{env}\`, and the page arrives with it. A browser provider reading \`/data/…\` is
  refused — the data is the server's.
- **Write** it with \`upsertDataFile { path, content }\` (the whole file, as JSON text; \`deleteDataFile { path }\`
  removes one): a path of plain segments ending in \`.json\`. Saved whole, with the batch: a newer copy (somebody saved
  since you read it) refuses it — read it again.
- **What a provider reads is in the page it renders**: data a page must not carry belongs in a server action, which
  answers only what is shown. The live site reads what the space was last published with, never the draft.

## Realtime channels
Pages that see each other — cursors, presence, a shared board, a game. Three parts, all needed:

1. **Declare** the topic pattern with \`patchSettings { channels: { "board:{id}": { access: { mode: "public" }, publish: "server" } } }\`.
   \`publish: "server"\` is for what must be validated and saved first; \`"clients"\` (the default) for what pages send
   directly — add \`presence: true\` for who-is-here.
2. **Subscribe** with a \`channel\` element whose \`topic\` a pattern matches (\`board:{{ id }}\`, a route param).
   Its descendants bind \`channel_<id>\`: \`connected\`, \`members\`, \`messages\`, \`last\`, \`retained\`; flows use its \`onMessage\`,
   \`onJoin\`, \`onLeave\` triggers (\`from\`, \`user\` and the \`state\` the member announced — \`onJoin\` only for who
   came after this page) and its \`publish\` / \`setPresence\` callbacks.
3. **Announce from the server**: an action whose last step is the \`realtime.publish\` task — validate, save, then say so.

A topic no pattern matches is refused by the server and reported by the linter (\`channel-topic\`).

**Private topics** (a room behind a password, a customer's order): declare the pattern \`grant: true\`. The action that
decides the visitor may be there ends with \`realtime.grant { topic }\` and answers its \`grant\`; the \`channel\`
element binds \`grant\` to it. Without one the topic is refused however well its name is known (\`channel-grant\`).
\`realtime.revoke { topic, grant }\` takes one back — or all, naming none — and lets go whoever is on it with it.

**State every screen shares** (a dashboard's lists, a board's settings): declare the pattern \`retain: true\` with
\`publish: "server"\`. The server keeps the latest message of each type it says (\`realtime.publish\`) and hands them to
every page that joins — and to its \`onMessage\` flows, as if just said; the page binds \`desk.retained.lists\`, with no
read of its own and no copy in \`state\`. \`data: null\` forgets a type; a topic keeps at most 64 types and 512 KB.

**Two writers at once**: read-change-write with \`kv.setIf\` (written only if the value is still the one read — empty
\`expected\` = only if nothing is there yet), ordered lists with \`list.put\` / \`list.range\`, and put
\`flow.rateLimit\` first in any public action that writes.

## Feature flags
A flag turns a part of the space on or off without anyone editing it: a feature still being built, a version for
beta users, the old checkout kept until the new one ships. **Not a visibility** — visibility hides an element that is
still rendered; a flag decides whether it exists at all.

- **Declare** with \`upsertFlag { name, description?, value, rules? }\`. \`value\` is its answer when no rule matches;
  \`rules\` are \`[{ when, value }]\` read top to bottom, the first match deciding. A rule's \`when\` is a rule group over
  \`environment\` (\`main\`, \`development\`, \`staging\`, \`production\`), \`hostname\`, \`routeParams.<name>\`,
  \`queryParams.<name>\` and the visitor: \`user.authenticated\`, \`user.email\`, \`user.username\`, \`user.roles\` (with
  \`contains\`). A group with no rules is skipped, never read as "always". \`deleteFlag { name }\` removes one.
- **Gate** an element with \`flag\` on \`upsertElement\` / \`patchElement\`: \`"newCheckout"\` exists only while the flag is
  on, \`"!newCheckout"\` only while it is off — put both side by side for a rollout. On \`upsertPage\` a gated-off page
  answers 404. \`null\` on a patch removes the gate. Gated off, it is not rendered and its server data is not
  resolved — but the space's document, gated elements included, still reaches the browser: a flag is not a secret.
- **Read** it anywhere a source is read: \`{{ flags.newCheckout }}\` in a binding, a \`when\` of a flow step, a computed
  value — and in a server action's steps, where it is resolved on the server.

A gate or a read naming a flag the space does not declare is an error (\`flag-undeclared\`, \`flag-unknown\`): an
undeclared flag is off. A declared flag nothing reads is a warning (\`flag-unused\`) — remove it once the feature
ships. The draft applies flags at once. Flags are not part of a snapshot: each environment has one set, shared by every
snapshot it serves — publishing a snapshot sends the draft's with it (and the snapshot keeps a copy, as a fallback), the
builder's *Publish flags* sends only them, and a rollback keeps them. Above the space, the server rendering it, the SDK embedding it and a tester with the dev tools
may each override a flag; you only ever write the space's own.

`;
