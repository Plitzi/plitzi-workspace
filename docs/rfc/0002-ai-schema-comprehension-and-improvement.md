# RFC 0002 — AI schema comprehension and improvement

- **Status:** Proposal (not implemented)
- **Author:** Carlos Rodriguez
- **Date:** 2026-06-21
- **Scope:** `@plitzi/sdk-schema`, `@plitzi/sdk-elements`, and the MCP/AI toolset in `plitzi-sdk-server`

---

## 1. Summary

Define what is missing for AI agents (Claude/MCP) to **(a) fully understand** the
Plitzi schema, **(b) improve** it, and **(c)** how they should operate optimally
over schemas of thousands of lines without saturating context.

The system is already advanced: a mature MCP toolset exists. This RFC starts from
what is there, identifies the real gaps, and proposes a prioritized design.

---

## 2. Starting point (what already exists)

The schema is a **normalized graph**:

```
flat[id] → {
  id,
  definition: { type, label, items[], parentId, rootId,
                styleSelectors, bindings, interactions, initialState },
  attributes
}
pages[], pageFolders[], variables[]
```

- Styles **by reference** (`styleSelectors` → separate style document).
- Interactions as a **node graph** trigger→callback embedded per element.

Existing MCP/AI tooling:

| Capability | Tool |
|---|---|
| Type catalog (+ default CSS) | `get_element_types` |
| Page outline | `get_page` (adapter `getPage`) |
| Mutation | `create_element`, `update_element`, move/remove (GraphQL) |
| Preview with non-persisted changes | `preview_element` (overrides) |
| Style / brand | `get_style_tokens`, `design_style_guide`, `design_brand_identity`, `design_color_palette`, `sketch_wireframe` |
| Concept | `preview_concept` |
| User interaction | `ask_question`, `flag_irrelevant` |
| Structural validator | `validateSchema` (wired into persistence, `Space.ts`) |

---

## 3. Part A — Fully understand the schema

Structural validity is well covered. The gaps are **semantic contract**:

### Gap A1 — Incomplete attribute contract (highest priority)

`get_element_types` today exposes only **default CSS + subTypes** (derived from
`defaultElements` in `elementDefaults.ts`). It does NOT expose which `attributes`
each type accepts, their enums, required flags, or semantics. The agent infers
them from examples.

> **Proposal:** a machine-readable **element manifest**: per type, a schema
> (Zod/JSON-Schema) of its attributes (kind, enum, required, default,
> description, accepts children?). This knowledge currently lives scattered
> across each `Settings.tsx`; it must be lifted into a **single source of truth**
> consumed by the builder *and* the MCP tool.

### Gap A2 — Interaction vocabulary not exposed

Interactions are a trigger→callback node graph with actions (`onClick`→
`setState`…) and `params`. A `get_interaction_types` / `get_actions` catalog of
triggers, actions, and their param-schemas is missing.

### Gap A3 — `bindings` / variables grammar

Every element has `bindings`, but its syntax (how to bind an attribute to a
variable/data source) is in no consumable contract.

### Gap A4 — Invariants as a contract + closed loop during editing

The validator is strong but runs at the **persistence layer**, not as a tool the
agent invokes while editing. Recommended pattern:

- The agent **never edits raw `flat`** (keeping `parentId`+`items`+`rootId` in
  sync by hand is fragile); it uses only mutations that preserve invariants.
- After each mutation, run `validateSchema` and return structured errors as
  feedback **before** saving.

---

## 4. Part B — Improve the schema (needs an objective function)

Validity ≠ quality. To *improve*, the agent must measure, not just edit:

### Gap B1 — Real visual feedback

`preview_element` returns schema+style for rendering, but the pixel render
happens client-side. A **headless render → screenshot** returned to the agent
(multimodal) is missing. Without seeing the result, "improve" is blind.

### Gap B2 — Objective quality signals

A linter covering what the structural validator does not: contrast/accessibility,
heading order, `alt` on images, responsive consistency, brand-token usage vs.
hardcoded values. Turns "better" into something measurable.

### Gap B3 — Intent / ground truth

To improve, the agent needs the page's *purpose* (goal, audience, brand).
`design_brand_identity`/`design_style_guide` contribute part; page-level intent
is missing.

### Gap B4 — Golden corpus + evals

A set of good schemas + a harness measuring whether an agent edit improves (and
does not regress). This is what enables trusting autonomy.

---

## 5. Part C — Agent context strategy

**Problem:** a schema may be thousands of lines of JSON; reading it whole
saturates context.

**Mental model:** the schema is an **id-addressable database**, not a document.
The agent works it like a codebase: index (file tree), search (`grep`), targeted
read (open a file), surgical edit.

### 5.1 Five layers

