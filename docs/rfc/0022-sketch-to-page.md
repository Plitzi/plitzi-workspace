# RFC 0022 — Sketch to page ("make it real")

- **Status:** Proposal — to be discussed before any work starts
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-01
- **Scope:** the builder (`apps/builder`, a sketch surface and the AI chat), the co-worker's MCP tools (`apps/mcp`),
  the preview service, and optionally Pizarra (`plitzi-sdk-server` seed) as a second place a sketch can come from

---

## 1. Summary

A person draws what a page should look like — boxes for a header, a hero, a grid of cards, a form — and Plitzi turns
the drawing into a real page of the space: real elements, the space's own classes and colour tokens, its components,
bindings where the sketch says where data goes. The result is not a picture of a page; it is the page, editable in the
builder like any other.

This is tldraw's "Make Real", but where the output is a Plitzi space rather than a throwaway HTML file. That is the
point: everything downstream — publishing, the builder, components, server actions, export to a project — already
works on what this produces.

It was first suggested as a Pizarra feature. It belongs to the **builder**: the builder is where a page is made, its
users are the ones asking "draw it and make it", and the output is a page of the space being edited — not something on
a whiteboard.

## 2. What exists already

| Piece | Where | What it gives this feature |
| --- | --- | --- |
| AI chat with attachments | `apps/builder/src/modules/AI` (`AiAttachment`) | An image can already be handed to the co-worker |
| Wireframe preview in the chat | `AIWireframePreview` | A way to show a proposed layout before it is applied |
| Authoring through the MCP | `apps/mcp` (`upsertPage`, `upsertElement`, `upsertComponent`, styles, bindings) | The only write path a model needs — validated, refused with the fix in the message |
| Visual preview + screenshots | `services/preview` (SSR `/__preview` + screenshot service) | A picture of what was built, to compare with the sketch |
| `sdk-authoring` + lint | `packages/sdk-authoring` | Everything written is held to the same rules as hand-written authoring |
| Components (ex-RFC 0021) | `schema.components` | Repeated sketched blocks can become one component with props |
| Pizarra frames + its MCP | `prisma/seeds/spaces/demo/pizarra` | A second, collaborative place to draw — and an agent that already reads frames |

Nothing in that list has to change shape. The feature is a surface to draw on, a pipeline, and a review loop.

## 3. The proposal

### 3.1 Where the sketch comes from

1. **A sketch pad in the builder** — a panel (or a mode of the canvas) with a few tools: rectangle, text, line,
   image placeholder, "list of these", and a pen for annotations. Deliberately small: it is a wireframe, not a design
   tool.
2. **A picture** — pasted or dropped into the AI chat (a photo of a whiteboard, a screenshot of another site, a
   Figma export). Works today as an attachment; this RFC gives it a dedicated "Make it real" action.
3. **A Pizarra frame** (later, optional) — "Send to Plitzi" on a frame: the frame's elements are already structured
   data (boxes, texts, groups), which is a better input than pixels.

Structured input (1 and 3) is read as data first and as an image second; a picture (2) only as an image.

### 3.2 The pipeline

1. **Read the sketch** into a layout intent: regions and their roles (header, hero, card grid, form, footer), the
   text written in them, repeated blocks, annotations ("logo here", "list of products").
2. **Map the intent onto the space**: its layouts (a page that should sit in the existing layout does), its classes
   and tokens (never new colours when the space has them), its components (a repeated block that matches one is an
   instance; one that does not may become a new component), its data (a "list of products" next to a connector the
   space has becomes a bound list).
3. **Write it** through the MCP's ops, as a draft page (or into the selected container), in one batch — refused as a
   whole if any op is refused, with the refusal fed back to the model.
4. **Look at it**: render the result with the preview service and compare it with the sketch. Up to N rounds
   (proposed: 2) of "this region is missing / out of order / wrong size" before showing it to the person.
5. **Hand it over**: the person sees sketch and result side by side and accepts (the draft becomes the page),
   iterates ("make the hero taller", or a new annotation drawn on the screenshot), or discards it.

### 3.3 Iterating by drawing on the result

The screenshot of the result can be drawn on: circle the grid and write "3 columns", cross out a block. Those marks
are a new sketch whose target is the existing page, so the second pass edits instead of rebuilding.

## 4. Decisions to take

| # | Question | Proposed |
| --- | --- | --- |
| D1 | Builder-only first, or Pizarra too? | Builder first; Pizarra's "Send to Plitzi" as phase 3 |
| D2 | A sketch pad of our own, or images only at first? | Images first (it is nearly free: attachments exist), pad in phase 2 |
| D3 | Output: a new page, or into the selection? | Both: a new draft page by default, into the selected container when one is selected |
| D4 | Self-review rounds against the screenshot | 2, configurable per plan |
| D5 | Create components from repeated blocks automatically? | Propose them in the review, never silently |
| D6 | Which model, and how it is metered | The co-worker's model and the existing AI metering; a "make real" counts as one run |
| D7 | Where the sketch is kept | With the page's change history entry, so "what was this made from" survives |

## 5. Phases

1. **Picture → page**: "Make it real" on an image attachment; draft page; side-by-side review; accept/discard.
2. **Sketch pad + structured reading**; iterate by drawing on the screenshot; component proposals.
3. **Pizarra → Plitzi**: a frame sent to a space through the Pizarra agent or a connector.

## 6. Left open

- Whether the sketch pad should reuse Pizarra's canvas (it is a seed plugin, not a platform package) or be its own
  small element.
- How a sketched form maps to a server action the space does not have yet (propose one? leave the submit unbound?).
- Responsive intent: a sketch is one width. Infer tablet/mobile, or ask for a second sketch?
