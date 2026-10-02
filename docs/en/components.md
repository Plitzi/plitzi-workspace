# Components

A **component** is a reusable subtree of a space — a product card, a pricing tier — written once and placed anywhere
as an **instance**. It is part of the space document, so it is published with every snapshot, rolled back with it,
copied by templates and exported by `plitzi create --from`, with no code of its own doing any of that.

This is how the platform implements them. For authoring one, see the `plitzi-authoring` skill
(`packages/sdk-authoring/skills/plitzi-authoring/reference/components.md`) and the website's `/docs/components`.

## Components and snippets

Both keep a block to use again; they differ in what a placement is.

| | Component | Snippet |
| --- | --- | --- |
| Kept | in the space document, `schema.components` | a JSON file on a space's CDN (`snippets/`, resource type `snippet`) — no document holds it |
| Shape | `SpaceComponent`: its own `flat`, `props`, `slots` | `Snippet` (`@plitzi/sdk-shared`): a definition, `schema.flat` + `schema.variables`, a style |
| Placed as | a `reference` element naming it (`referenceId`) | a copy of its elements, inserted by `SCHEMA_ADD_SNIPPET` / `SpaceAddSnippet` |
| An edit to it | renders in every instance | reaches nothing already placed |
| Versioned | with the space's snapshots | not at all: a file, replaced by uploading another |
| Reaches | its own space | any space whose CDN holds the file |
| Written by | *Save as component*, `ComponentSpec`, MCP `upsertComponent` | *Save as snippet* (`FlatMap.flatAsSnippet`), `authorSnippet` |

A snippet entering a space is fitted to it once, where it is dropped (`fitSnippet`): ids and classes whose names are
taken come in renamed, and the space keeps its own element-type rules and tokens (`mergeSnippetStyle`) — see
`docs/en/authoring-spaces.md` §9. An instance becomes the snippet-like copy by **Detach** (`detachInstance`).

## Where a component lives

```ts
type Schema = {
  flat: Record<string, Element>;            // the pages and their layouts — never a component's tree
  pages: Element['id'][];
  components: Record<string, SpaceComponent>;
  // …
};

type SpaceComponent = {
  id: string;                               // the key, and what an instance names in `referenceId`
  label?: string;
  folder?: string;
  props?: Record<string, ComponentProp>;    // `BuiltinParam` minus its functions (`@plitzi/sdk-shared`)
  slots?: string[];                         // elements of `flat` below an instance fills
  rootId: string;
  flat: Record<string, Element>;            // its own tree: `rootId` with no parent, everything else under it
};
```

- **`schema.flat` holds only what a page renders.** A layout is there because a page names it and renders inside it;
  a component belongs to no page, so its tree is a `flat` of its own.
- **The root is an ordinary element.** What makes it a component is its entry in `schema.components`.
- **Its style is the space's `Style`**, like any element's. There is no second style document.
- **Ids are one namespace across every tree.** An id alone says which tree it is in, so nothing that edits an element
  has to name the tree.

## The operations, in one place

`@plitzi/sdk-schema/helpers/components` is the only implementation; the builder's reducer, the server's `Space`
model and the MCP all call it.

| Function | What it does |
| --- | --- |
| `treeOf`, `documentIds`, `flatMapOf` | The tree an id is in; every id of the document; a `FlatMap` over that tree held to the ids of the others |
| `addComponent(schema, component, from?)` | Declares one with its own tree, or — with `from` — makes one OF a subtree, leaving an instance in its place |
| `updateComponent` | Changes the declaration (label, folder, props, slots) — never the tree, which is edited element by element |
| `removeComponent` | Removes one nothing places; refused while instances remain |
| `detachInstance` | Replaces an instance with a copy of the component, with deterministic names (`card` → `card-2`) |
| `renameElement` | Renames across every tree, carrying component roots, slots and the `slot` children name |

Element edits (`SpaceAddElement`, `SpaceUpdateElement`, `SpaceMoveElement`…) keep their arguments: the server and the
reducer resolve the tree from the id with `flatMapOf`. A move between two trees is refused — a subtree enters a
component through `addComponent` and leaves one through `detachInstance`.

The declaration has four mutations of its own — `SpaceAddComponent`, `SpaceUpdateComponent`, `SpaceRemoveComponent`,
`SpaceDetachInstance` — and four live events (`SPACE_ADD_COMPONENT`, …). Each event carries the call, not its result,
like a rename: every connection holds the same document, so replaying the call is exactly what the writer did. The
server holds what arrives to the event's own schema (`validateSpaceEvent`) before it applies it.

## Rendering an instance

An instance is a `reference` element with `referenceType: 'component'` and `referenceId: <component id>`. **Each prop is
an attribute of the instance**, so templates (`{{ list_rows.item.name }}`) and bindings (`to: 'title'`) reach a prop
with no mechanism of their own.

