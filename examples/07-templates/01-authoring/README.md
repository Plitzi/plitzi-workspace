# A template, and one dependency

A **template** is what you publish when you are not building a space: one subtree, the style that dresses it and a
name, hosted as a JSON. Somebody adds it to their space's resources, it appears in the builder's Resources panel,
and dragging it onto the canvas instantiates a copy.

This is the whole project. No server, no account, no React — `package.json` has exactly one dependency:

```json
"dependencies": { "@plitzi/sdk-authoring": "workspace:*" }
```

```bash
yarn start
# [example] wrote dist/pricing-card.json
# [example] 11 elements, base "0557a1b084b478dfc215706e"
```

Then host `dist/pricing-card.json` anywhere, and upload it to a space as an `application/json` resource.

## What matters

**The root is the base element.** [`src/template.ts`](./src/template.ts) declares one `root` and its children;
that root becomes the template's `baseElementId` — the element a builder instantiates — so no id is written by
hand, here or anywhere.

**What it names, it carries.** The four `styles()` declarations end up in the manifest's own style, which is the
difference between a template and a screenshot of one: a class declared in the space it was cut from does not
travel, and the element that keeps the class renders unstyled wherever it lands. `authorTemplate` warns about a
name the manifest does not carry.

**A binding may not point outside the subtree.** A source names an element by idRef, so binding to a provider that
stayed behind resolves to nothing in every space the template is dropped into — refused at author time. Bring the
`apiContainer` into the template, or bind to one of the globals (`variables`, `navigation`, `auth`, `state`).

**It is deterministic.** Ids are hashes of the path that produced them, so re-running this writes a byte-identical
file — a template in git has a readable diff.

## Also here

`validateTemplate(manifest)` runs the same gate over a JSON you did not author here — one exported from the
builder, or edited by hand — before you publish it.
