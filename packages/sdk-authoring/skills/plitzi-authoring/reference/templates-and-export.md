# Templates, exports, and what authoring refuses

## Publishing a template

A template is ONE subtree, the style that dresses it and a name, published as a JSON someone drags onto a canvas you
will never see.

```ts
import { authorTemplate } from '@plitzi/sdk-authoring';

const { template, warnings } = authorTemplate({
  name: 'Pricing card',
  description: 'A price, a list of features and a call to action.',
  classes: { card: { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--surface)' } },
  root: container({ class: 'card', children: [heading('$19', { subType: 'h3' }), button({ content: 'Start' })] })
});
```

- **Everything it names, it carries.** A class declared in the space it was cut from does not travel: declare every
  rule the subtree names (`validateTemplate` warns about one it does not carry).
- **A binding may not point outside the subtree.** Bring the provider into the template, or bind to a global.

## From an exported JSON

Never rewrite an exported space by hand. `specFromSpace({ schema, style })` reads it into the spec that authors it
(listing each repair in `corrections`); `specToSource(spec, { exportName })` writes that spec as code;
`compareSpaces(original, authorSpace(spec))` must list nothing but what `corrections` explains. The builder's
**Export** does all three. Edit the code from then on — and tidy it as you go ([structure.md](structure.md)).

For a document you did not author — an export, a JSON edited by hand — run the gate before serving it:
`validateSpace({ schema, style })`.

## What authoring refuses

`authorSpace` throws rather than hand back a space that would not render. Each error names the element and the fix:

- a CSS property the editor cannot read back; a class or slot the space does not declare (with the likely name)
- an element with a shared `class` AND rules of its own; one class declared twice with rules that disagree
- a binding source nothing answers to, or with the wrong prefix
- a source written by its short name inside a flow's params or a binding's template (`stats.x` for `apiContainer_stats.x`)
- a name that shadows a global (`variables`, `navigation`, `auth`, `state`, `theme`)
- two elements with one id — the error says where the first one is
- a step target that is not there; a broken flow chain, an orphan, a cycle
- a flow on a trigger its element never fires (`onSubmit` on a button), an element callback sent to a type that
  does not answer it (`openModal` to a container)
- a `dropdownPopup` outside a `dropdown`, a tab container's parts outside a `tabContainer`
- a global callback on the wrong module, a utility given one

And it WARNS — returned in `warnings`, printed by `npm run author` — for what is written and will not do what it
says: `unknown-attribute`, `template-never-resolved`, `condition-starts-visible`, `state-key-has-runtime-prefix`,
`FORM_SUBMIT_UNMANAGED`, `STYLE_WITHOUT_TAG`, `tablet-rule-skips-mobile`. Treat a warning as a bug.

Ids are hashes of the path that produced them: re-authoring an unchanged space writes byte-identical documents, so a
seed can re-run and a diff stays readable.
