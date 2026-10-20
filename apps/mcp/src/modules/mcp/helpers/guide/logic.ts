import { GLOBALS, OTHER_TRANSFORMERS } from './values';

/** What an element reads and does: bindings, interactions, and what is public. */
export const logicGuide = `## Data bindings
Connect a data **source** to an element field. A binding is \`{ to, source, transformers?, when?, enabled? }\` grouped
by **category**: \`attributes\` (a prop), \`style\` (a style value), \`initialState\` (an initial-state key).
- \`upsertBinding\` adds one, or replaces the binding already feeding the same \`to\` (or \`id\`).
- \`patchBinding\` edits an existing one (matched by \`to\`/\`id\`); \`deleteBinding\` removes it.
Discover valid source paths **and the transformer catalog** in \`plitzi://data-sources/{env}\`. Example — feed a
provider's records into a list element:
\`{ "type": "upsertBinding", "pageRef": "home", "ref": "myList", "category": "attributes",
  "binding": { "to": "items", "source": "apiContainer_products.records" } }\`.

**What an \`apiContainer\` publishes** depends on where it reads. Through a connector (\`runtime: "server"\`) it is the
fixed shape under *Connectors* — \`.records\` or \`.record\`, \`.pageInfo\`, … With a browser \`query\` it is the
response: \`.data\` (the parsed body — an API answering \`{ "items": [...] }\` is read as
\`apiContainer_<name>.data.items\`) and \`.status\` (the HTTP status) — and a \`"server"\` provider with only a
\`query\` (a JSON file the deployment serves) answers in that same shape, so moving it to the server changes no
binding. Fed by a server **action**, it is the action's output at the root (\`apiContainer_<name>.items\`, never
\`.data.items\`). All add \`.isLoading\` (true while asked again too), \`.isEmpty\`,
\`.hasError\` and \`.errorMessage\`.

**Source scope — a source is visible to the provider's DESCENDANTS only.** An element source named
\`<type>_<name>\` (e.g. \`apiContainer_products\`, \`list_food-list\`) is published by that element into the scope of
its **subtree**, so **only elements INSIDE the provider can bind to it**. Binding a sibling or an unrelated element
to it resolves to nothing at runtime. So to consume \`apiContainer_products.records\`, the bound element must live under
that apiContainer; inside a \`list\`, the repeated \`listItem\` and its children read the per-row source
(\`list_<name>.item.<field>\`). The global sources — ${GLOBALS} — have no \`<type>_<name>\` head and are
bindable anywhere. Binding an element to an element source outside its
provider's subtree is schema-valid but **broken at runtime** (the source is not in scope), so
\`plitzi_apply\` treats it as an **error and rejects the batch** — move the element under the
provider, or bind a source that is in scope.

**mockData is builder-only.** An \`apiContainer\`'s \`mockData\` prop feeds sample data **while editing in the
builder**; the published runtime fetches real data instead. Never rely on mockData as the production source — give
the provider a real source: a **connector** with \`runtime: "server"\` (see *Connectors*, the right answer whenever
the API needs a token or the content should be in the HTML), or a browser-side \`query\`/\`method\` for a public URL.

**\`transformers\` — post-process the value before it reaches the field** (\`source → t₁ → t₂ → field\`). An array of
\`{ action, params }\`; the runtime runs them in order and resolves each by its \`action\` alone, so an **unknown
action is silently skipped** and the raw value passes through. Use the **exact** action names from
\`plitzi://data-sources\` (\`transformers\`). The most common is **\`twigTemplate\`** to format a value — the incoming
value is the **\`{{source}}\`** token (NOT \`{{value}}\`) — undefined until the source has a value, so \`{{ source|default('…') }}\` covers the wait; \`{{sourceTo}}\` is the field's previous value. Example —
show a number with units:
\`{ "type": "upsertBinding", "pageRef": "home", "ref": "food-item-time", "category": "attributes",
  "binding": { "to": "content", "source": "list_food-list.item.cookTimeMinutes",
    "transformers": [ { "action": "twigTemplate", "params": { "template": "{{source}} min de cocción" } } ] } }\`.
The others: ${OTHER_TRANSFORMERS} — each one's purpose and params are in \`plitzi://data-sources/{env}\`.
Transformer \`params\` values are strings. Each transformer also takes an optional \`enabled\` flag: set \`"enabled": false\` to keep it in the chain but
skip it at runtime (defaults to true) — the value passes through untouched, and a disabled transformer is not
validated.

**\`when\` — gate the binding** with a QueryBuilder RuleGroup: the binding only applies when the guard passes against
the data source. Shape: \`{ "combinator": "and", "rules": [ { "field": "<path>", "operator": "=", "value": "x" } ] }\`
(operators: \`=\`, \`!=\`, \`<\`, \`>\`, \`contains\`, \`beginsWith\`, \`empty\`, \`in\`, \`between\`, …; nest RuleGroups for
and/or). The guard is validated structurally. Example — only bind when a flag is set:
\`"when": { "combinator": "and", "rules": [ { "field": "status", "operator": "=", "value": "published" } ] }\`.

## Interactions
An interaction **flow** is a **trigger** (an event like \`onClick\`, \`onPageLoad\`) followed by the callbacks/utilities
it runs, in order. You pass the steps **in order** and the stored beforeNode/afterNode/flowId links are computed for
you — never wire them by hand. Each step also has an \`enabled\` flag (see disable vs delete below).

**Each step reads the page as it is when it runs**: a \`when\` or a \`{{ state.x }}\` after a \`setState\` sees the new
value, and one after a \`delay\` sees what changed meanwhile. To act on the value from BEFORE a write, put the reading
step first. A step's \`when\` asks an earlier step only for what it publishes (\`plitzi://explain/<action>\` lists it):
a run's \`<step>.status\` (\`runServerAction\` only), a sign-in's \`<step>.ok\` — any other key is refused
(\`condition-field-unpublished\`). **A trigger fired again while its flow runs is ignored** (no double submit); set
\`"whileRunning": "queue"\` on the trigger node for a stream of events that must each run in order (\`"parallel"\` runs
them at once, \`"latest"\` stops the running flow — its server action or request too — for a search as you type).
**Keyboard shortcuts** are a trigger every element has: \`onKey\` with param \`keys\` — \`"f"\`, \`"shift+f"\`,
\`"mod+k"\` (⌘ on a Mac, Ctrl elsewhere), \`"plus, ="\`, \`"escape"\`. Heard on the whole page while the element is
mounted, ignored while someone types in a field; the flow reads the key pressed as \`{{ <trigger id>.key }}\`.

**Node types & \`elementId\`** — a step names which element (or module) provides the callback it runs. Picking the
**wrong node type for an action** makes the runtime resolve it against nothing, so the step **silently does nothing**:
- \`trigger\` — the event; belongs to the host element. \`elementId\` defaults to the host.
- \`callback\` — a callback provided by a **specific element**. \`elementId\` is that element's name (the flow host by
  default, or another element to act on). Every element
  registers a built-in **\`setState\`** callback that changes **its own attribute or state**: params
  \`category\` (\`"attribute"\` — set a prop like \`content\`/\`disabled\` — or \`"state"\` — \`visibility\` or a style
  selector), \`key\`, \`value\` (a **scalar** whose type follows the target attribute — a real boolean \`true\`/\`false\`
  for a boolean attribute, a number for a numeric one, otherwise a string), and **\`revertOnFinish\`**. Set
  \`revertOnFinish: true\` for a **temporary** change (a "loading…" label, disabling a button while it works): it is
  **undone automatically when the flow finishes**, so you do **NOT** add manual restore steps at the end. This element
  \`setState\` has **no** \`type\` param (that belongs to the global one below). Beside it every element registers
  **\`toggleState\`** — the same write with **no \`value\`**: it stores the OPPOSITE of what is there
  (\`category\`, \`key\`, \`revertOnFinish\`). That is how expand/collapse is authored — **one step on one trigger**,
  never two \`setState\` branches under complementary \`when\` conditions: every step reads the page as it is when it
  runs, so the second sees what the first wrote and flips it back. An element type may also register its own extra
  callbacks.
- \`globalCallback\` — a callback provided by a **source module**, NOT by any element: \`addNotification\` (source
  \`space\`), \`setState\`/\`toggleState\`/\`clearState\` (\`state\`), \`navigate\` (\`navigation\`), \`login\`/\`logout\`/
  \`refreshDetails\` (\`auth\`), \`runServerAction\`/\`cancelServerAction\` (\`actions\`). Its \`elementId\` is the
  **source module id**, never the host element — a node that stored the host element's name here would resolve to
  nothing at runtime. **Omit \`elementId\`**: the MCP sets the correct source and fills the
  builder's **param defaults** (e.g. \`addNotification\` gets \`autoDismiss:true\`, \`autoDismissTimeout:5000\`,
  \`placement:"top-right"\`, \`appearance:"success"\`) for any params you leave out. Use **only** the params each
  callback declares (exact spelling) — for \`addNotification\` the visible text goes in \`content\`; there is **no**
  \`title\`/\`message\`/\`type\` param, and any unknown key is dropped. See the full param schema for each callback under
  \`globalCallbacks\` in \`plitzi://interactions/{env}\`.
- **Two \`setState\`s (and two \`toggleState\`s) — do not mix them:** the **element** \`setState\` (nodeType
  \`callback\`, on an element, category/key/value/revertOnFinish) changes THAT element's attribute/state and is what
  you want to change a button's label or disabled flag. The **global** \`setState\` (nodeType \`globalCallback\`,
  source \`state\`, key/type/value) writes \`runtime.state.<key>\`. They share a name but have different node types
  AND different params, and \`toggleState\` splits the same way: on an element (category/key/revertOnFinish) it flips
  that element's own field; on source \`state\` (key) it flips \`runtime.state.<key>\`. Pick the element one when
  nothing outside the element needs to know it is open; pick the state one when something else binds to it.
- \`utility\` — a built-in utility action (no element/source module); nodeType \`utility\`. Use the **exact** param
  names: \`delayTime\` waits \`time\` milliseconds (**not** \`delay\`), \`twigTemplate\` (\`returnMode\`, \`template\`),
  \`webHook\` (\`url\`, \`method\`, …), \`copyToClipboard\` (\`text\`). See \`utilities\` in
  \`plitzi://interactions/{env}\`.

**A param value can be a data binding.** Any interaction param may hold a \`{{ source }}\` token instead of a literal —
it resolves at runtime exactly like a prop binding, using the same source grammar (\`<type>_<name>.<path>\`, or a
module source like \`navigation\`/\`state\`). This is how a step reacts to *the data in context*: inside a \`listItem\`,
a click on a row can show \`addNotification\` with \`content: "{{ list_<name>.item.name }}"\` — the clicked row's field.
The value follows the source's type, so a token is valid even where a param expects a boolean/number. Copy/paste of an
element repoints these tokens to the copies' names automatically, along with the element's bindings.

**Navigating between pages — prefer the \`Link\` element over an interaction.** For a plain "go to page X" the right
tool is a \`link\` element (a container, see *Pages & folders*), not a \`navigate\` interaction step. Use the
\`navigate\` globalCallback only when the navigation is one step of a larger flow (e.g. submit a form, then go).

Tools:
- \`upsertInteractionFlow\` — create or replace one flow. The FIRST node must be a \`trigger\`. Pass \`flowId\` (the
  trigger's node id) to replace an existing flow. Example (elementId omitted — the MCP wires it to \`space\` and fills
  the notification defaults):
  \`{ "type": "upsertInteractionFlow", "pageRef": "home", "ref": "cta", "nodes": [
    { "nodeType": "trigger", "action": "onClick", "title": "Click" },
    { "nodeType": "globalCallback", "action": "addNotification", "title": "Notify",
      "params": { "content": "Saved!" } } ] }\`.
- \`patchInteractionNode\` — change one step in place (by \`nodeId\`); \`params\` merge onto the node.

**Disable vs delete a step — do not confuse them (three different intents):**
- **Disable / deactivate / turn off a step** (keep it in the flow, just stop it running): \`patchInteractionNode\`
  with \`{ "enabled": false }\`. Re-enable with \`{ "enabled": true }\`. This is NOT a deletion — the step stays.
- **Remove one step** from a flow: \`deleteInteraction\` with \`nodeId\` (its neighbors are re-linked).
- **Remove the whole flow**: \`deleteInteraction\` with \`flowId\` (the trigger node id).

So "deactivate the addNotification step" means \`patchInteractionNode { enabled: false }\` — never delete the step, and
never delete the flow. \`deleteInteraction\` is **destructive and not undoable**: only use it when the user asked to
*remove* something, and **confirm with the user before deleting** a step or a flow.

Discover valid actions in \`plitzi://interactions/{env}\`: \`actions\` = observed, \`globalCallbacks\` /
\`elementCallbacks\` / \`utilities\` = the built-in vocabularies with their full param schema, so you know the exact
node type and valid params per action. An element read lists its flows as ordered nodes (each with its \`id\` and
\`enabled\`), so a follow-up patch/delete needs no extra read.

## What is public — and where a secret goes
A space is served to anyone who opens it, and everything it is made of goes with it:

- **The documents.** Every page, layout and component, every schema and style variable, every attribute, binding,
  flow param and \`mockData\` reaches the visitor's browser with the page. Hiding an element (\`visible: false\`, a
  flag, a condition) does not remove it from what is sent.
- **The files.** A file on one of the space's public buckets is on the internet at its address, signed in or not —
  for pictures, fonts and data every visitor may see.

So a secret — an API key, a token, a password — never goes in a document or a public file. It is a **credential**,
created by the space owner in the builder, which a connector, an action or a function **names** and never carries.
Data only some visitors may read comes from a \`runtime: "server"\` provider or a server action whose \`access\` checks
who is asking — never from a public file or a document the page filters on the client.

`;
