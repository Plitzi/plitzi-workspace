# RFC 0022 — Sketch to page ("make it real")

- **Status:** Proposal, revised — under review; no work started
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-01 (revised 2026-10-06)
- **Scope:** the builder (`apps/builder`: the sketch, the review), the MCP (`apps/mcp`: what an agent reads and
  proposes with), the page server's preview and screenshots, and `plitzi-sdk-server` (where sketches and proposals are
  kept, metering, the plan's ceiling)

---

## 1. Summary

A person draws what a page should look like — boxes for a header, a hero, a grid of cards, a form — or drops in a
picture of one, and an agent turns it into a real page of the space: real elements, the space's own classes and colour
tokens, its components. The result is not a picture of a page; it is the page, editable in the builder like any other.

This is tldraw's "Make Real", but where the output is a Plitzi space rather than a throwaway HTML file. Everything
downstream — publishing, the builder, components, server actions, export to a project — already works on what this
produces.

**The agent is not Plitzi's.** It is whatever the person already works with — Claude Code or any other harness —
connected to the space through the MCP. The builder is where the person draws and decides; the MCP is where the agent
reads the sketch and proposes; the loop between "propose" and "look at it again" is the agent's own. Plitzi runs no
model for this.

## 2. What exists already

| Piece | Where | What it gives this feature |
| --- | --- | --- |
| Authoring through the MCP | `apps/mcp` (`plitzi_apply`: pages, elements, components, styles, bindings) | The ops a proposal is made of — validated, refused with the fix in the message, `dryRun` without writing |
| Screenshots as images the model sees | `plitzi_look` and `plitzi_apply`'s `look` (`imageResult`), the screenshot service | A picture of what a proposal builds, from unsaved operations, at desktop and mobile widths |
| `sdk-authoring` + lint | `packages/sdk-authoring` | Everything proposed is held to the same rules as hand-written authoring |
| Components (ex-RFC 0021) | `schema.components` | Repeated sketched blocks can become one component with props |
| The space's private bucket | `space_cdn_bucket` (functions, data) | Where a sketch's picture is kept |
| Change history | `space_changes` | Where an accepted proposal lands, one batch, naming the sketch it came from |
| Pizarra's canvas | `plitzi-sdk-server` seed `demo/pizarra` | The model the sketch pad takes after: rough.js strokes, colours by name, tool keys, smart guides |

## 3. The design

### 3.1 Where the sketch comes from

1. **A picture** (phase 1) — uploaded, pasted or dropped into the page's sketch panel in the builder: a photo of a
   whiteboard, a screenshot of another site, a Figma export.
2. **The sketch pad** (phase 2) — a small surface in the builder: rectangle, text, line, image placeholder, "list of
   these", and a pen for annotations. Deliberately small: a wireframe, not a design tool.
3. **A Pizarra frame** (phase 3) — "Send to Plitzi" on a frame.

A sketch from the pad is structured data (what each box is, the text in it, which block repeats) and a picture; a
picture is only a picture. The agent reads both when both exist, the data first.

**The pad is the builder's own, after Pizarra's.** Pizarra's canvas is ~17k lines whose core is woven with its
collaboration (remote cursors, veils, votes, sounds), and it is a seed plugin, not a platform package. The pad mirrors
what makes it pleasant — a 2D `<canvas>` drawn with rough.js and perfect-freehand, colours stored by name so the
drawing follows the theme, the same tool keys, smart guides, the left tool bar — over a model of its own built for
wireframes, with the "list of these" Pizarra does not have.

### 3.2 The flow

1. **Sketch** — the person makes a sketch on a page and picks its target: a new page (the default) or the selected
   container. It is kept in the space (`requested`).
2. **Ask** — "Make it real" gives the person the line to hand their agent, naming `plitzi://sketches/{id}`.
3. **Read** — the agent reads the sketch through the MCP: its data, its target, and its picture as an image.
4. **Propose** — the agent calls `plitzi_propose` with the operations that build it. The MCP validates them as a dry
   run, renders them at desktop and mobile without saving anything, keeps the proposal with the versions of the space
   it was made against, and answers with the screenshots — so the agent can compare with the sketch and propose again.
   The space is not touched.
5. **Review** — the builder shows the latest proposal as it arrives: the sketch beside the screenshots, the components
   the agent suggests (each to tick, never made silently), and the agent's notes (a form left unbound, a picture it
   could not place).
6. **Decide** — **Accept** applies the proposal in one batch: one change-history entry naming the sketch. If the space
   changed under it, accepting is refused and the proposal is to be redone. **Discard** leaves nothing in the space.
   **Iterate** (phase 2) is drawing on a screenshot: the marks are a new revision of the sketch, which the agent reads
   with the proposal it amends, so the second pass edits instead of rebuilding.

### 3.3 Why a proposal is not a page

A draft page written into the space and deleted on discard would fill the change history with work nobody kept, clear
the builder's undo stack on every write that reaches it by subscription, and — being disabled to stay unpublished —
most likely not be reachable by the preview that has to screenshot it (the preview routes as a published page does,
and drops disabled pages; inferred from the code, not tried). A proposal is operations kept beside the sketch and rendered
from a copy, which the preview already does; only accepting writes.

## 4. Decisions

| # | Question | Proposed |
| --- | --- | --- |
| D1 | Builder-only first, or Pizarra too? | Builder first; Pizarra's "Send to Plitzi" is phase 3 |
| D2 | A sketch pad of our own, or images only at first? | Pictures in phase 1; the pad, after Pizarra's, in phase 2 |
| D3 | Output: a new page, or into the selection? | Both: a new page by default, into the selected container when one is selected — as a proposal, written on accept |
| D4 | How much self-review | The agent's own loop; the MCP refuses past the plan's ceiling of proposals per sketch (a `plan` column) |
| D5 | Create components from repeated blocks automatically? | Proposed with the proposal, ticked in the review, never silently |
| D6 | How it is metered | Each `plitzi_propose` is one `sketch_proposal` — the renders are what it costs Plitzi; the model is the agent's |
| D7 | Where the sketch is kept | In the space, its picture in the private bucket; the accepted batch's history entry names it |

## 5. Phases

1. **Picture → page**: a picture as the sketch; `plitzi://sketches`, `plitzi_propose`; the review; accept and discard;
   metering and the plan's ceiling.
2. **The sketch pad**; structured reading; iterating by drawing on a screenshot; component proposals.
3. **Pizarra → Plitzi**: a frame sent to a space.

## 6. Settled from the open questions

- **The pad** is the builder's own, after Pizarra's (§3.1).
- **A sketched form** keeps its fields and its button; its submit is left unbound and the proposal says so — wiring it
  to a server action is the person's next request, not a guess.
- **Responsive intent**: a sketch is one width. The page is built for it and adapted to mobile by the agent; the
  review shows both screenshots, so a wrong guess is seen before it is accepted.
