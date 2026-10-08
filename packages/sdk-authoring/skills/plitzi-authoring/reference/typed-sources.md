# Data typed by a sample

`source('site', home)` names a provider's source from a sample of its answer — the JSON file it reads, imported
(`import home from '../data/home.json' with { type: 'json' }` — `src/data/`, or `public/data/` with no server). Every path is then completed by the editor
and checked: `site.data.hero.titel` is a type error, and refused `source-field-unknown` if it gets past the types.

```ts
const site = source('site', home);
apiContainer({ id: site.id, query: '/data/home.json', children: [
  heading({ from: site.data.hero.title }),
  text({ content: twig`{{ ${site.data.products}|length }} products` }),
  list({ id: 'products', items: site.data.products, row: p => listItem({ children: [text({ from: p.item.title })] }) })
] })
```

- A path is the source's full name (`apiContainer_site.data.hero.title`), so it goes in `from`, `items`, `bind`,
  `visible` and the binding helpers (`bindTemplate`, `visibleWhen`, `hiddenWhen`, `variantFrom`) as it is, and into a
  template through `twig` (a plain template literal writes the same text, but a type-checked lint refuses an object in
  one).
- A list fed by a path hands its `row` the item typed: every field any item of the sample has — `p.item`, `p.index`,
  and `p.inTemplate` as an untyped row has it, so turning a list typed changes none of its templates.
- An item of a list is read by position: `site.data.sections[1]`.
- A provider fed by a server action publishes the action's output at its root: `actionSource('feed', sample)` types
  it — `feed.stories`, and `feed.data` is a type error — with a sample of what the action's last step answers.