1. **Cheap index first (progressive disclosure).** Start with the tree skeleton
   (`id/label/type/parentId`) — tens of lines, not thousands. `getPage` already
   does almost this (returns `PageElementSummary[]` without styleSelectors /
   interactions / bindings). A leaner mode without `attributes` is possible.
2. **Addressable read.** `get_element(id)` returning the *full* of ONE element
   (definition + resolved styles + interactions + bindings). The agent descends
   only to the 2-3 elements it will touch. **(Missing.)**
3. **Search instead of scanning.** `find_elements({ type, textContains,
   hasInteraction, styleSelector }) → ids`. The schema's "grep". **(Missing —
   biggest multiplier.)**
4. **Lazy resolution of expensive subtrees.** Styles are already by reference
   (don't inline). Interactions are embedded and potentially large → fetch on
   demand, never in the index.
5. **Surgical mutations.** The agent never re-emits the whole `flat`; it uses
   `update_element(id, attrs)` / `move_element` / `create_element`. Saves both
   input **and** output tokens, and preserves invariants. **(Already exists.)**

### 5.2 High-impact techniques

- **Server-side projections.** Return pre-reduced views (markdown outline, or a
  "what changed" diff) instead of raw JSON. Pushing reduction to the server is
  the most token-efficient move.
- **Visual feedback > reading JSON.** A screenshot is cheaper and more
  informative than reading JSON to imagine the layout (links to Gap B1).
- **Sub-agents for large sweeps.** Delegate broad analysis (e.g. "audit all
  buttons") to a sub-agent that reads in breadth and returns only the conclusion
  (ids + summary), keeping the main context clean.

### 5.3 Golden rule

> The agent pays tokens only for what it touches:
> **cheap index → search → targeted read → surgical edit → screenshot to
> verify.** A 5,000-line schema is worked with hundreds of tokens, not tens of
> thousands.

---

## 6. What exists vs. what is missing

| Piece | Status |
|---|---|
| Type catalog (default CSS) | ✅ `get_element_types` |
| Index/outline (tree skeleton) | ✅ `getPage` |
| Surgical mutations | ✅ create/update/move |
| Preview (data for render) | ✅ `preview_element` |
| Structural validator | ✅ `validateSchema` (in persistence) |
| **Per-type attribute manifest** | ❌ Gap A1 |
| **Interaction / bindings catalog** | ❌ Gap A2 / A3 |
| **`validateSchema` as an editing-time feedback tool** | ❌ Gap A4 |
| **`get_element(id)` targeted full read** | ❌ Layer 2 |
| **`find_elements` (search)** | ❌ Layer 3 — biggest impact |
| **Compact server-side projection/outline** | ❌ §5.2 |
| **Headless render → screenshot to the agent** | ❌ Gap B1 |
| **Quality linter (a11y, contrast, tokens) + evals** | ❌ Gap B2 / B4 |

---

## 7. Prioritized recommendation

| # | Action | Unblocks |
|---|---|---|
| 1 | **Per-type attribute manifest** (single source, via tool) | Full comprehension (A1) |
| 2 | **`find_elements` + `get_element(id)`** | Working large schemas without saturating context (C) |
| 3 | **`validateSchema` as a post-mutation feedback tool** | Safe editing (A4) |
| 4 | **Interaction and bindings catalogs** | Logic/data, not just layout (A2/A3) |
| 5 | **Headless render → screenshot** | Improvement with visual feedback (B1) |
| 6 | **Quality linter + evals** | Measurable, trustworthy "improvement" (B2/B4) |

Highest immediate ROI: **#1** (the only hard blocker to understanding without
guessing) and **#2** (what makes operating over huge schemas viable). From #5
onward is what separates "edits validly" from "truly improves".

---

## 8. Design of the key pieces (context layer)

### `get_element(id)`

- **Input:** `{ elementId: string, resolve?: { style?: boolean; interactions?: boolean; bindings?: boolean } }`
- **Output:** the full element; expensive subtrees (style/interactions/bindings)
  only when requested (lazy by default).

### `find_elements`

- **Input:** `{ pageId?: string, type?: string, textContains?: string,
  hasInteraction?: boolean, styleSelector?: string, limit?: number }`
- **Output:** `PageElementSummary[]` (same lightweight shape as `getPage`), not
  the full — the agent then opens what it needs with `get_element`.

### Attribute manifest (single source of truth)

- Per type: `{ attributes: Record<name, { kind, enum?, required, default,
  description }>, acceptsChildren: boolean, subTypes?: string[] }`.
- Origin: extract from the `Settings.tsx` files into a declarative descriptor
  reused by builder + MCP. Expose via `get_element_types` (extended) or a new
  `get_element_schema(type)`.

---

## 9. Relationship to other RFCs

- [RFC 0001 — Native mobile renderer](./0001-native-mobile-renderer.md): a
  per-type attribute manifest (Gap A1) also benefits the native renderer, since
  it documents the contract each element implementation must satisfy.
