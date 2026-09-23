# Templates

Plitzi's templates are Twig, run by Plitzi's own interpreter. What a `{{ … }}` does depends on WHERE it is written.

## Where a template runs

| Written in | What is evaluated | Use it for |
| --- | --- | --- |
| a binding's `twigTemplate` transformer | the whole template: conditions, filters, `{% set %}`, loops, tests | anything computed — this is where logic goes |
| a flow step's params | the whole template | values a step sends or stores |
| an ATTRIBUTE (`href`, `src`, `content`…) | only `{{ name }}` and `{{ name|filter }}` tokens | dropping a value into a string |

An attribute holding only a condition — `href: "/x/{{ on ? 'a' : 'b' }}"` — is used **as written** (`authorSpace` warns
`template-never-resolved`). Move the expression into a binding:

```ts
link({ href: '/', bind: [{ to: 'href', source: 'state.workspace.id',
  transformers: [{ action: 'twigTemplate', params: { template: "{{ source ? '/workspace/' ~ source : '/' }}" } }] }] })
```

In a binding, `source` is the value at the binding's `source`; everything else in scope is a source named in full.

## Naming sources inside a template

Always the full name — the element's kind, an underscore, its id: `apiContainer_stats`, `list_rows`,
`modalContainer_credits`. The globals (`state`, `auth`, `navigation`, `variables`, `theme`) are named as themselves. In
a flow, an earlier step is read by the name given with `named('quote', …)`: `{{ quote.output.total }}`.

A list publishes one scope per row: inside a row, `list_rows.item` is THAT row.

## The language

- Operators: `~` (concat), `+ - * / %`, `== != < > <= >=`, `and or not`, `in`, `a ? b : c`, `a ?? b`.
- Access: `a.b`, `a.0`, `a[i]`, `(expr).key`, `(expr)[i]`.
- Blocks: `{% set x = … %}`, `{% if %}…{% elseif %}…{% else %}…{% endif %}`, `{% for item in list %}…{% endfor %}`.
- Arrow functions in filters: `rows|sort(r => r.at)|first`, `rows|filter(r => r.active)`, `rows|map(r => r.name)`.
- Tests: `is defined`, `is empty`, `is null`, `is iterable`, `is even`, `is odd`, and their `is not` forms.
- Functions: `range`, `min`, `max`, `cycle`.

Filters: `default upper lower trim capitalize title camelize kebab snake ltrim rtrim pad replace slice split join
reverse length first last contains startswith endswith number number_format round abs format sort batch chunk map
reduce merge keys values filter column find pluck unique flatten sum without only index_by group_by url_encode
striptags spaceless json_encode to_json raw date year month day hours minutes seconds weekday random`.

A lookup across two sources — a row joined to the stats around it:

```ts
"{% set s = apiContainer_stats.data.spaces|find('id', list_spaces.item.id) %}{{ s ? s.traffic.views|number_format(0, '.', ',') ~ ' views' : '—' }}"
// or, in one expression:
"{{ (apiContainer_stats.data.spaces|find('id', list_spaces.item.id)).traffic.views ?? 0 }}"
```

## Values to be careful with

- **An empty list is false**, like an absent one. To tell "arrived and empty" from "not arrived":
  `{{ items is defined and items is empty }}`.
- **`json_encode` of a string is the string**, unquoted. Do not build JSON by interpolating text a visitor typed —
  pass objects as step params instead.
- **Numbers**: `number_format(decimals, point, thousands)`; `round(precision)`.
- **A template that renders a number hands on a number** in step params (`'1'` → `1`).

## Dates

- `|date(format, zone)` — tokens `Y m n d j H G i s l F M N w U`. **Always pass a zone** (`'UTC'`) and print it: with
  no zone the date is formatted in the local time of whoever renders it — the server's for the HTML, the visitor's
  after hydration — and the two disagree.
- A timestamp can be seconds or milliseconds, a number or a string of digits — all read.
- For "3 minutes ago", the `dateConverter` transformer with `{ asAge: true }`; give it `isUnix: false` for an ISO
  string. Its checkbox params accept real booleans (and `'true'`/`'false'`).
