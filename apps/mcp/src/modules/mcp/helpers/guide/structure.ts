/** How a space is put together: shared layouts, components, pages and folders, and its settings. */
export const structureGuide = `## Shared layouts — the chrome a page does NOT contain
A page's tree is usually **not the whole page**. The header, the sidebar and the footer normally live in a **layout
container**: a shell several pages are rendered inside, so the navigation is authored once instead of once per page.

It is a **root of its own** — a \`layoutContainer\` element that no page owns and that is not in the page list — and
a page points at it with two attributes:
- \`layout\` — the shell's ref. This is the whole of "which chrome do I render inside".
- \`layoutContainer\` — the **slot**: the ref of a container INSIDE that shell where this page's own body is placed.

So a page with \`layout: "main-layout"\` renders \`main-layout\`'s whole tree, with its own elements dropped into the
one container it named. Two pages naming the same shell share every element of it — **editing the shell changes
every page that uses it**, which is the point and also the thing to say out loud before you touch one.

**Reading them.**
- \`plitzi://schema/{env}/layouts\` lists the shells: \`ref\`, \`label\`, \`usedBy\` (the pages), \`slots\`, \`elementCount\`.
- Every page in \`plitzi://schema/{env}/pages\` carries \`layout\` and \`layoutSlot\` when it has them.
- Read a shell exactly like a page: \`plitzi://schema/{env}/pages/{layoutRef}\` for its skeleton,
  \`.../pages/{layoutRef}/styles\` for its classes. \`plitzi_search\` reports a layout's elements with the layout as
  their \`pageRef\`.

**Writing them.** Every element/binding/interaction op takes the shell's ref as its \`pageRef\` — there is no separate
vocabulary:
\`\`\`json
{ "type": "upsertElement", "pageRef": "main-layout", "parentRef": "sidebar",
  "element": { "ref": "upgrade-card", "type": "container", "children": [ … ] } }
\`\`\`
- \`upsertLayout\` creates a shell (\`ref\`, \`label\`, \`subType\`). Put the chrome in it with \`upsertElement\`, including
  an empty container to serve as the slot.
- \`upsertPage { layout, layoutContainer }\` attaches a page to it; \`layout: null\` detaches. A \`layoutContainer\` that
  is not an element of that shell is refused — stored, it would render the page's body where nobody sees it.
- \`deleteLayout\` removes a shell and everything in it, and is **refused while any page still renders inside it**
  (the refusal names them). Destructive: what it deletes is on every page that uses it, so confirm first.

**Only some pages?** A block that only some of a layout's pages carry (a newsletter band on two of ten) is not
chrome: make it a **component** and place it on those pages.

**Where does this element belong?** If the user asks for something "on every page" — a nav item, a banner, a footer
link, an upgrade prompt in the sidebar — it belongs in the LAYOUT, not in the page you happen to have open. Check
the page's \`layout\` first; if the element you are looking for is not in the page's own tree, it is in the shell.

## Components — a subtree written once, placed anywhere
A **component** is a reusable subtree: a product card, a pricing tier, a testimonial — written once and placed on
any page as an **instance**. It is part of the space, so it is published, versioned and copied with it. Its tree is
not inside any page: it is a root of its own, like a layout, and **editing it changes every instance** — say so
before you touch one.

It is not a **snippet**. The builder's *Save as snippet* keeps a copy of a block as a file people drop onto pages, and
each drop is the page's own from then on. No operation here writes one: when someone wants a block that stays the same
everywhere, that is a component.

It is **closed**. Inside, a binding or a template reads **\`props\`** — what each instance hands in — and the globals
(\`state\`, \`auth\`, \`navigation\`, \`theme\`, \`variables\`, \`computed\`), never the page an instance sits on. A
component that needs a list row's record gets it as a prop: the INSTANCE binds it (\`item: "{{ list_rows.item }}"\`),
the component reads \`{{ props.item.name }}\`.

**Reading them.** \`plitzi://schema/{env}/components\` lists them: \`ref\`, \`label\`, \`props\`, \`slots\`, \`rootRef\`,
\`instances\`. Read one like a page: \`plitzi://schema/{env}/pages/{componentRef}\` (and \`/styles\`).

**Writing them.**
- \`upsertComponent { ref, label?, props?, slots? }\` declares one — with nothing in it but its root, \`{ref}-root\`, a
  container — or updates the declaration of one that exists (\`props\` is REPLACED whole). Fill it with every
  element/binding/interaction op you already know, with **\`pageRef: "<componentRef>"\`**:
  \`\`\`json
  { "type": "upsertElement", "pageRef": "product-card", "parentRef": "product-card-root",
    "element": { "ref": "product-card-title", "type": "heading" } }
  \`\`\`
- \`upsertComponent { ref, fromRef, instanceRef }\` makes a component OF an element that already exists: the element
  and everything inside it become the component, and an instance named \`instanceRef\` takes its place, so the page
  renders what it did. The way to turn a repeated block into one.
- A **prop** is \`{ type, description, required?, default?, options? }\`, \`type\` one of \`text\`, \`textarea\`,
  \`number\`, \`boolean\`, \`select\` (with \`options\`), \`scalar\`, \`json\`. Its name is read as \`{{ props.<name> }}\`, so
  letters, digits and \`_\` — and never one an instance already has (\`referenceId\`, \`referenceType\`, \`slot\`…).
- A **slot** is an element of the component's tree (usually an empty container) an instance fills with children.
- \`deleteComponent { ref }\` removes one nothing places; while instances remain it is refused, naming them.

**Placing one** is an element: a \`reference\` whose props say which component and hand in its props, one attribute each:
\`\`\`json
{ "type": "upsertElement", "pageRef": "shop", "parentRef": "grid",
  "element": { "ref": "lamp-card", "type": "reference",
    "props": { "referenceType": "component", "referenceId": "product-card", "title": "Lamp" },
    "children": [ { "ref": "lamp-buy", "type": "button", "props": { "content": "Buy", "slot": "product-card-actions" } } ] } }
\`\`\`
A required prop left out, a prop the component does not declare, a value of the wrong kind or a child naming a slot
the component does not have is reported by \`plitzi_apply\`'s \`dryRun\` — fix it before applying.

## Pages & folders
- **A page behind a feature flag**: \`upsertPage { flag: "labs" }\` answers 404 while the flag is off (see **Feature
  flags**); \`flag: null\` removes it.
- **Always set a \`slug\` when creating a page** (\`upsertPage\`) — it is the page's URL path and good practice for a
  clean, stable route (e.g. \`"pricing"\` or \`"posts/:postId"\`). Omit it and the page ref is used as the slug,
  and \`plitzi_apply\` warns so you remember to set a meaningful one.
- **A page slug is RELATIVE — do NOT start it with \`/\`.** The runtime prepends the leading slash (and any folder
  path) itself, so a leading slash doubles it. Write \`"pricing"\`, not \`"/pricing"\`. (upsertPage strips a leading
  slash for you, but write it relative.)
- **Dynamic pages — route params.** A slug segment written \`:name\` (e.g. \`"posts/:postId"\`) is a **route param**,
  exactly like React Router. On that page it is readable **two ways**: as \`{{name}}\` inside a prop, and as the
  data-binding source **\`navigation.routeParams.name\`** (the \`navigation\` module source, global — bindable
  anywhere). So a blog is a \`"posts"\` list page plus a \`"posts/:postId"\` detail page whose \`apiContainer\` query
  binds \`navigation.routeParams.postId\` to fetch that one post. (\`navigation.queryParams.<name>\` exposes \`?query=\`
  string params the same way.)
- **Navigate with the \`Link\` element, not an interaction.** \`link\` is a **container** — it wraps any children and
  navigates on click, so it is the default way to move between pages. Its \`mode\`: \`"page"\` links to another space
  page (set \`href\` to the target page, folder path resolved for you); \`"internal"\` takes a path inside the space and
  resolves \`{{token}}\` templates in it, so a row's "view" link is \`mode:"internal", href:"posts/{{postId}}"\`;
  \`"external"\` is a full URL. \`target\` is \`self\`/\`blank\`/\`parent\`/\`top\`. Reach for the \`navigate\` globalCallback
  only when navigation must be **one step inside a larger interaction flow** (e.g. save, then go) — for a plain link,
  use \`link\`.
- **A link's words are its \`content\`, and an icon beside them its \`icon\`** — \`{ "type": "link", "props": { "mode":
  "page", "href": "pricing", "content": "Pricing", "icon": "fa-solid fa-arrow-right", "iconPlacement": "after" } }\`
  (a \`button\` takes the same two). The icon's class goes in the element's \`icon\` slot (\`style.slots.icon\`). With
  children too, \`contentPlacement\` puts the words \`before\` or \`after\` them. A \`text\` or \`fontAwesome\` inside is
  one element more, and a text keeps a colour of its own instead of the link's (and its hover).
- **The link to the page being shown marks itself**: it carries \`aria-current="page"\`, and its class's \`current\`
  state says how it looks — \`{ "type": "patchDefinition", "ref": "nav-link", "states": { "current": { "desktop": {
  "color": "var(--primary)" } } } }\`. So a header written once in a layout lights the right item on every page; never
  copy the header per page to style one item. A link for a section — a journal and its articles — takes
  \`"current": "section"\` in its props: current on every page under its path too (\`aria-current="true"\`), the same
  state dressing it. The same state dresses any chosen one of a set: a pressed toggle (\`aria-pressed\` — a theme
  toggle's option slot) and a selected tab.
- **A section of a page** is an element with an \`anchor\` (its \`id\` in the DOM: lowercase, digits, \`-\`; one per
  page, layouts included; not inside a list row or a component). A link lands on it with \`hash\`:
  \`{ "mode": "page", "href": "home", "hash": "plans" }\` goes to \`/#plans\` and scrolls there, from any page.

Pages can be grouped into **folders** (the sidebar tree). A folder is \`{ ref, name, slug, parentId? }\`; its \`ref\`
**is its id**, and that id is what a page and a nested folder reference.
- **Folder slugs PREPEND to the page URL — this is how nested URLs are built.** The full path is each ancestor
  folder's slug plus the page slug, joined by \`/\`: a page at slug \`"1-1-1"\` inside \`folder-1\` > \`folder-1-1\`
  resolves to \`/folder-1/folder-1-1/1-1-1\`. So a folder slug is part of the route; keep folder slugs relative too.
- Create/rename/move a folder with \`upsertFolder\` (the \`ref\` you pass on create becomes its id — pick a stable one
  like \`"blog"\`). Nest it under another with \`parentId\` (a folder ref); \`parentId: null\` moves it back to the root.
- Put a page in a folder with \`upsertPage\`'s \`folder\` (a folder ref). A page's \`folder\` is always either **empty
  (root)** or an **existing folder id**: \`folder: null\` or \`folder: ""\` moves it to the root, and any other value
  must resolve to a folder that already exists or is created earlier in the same batch — an unknown folder is
  rejected, never stored.
- \`deleteFolder\` removes a folder and **promotes its contents up one level** — its child folders and its pages move
  to its parent (or the root). A folder cannot be nested under itself or one of its descendants.
- **Disable a page** with \`upsertPage\`'s \`enabled: false\`; \`enabled: true\` re-enables it (defaults to enabled, and
  a page read reports its current \`enabled\`). Disabling only affects the **published SDK runtime** — the page stops
  being routable/accessible to end users. It stays fully **editable here**: you can still read it and apply any op to
  a disabled page. This does not delete it — \`deletePage\` does.
- **A page that fills the window** (a dashboard, a board) takes \`upsertPage\`'s \`documentScroll: "locked"\`: the
  document holds still and only parts with \`overflow: auto\` scroll, so a finger on a tablet no longer drags and
  bounces the page. \`"noBounce"\` keeps the scroll without the rubber band; \`null\` undoes either. Never an
  \`html, body\` rule in \`customCss\`: that holds every page, and the site the space is a widget on.

## Settings
Space-level configuration lives in \`plitzi://settings/{env}\` and is edited with a single **\`patchSettings\`** op
(merge — only the fields you pass change):
- \`customCss\` — **raw global CSS** injected for the whole space. Use it only for genuinely site-wide rules
  (\`@keyframes\`, \`@font-face\`, resets). To style an element, write a **definition** and attach it — never customCss.
- \`notifications\` — how the toasts an \`addNotification\` step shows look: colours (\`background\`, \`text\`,
  \`success\`, \`danger\`, \`warning\`, \`info\`), shape (\`radius\`, \`font\`, \`fontSize\`, \`fontWeight\`, \`lineHeight\`,
  \`minHeight\`, \`border\`, \`shadow\`, \`padding\`) and the parts inside (\`iconSize\`, \`iconGap\`, \`closeColor\`,
  \`closeOpacity\`, \`progressHeight\`), one CSS value each — a token follows the theme: \`{ "type": "patchSettings",
  "notifications": { "background": "var(--card)", "iconSize": "18px" } }\`. Merged field by field, \`null\` removes one.
  It is stored as rules inside \`customCss\` but reads and changes apart from it: never write a \`.Toastify__*\` rule
  yourself.
- \`keepState\` / \`stateStorage\` — keep the runtime state (\`state.<key>\`, what \`setState\` writes) across reloads,
  in \`localStorage\`/\`sessionStorage\`, filed under whoever is signed in. It is the space's setting — pages do not
  take one. \`transientState\` lists the top-level keys never kept (a filter, a demo, a panel left open) — or
  \`keptState\` the only ones kept, when few are (a dismissed notice); one of the two. Do not
  reset kept state from \`onPageLoad\` instead — it is restored later than that and undoes half of the reset.
  \`paintedState\` lists the kept keys the FIRST PAINT shows (the tool a toolbar shows, a name in an avatar): they go
  in a cookie too, so the server draws with them instead of the page swapping them in after load. Small values only.
- **User provider / auth**: \`userProvider\` — \`basic\` for any HTTP+JSON backend, the name of a provider registered
  in the page, or \`""\` for none — plus \`tokenStorage\`, the \`loginUrl\`/\`userUrl\`/\`refreshUrl\`/\`logoutUrl\`
  endpoints and the \`detailsPath\`/\`tokenPath\`/\`refreshTokenPath\`/\`expirationTimePath\` mapping that says where the
  values sit in their responses. \`sessionHintCookie\` is worth setting whenever the backend can: it names a readable
  cookie carrying only expiries, which is what lets a page answer "nobody is signed in" without a request.
  A space served by a self-hosted \`createServer({ auth })\` declares none of these: that server tells its pages where
  they sign in, and only what the space declares overrides it.
  On the Plitzi platform, \`userProvider: "server"\` signs visitors in with their Plitzi account on the space's own
  host: a \`link\` with \`mode: "external"\` to \`/auth/sign-in?return=/\` starts it, \`authLogout\` ends it.
- \`visitorRoles\` — what each visitor role gives, \`{ "author": ["postPublish"] }\`: the permissions an action's
  \`access: { mode: "role" }\` and a page's \`can()\` ask for. A visitor holds ONLY the permissions of their roles here,
  never their account's. Who holds a role is given by email in the builder's Settings → Visitors — never in the
  space's \`settings\`.
- \`channels\` — the realtime channels, by topic pattern (see **Realtime channels**). Merged pattern by pattern;
  \`null\` removes one.
  Example — inject a keyframe globally:
  \`{ "type": "patchSettings", "customCss": "@keyframes spin { to { transform: rotate(360deg); } }" }\`.

`;