`Reference` renders the component's root under:

- a `ReplicaProvider` and a `StoreProvider` with `inherit="live"` and a segment of its own — the scope a list row gets,
  so the same ids placed twice keep their own element state;
- that scope's value: `schema.flat` = the component's tree (deep-merged over the page's, which is safe because ids are
  unique) and `runtime.sources.props` = every declared prop, from the instance's attribute, else the default, else
  `null`. Every declared prop is always present, so an inner instance never reads an outer one's prop of the same name.
  For the same reason `props` is a SETTLED source (`COMPONENT_PROPS_SOURCE`): attribute templates keep an empty token
  for a later pass (`{{ redirect }}` before the query is read), but one reading `props` prints nothing — a prop an
  instance left out is an answer, not a wait;
- `LayoutBody`, with one body per slot. `ElementLayout.slots` is the list the slot renderer reads — a layout has one
  slot, a component the ones it declares — so layouts and components fill slots through the same code. Each child of
  the instance names its slot in `attributes.slot`; with one declared slot it may leave it out.

- In preview an instance draws no node of its own: the component's root is what stands in the page, so the
  instance's class and what its own `visible` says go on the root (`replicaClassName`, shared with an element
  reference).
- **A flow names the elements of its own instance.** Every instance renders the same ids, and the interactions
  manager resolves a step's target nearest first — the instance (or list row) the flow fired in, then the ones around
  it, then the page (`InteractionsManager.getCallbacksAvailables`). A card's "Details" opens that card's panel.
- **A list row keeps its state with its record.** Rows are keyed by each record's `id` when every record has a unique
  one, else by position, so filtering a list of instances does not hand one product's open panel to another.

## Closed scope

Inside, a component reads `props` and the globals, never the page around an instance. The structural validator
checks each component's tree as a fragment from its root, so a binding or a step naming a page element is reported as
unresolved; `lintSpace` lints each tree with a context of its own, in which `props` is a name and `props.<name>` must be
declared. The authoring gate (`authorSpace`) refuses both, with the fix in the message.

## What checks what

| Where | What |
| --- | --- |
| `validateSchema` (integrity) | Each tree as a fragment; `DUPLICATE_ELEMENT_ID` across trees; `COMPONENT_ROOT_MISSING`, `COMPONENT_ROOT_HAS_PARENT`, `MISSING_COMPONENT_SLOT`, `INVALID_COMPONENT_PROP`, `COMPONENT_CYCLE` |
| `validateSchema` (references an edit can leave) | `UNRESOLVED_COMPONENT`, `UNKNOWN_COMPONENT_SLOT` |
| `lintSpace` | `prop-missing`, `prop-value`, `prop-unknown`, `props-outside-component`, and every element rule inside each tree |
| `authorSpace` | An undeclared component or prop, a required prop missing, a value of the wrong kind, a child for an undeclared slot, a prop name that is not one (`propNameProblem`) |

## The builder

- **Components**, at the foot of the Elements panel (`apps/builder/src/modules/Components`), searched with the
  elements: list with instance counts, drag to place like an element, create, edit the declaration, remove.
- **Open in canvas**: `componentOpen` in the builder store. `AppContainer` draws the builder inside a scope holding the
  component's tree (`useOpenComponent`), keyed by the component, so the canvas, the layers and the element tools find
  its elements by id. A banner says the canvas is a component.
- **Save as component** (overlay and context menu), **instance tools** in the element settings (open, detach, slot of
  each child), and the instance's props drawn from its component's declaration (`Reference/Settings`).

## The MCP

`upsertComponent` (declare, update, or make one `fromRef` an element) and `deleteComponent`. Every element, binding and
interaction op works inside a component with `pageRef: "<component>"`: the dispatcher runs it on a view of the space
whose `flat` is the component's tree (`componentView`), and `guardNewRef` checks new names against the whole document.
`plitzi://schema/{env}/components` lists them; `pages/{component}` reads one. Detaching is the builder's alone.

## History

A component's elements are `element` entries like a page's, and its declaration is a `component` entry
(`diffSchema` in `@plitzi/sdk-shared/history`).

## Left open

- **A workspace library**: sharing components across spaces. The intended shape is a library space whose components
  are COPIED into another space with `source: { spaceId, revision, componentId }`, updated on demand, never linked
  live — a live link would make a revision depend on another space's state. The snippet manifest
  (`SnippetSpec`) already carries a subtree with the style it reads.
- **Outward events**: a component declaring callbacks an instance binds flows to (`onSelect`). Today a component writes
  `runtime.state`.
- **Per-instance style** beyond a class on the instance: variants are driven by props.
- **A nesting depth limit**: nesting is allowed and cycles are refused; no depth limit is enforced.
