# RFC 0023 — Improvements from the MultiPC clone experiment

- **Status:** Accepted — every phase shipped; M12/C3 declined for now (§4), C7 not taken as written (§5)
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-02
- **Scope:** `sdk-authoring`, `sdk-elements`, `sdk-interactions`, `apps/sdk` (router), `apps/server`, `apps/cli` and its
  scaffold, the `plitzi-authoring` / `plitzi-cli` skills, `docs/en`

---

## 1. Where this comes from

An agent cloned multipcve.com (home, a filterable catalogue of 879 products, a product page) from an empty folder
with `npx @plitzi/cli create --mode server --source local`, no account and no MCP, and wrote up what got in the way:
53 proposals in four series — M1–M22 (runtime, CLI, server), D1–D10 (skills and docs), A1–A11 (shorter authoring) and
C1–C10 (less context spent by the agent). About 40 % of the effort went into friction the product can remove.

The report was written against the published packages. Every proposal below was checked against `main` before
being accepted: what already exists is said, and a claim that did not hold is corrected.

## 2. Verdicts

**Do** — accepted as proposed (or with the change noted). **Partly** — some of it exists; the rest is done.
**Later** — accepted, after the phases below. **Not now** — declined for the time being (§4).

| ID | Proposal | Verdict | Phase | Notes from checking `main` |
| --- | --- | --- | --- | --- |
| M12 | `plitzi import <url>` | Not now | — | Decided (§4) |
| C3 | Compact `plitzi import` | Not now | — | With M12 |

## 3. Phases

1. **Remove the measured friction (P0):** shipped — M1–M7 (M6's `loading` slot moved to phase 3).
2. **Skills, docs and small fixes:** shipped — D1, D2, D4, D6, D7, D9, D10, M14, M15, M19, M22, C4, C6, C10.
3. **Faster next clone:** shipped — M6's `loading` slot (`loadingSlot`), M9, M11, M13, M16, M17, D3, D5, C1, C2, C5, C9; C7 not taken as written (§5).
4. **Shorter authoring:** shipped — A1–A11, M10 (`tw()`), D8 (`create --template catalog`), C8.
5. **Larger additions:** shipped — M8 (`carousel`), M18 (`embed`, `svg`), M20 (`window.__plitzi`), M21 (`images`).

Each item ships with its tests, its docs and its changeset line, and its row is removed from §2 when it does.

## 4. Decisions (2026-10-02)

- **M8 carousel — yes.** A structure element with slots (`slide`, `previous`, `next`, `indicator`), three modes and
  autoplay, built after `onInterval`, the scroll callbacks and `itemKey`, which it uses.
- **M12 / C3 `plitzi import` — not now.** It reads and parses somebody else's site; it stays out of the product.
- **M21 image proxy — yes, with an allowlist.** Only domains declared in `createServer({ images: { domains } })`,
  with the same guards as the server's other outbound requests, and a disk cache.
- **A2 / A3 / A5 — yes.** Breakpoints per property, camelCase CSS keys and typed data sources are accepted beside the
  forms they shorten; the documents they produce are the same.

## 5. Not taken as written

- **M7 "the next free port":** a server that silently moves breaks `PUBLIC_URL` and every link built from it. The
  port is moved only while developing and only when `PORT` was not set; it is printed and written to
  `.plitzi/dev-server.json`, which the scripts read. Identity reuses `/health` (named after the space) rather than a
  second endpoint and an `X-Plitzi-Space` header.
- **M20** is not a second dev tools: the panel already shows state, sources and flow runs. What is missing is the
  same data in text, for an agent — `plitzi check` (C1) covers most of it.
- **C7 `author --fix`** rewriting the author's TypeScript: of what `fixSpace` settles, `unknown-attribute` and
  `attribute-kind` are compile errors in a typed project already, and `page-target-url` goes with A7 (`mode` inferred);
  the report's other cases — a class with `css` of its own, a tablet rule — need a decision (an `id` to name the
  modifier, whether phones get the rule), not a rewrite. A source rewriter for what is left would be machinery for
  nearly nothing. `fixSpace` keeps settling documents (the builder, the MCP), and every problem `author` prints comes
  with its code and what to write instead (D6).
