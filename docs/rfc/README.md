# RFCs

Design proposals for the Plitzi workspace. **RFCs are always written in English**,
regardless of the language used elsewhere in the docs.

Each RFC is a numbered, self-contained document, and every one that lives here is
**work that has not happened yet**.

## An RFC is deleted once it ships

A shipped RFC is a plan that reads like a plan and describes a thing that already
exists. That is the worst state for a document to be in: whoever reads it next —
a person or an agent — cannot tell what is still to do from what was done two
months ago, and the phases, the open questions and the "we will" sentences all
argue for work that is already in `main`.

So when an RFC is implemented, it is removed, and what it knew moves to where it
stays true:

- **How to use the thing** → a guide in [`docs/en`](../en) (and `docs/es` where it
  is translated).
- **Why a rule is the way it is** → a comment next to the code that enforces it.
- **What was deliberately left open** → a section of the guide, not a phase table.

The git history keeps the reasoning of every RFC that has been removed; nothing is
lost, it simply stops being read as a plan.

## Index

| # | Title | Status | Scope |
|---|---|---|---|
| [0001](./0001-native-mobile-renderer.md) | Native mobile renderer (React Native) | Proposal | `plitzi-sdk` render packages |
| [0002](./0002-ai-schema-comprehension-and-improvement.md) | AI schema comprehension and improvement | Proposal | `sdk-schema`, `sdk-elements`, MCP/AI toolset |
| [0013](./0013-one-element-key.md) | One element key: `id` becomes the name | Accepted | `sdk-schema`, `sdk-shared`, `sdk-elements`, `sdk-mcp`, builder, `plitzi-sdk-server` |
| [0014](./0014-sdk-authoring-package.md) | `@plitzi/sdk-authoring`, and authoring a template | Accepted | new `sdk-authoring` package, `sdk-schema` authoring, `docs/en` |

## Conventions

- **Filename:** `NNNN-kebab-case-title.md` (zero-padded sequential number).
- **Header:** Status, Author, Date, Scope.
- **Status values:** `Proposal` → `Accepted` → `Implemented` → deleted (or `Rejected`).
- Numbers are never reused: the next RFC takes the next number, whatever has been
  removed since.
- Add new RFCs by incrementing the number and registering them in the table above.
