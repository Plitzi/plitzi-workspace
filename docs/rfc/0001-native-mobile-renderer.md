# RFC 0001 — Native mobile renderer (React Native)

- **Status:** Proposal (not implemented)
- **Author:** Carlos Rodriguez
- **Date:** 2026-06-21
- **Scope:** `@plitzi/plitzi-sdk` and its render packages (`sdk-elements`, `sdk-style`)

---

## 1. Summary

Evaluate and plan a PoC to render Plitzi-generated UI in **native mobile apps**
via React Native (RN), reusing the SDK's data engine and replacing only the
**presentation layer**.

The current SDK is React-based but **web/DOM only**: it cannot run on RN as-is.
This RFC documents the "true native" path (Option 3 from the prior analysis), why
it is viable, and how to approach it when prioritized.

> Cheaper alternatives ruled out for this RFC (but valid short-term):
> **Capacitor/WebView** (package the web build with no changes) and **PWA**.
> This RFC focuses on the native renderer because it is the only one delivering
> real native look-and-feel and performance.

---

## 2. Motivation

- Build native mobile apps from the same schemas/pages the Plitzi builder already
  produces.
- Reuse existing logic (store, schema, variables, interactions) without
  duplicating the engine.
- Avoid the cost of maintaining two distinct data models.

---

## 3. Why the current SDK cannot run on RN

React is only the reconciler (platform-agnostic); everything built on top is web.
Evidence in the code:

| Web dependency | Location | Problem on RN |
|---|---|---|
| HTML JSX tags (`<div>`, `<span>`, `className`) | ~221 uses in `sdk-elements/src` | RN only understands `<View>`, `<Text>`, `<Image>` |
| Styling system = CSS | all of `sdk-style` | RN uses `StyleSheet` objects (flexbox subset), no cascade, no `className` |
| `react-dom` (peerDependency) | `apps/sdk/package.json` | RN uses the `react-native` renderer |
| Raw HTML (`BlockHtml`, `NodeHtml`, `BlockJsx`, Twig, `innerHTML`) | `sdk-elements/src/elements/advanced/*` | RN cannot render HTML strings |
| `@plitzi/plitzi-ui` | component library | built with DOM/CSS |
| `react-router-dom`, `react-helmet`, `document.*`, `window.*` | router, SSR shell, Dropdown | browser APIs absent in RN |

---

## 4. Why the architecture DOES enable the PoC

Three SDK properties make this viable with bounded effort:

### 4.1 Single HTML translation point: `RootElement`

`sdk-elements/src/Element/RootElement.tsx` is the **only** place emitting the
HTML `<Tag>`. Visual elements delegate to it. Example (`Container`):

```tsx
const Container = (...) => (
  <RootElement tag={subType} className={...}>{children}</RootElement>
);
```

> Implication: rewriting `RootElement` → `RootElementNative` (mapping
> `tag`→`<View>`/`<Text>` and style→`StyleSheet`) swaps the render of nearly
> every element in one move.

### 4.2 Data-driven tree, not hardcoded JSX

Elements resolve by `type` from a registry (`Element/helpers/loadComponent.ts` +
`register`). The page is a JSON schema. Native implementations can be registered
for the same `type` values and the engine consumes them unchanged.

### 4.3 `parseStyle` already produces a camelCase object

`Element/helpers/parseStyle.ts` converts a CSS string → `{ camelKey: value }`.
RN's `StyleSheet` also uses camelCase objects: **the shape matches**. What does
not match is the content (units, shorthands, pseudo-selectors, media queries) —
but for basic flexbox the mapping is direct.

### 4.4 Portable, non-visual logic

Pure JS, portable to RN unchanged: `@plitzi/nexus` (store), `sdk-schema`,
`sdk-variables`, `sdk-interactions`, and the `withElement` HOC logic.

---

## 5. PoC scope

**Goal:** take a real JSON schema for a simple Plitzi page (containers, text,
image, a button with one interaction) and render it in an **Expo** app running on
iOS/Android, reusing the SDK's data engine.

| Reuse as-is | Rewrite for RN | Exclude from PoC |
|---|---|---|
| nexus, sdk-schema, sdk-variables, sdk-interactions, registry / `withElement` | `RootElement`→`RootElementNative`, `parseStyle`→RN subset, 4–5 basic elements | BlockHtml / NodeHtml / Twig, plitzi-ui, FontAwesome web, advanced CSS (grid, pseudo, media queries) |

Minimal PoC elements:

| Plitzi type | RN component |
|---|---|
| Container / Structure | `<View>` |
| Text / Paragraph / Heading | `<Text>` |
| Image | `<Image>` |
| Button | `<Pressable>` + `<Text>` |

---

## 6. Open decisions (to resolve at kickoff)

> Left undefined; documented to resume later.

1. **Environment:** new Expo (recommended) vs bare RN vs only `RootElementNative`
   with a no-device test.
2. **Style coverage:** basic flexbox vs +typography/borders vs maximum possible.
   (This is where time goes if full parity is attempted.)

---

## 7. Implementation plan (when prioritized)

1. **Setup**: new Expo app consuming the portable workspace packages via
   portal/resolutions, without touching the web SDK.
2. **`RootElementNative`**: equivalent of `RootElement` mapping `tag`→RN
   primitive and delegating style to a `parseStyleNative`.
3. **`parseStyleNative`**: CSS→`StyleSheet` subset (coverage per decision §6.2).
4. **Native registry**: register the 4–5 basic elements for the same `type`
   values the builder uses.
5. **Demo screen**: load a real JSON schema and render it.
6. **Interaction**: wire one simple interaction (e.g. tap→navigation or nexus
   state change) to prove the non-visual engine works on RN.

---

## 8. Estimate and risk

- **Effort:** ~1–2 weeks for a convincing PoC.
- **Low risk** in the engine (store/registry/interactions already work).
- **Risk/cost concentrated** in the style engine: time scales with the style
  parity targeted.

### What it would / would not prove

- ✅ That the SDK's data model + registry + interactions are portable and that
  true native rendering is achievable.
- ❌ Full style parity nor raw-HTML elements (`BlockHtml`, `NodeHtml`, Twig) —
  those will never have a clean native equivalent.

---

## 9. Next step

When prioritized: resolve the §6 decisions and execute the §7 plan, starting with
`RootElementNative` + `parseStyleNative` against a demo schema.
