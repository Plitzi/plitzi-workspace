# Templates

Plitzi's templates are Twig, run by Plitzi's own interpreter. What a `{{ … }}` does depends on WHERE it is written.

## Where a template runs

| Written in | What is evaluated | What it can read |
| --- | --- | --- |
| a binding's `twigTemplate` transformer | the whole template: conditions, filters, `{% set %}`, loops, tests | `source` (the bound value), `sourceTo`, the globals, the variables by bare name, and every source around the element |
| a flow step's params | the whole template | the trigger's payload and earlier steps by name, the globals, sources around the element |
| an ATTRIBUTE (`href`, `src`, `content`…) | only `{{ name }}` and `{{ name|filter }}` tokens | the globals, the variables and the page's route params by bare name (`{{ apiUrl }}`, `{{ slug }}`), and every source around the element (`{{ list_games.item.slug }}`) |

A **query parameter** is `navigation.queryParams.<name>` everywhere — never a bare name.

An attribute holding a condition — `href: "/x/{{ on ? 'a' : 'b' }}"` — is used **as written** (`authorSpace` warns
`template-never-resolved`). Move the expression into a binding with `bindTemplate`:

```ts
link({ href: '/', mode: 'internal', bind: [bindTemplate('href', 'state.workspace.id', "{{ source ? '/workspace/' ~ source : '/' }}")] })
```

A value that came from a BINDING is data, never a template: a comment reading `{{ auth.accessToken }}` prints those
characters. Only what you authored is interpolated.

### A template's value, not its text

A binding's template renders TEXT by default. For an attribute that holds a list, a number or a flag — a list's
`items` above all — hand over the VALUE with `returns: 'value'` (`returnMode: 'value'` on the transformer). The
template must be a single `{{ expression }}`:

```ts
list({ id: 'shown', source: 'controlled',
  bind: [bindTemplate('items', 'games.data.games', '{{ source|filter(g => state.genre == "" or g.genre == state.genre) }}', { returns: 'value' })],
  children: [ … ] })
```

A text template feeding `items` is refused: the list would receive the array written out as JSON and render nothing.

## Naming sources inside a template

Always the full name — the element's kind, an underscore, its id: `apiContainer_stats`, `list_rows`,
`modalContainer_credits`. The globals (`state`, `auth`, `navigation`, `variables`, `host`, `theme`, `computed`) are named
as themselves. In a flow, an earlier step is read by the name given with `named('quote', …)`: `{{ quote.output.total }}`.

An id with a hyphen is one name inside a template — `{{ apiContainer_tn-data.data.total }}` reads that provider. So
subtraction is written with spaces: `{{ total - used }}`, never `total-used`.

A source reaches only the elements **inside** the element that publishes it (a layout's providers reach every page in
it). A list publishes one scope per row: inside a row, `list_rows.item` is THAT row and `list_rows.index` its position;
a nested list's rows still see the outer row.

`authorSpace` refuses a name nothing answers to, a short name where the full one is needed, and a source read from
outside the element that publishes it — each with the name it should have been.

## The language

- Operators: `~` (concat), `+ - * / // % **`, `== != < > <= >=`, `and or not`, `in`, `starts with`, `ends with`,
  `a ? b : c`, `a ? b` (empty when false), `a ?: b` (a when truthy), `a ?? b` (a when defined).
- Access: `a.b`, `a.0`, `a[i]`, `(expr).key`, `(expr)[i]`, `['x', 'y'][i]`, `{ k: 1 }.k`.
- Blocks: `{% set x = … %}`, `{% if %}…{% elseif %}…{% else %}…{% endif %}`, `{% for item in list %}…{% endfor %}`,
  `{% apply upper %}…{% endapply %}`, `{% break %}`, `{% continue %}`.
- Arrow functions in filters, closing over `{% set %}` variables: `rows|sort(r => r.at)|first`,
  `rows|sort((a, b) => b.score - a.score)`, `rows|filter(r => r.score >= min)`, `rows|map(r => r.name)`.
- Tests: `is defined`, `is empty`, `is null`, `is iterable`, `is even`, `is odd`, `is same as(x)` (strict: `false` is
  not `'false'`, `0` or an unset value), `is divisible by(n)`, and their `is not` forms. `null` and `none` are literals.
- Functions: `range`, `min`, `max`, `cycle`.
- **Not supported**: `matches` (no regular expressions are evaluated — use `starts with`, `ends with`, `in`), macros,
  `include`/`extends`, and any filter or function not listed here. `authorSpace` refuses them, and anything else the
  interpreter would read past, rather than letting a template render a value nobody wrote.

Filters: `default upper lower trim capitalize title camelize kebab snake ltrim rtrim pad padRight replace slice split
join reverse length first last contains startswith endswith number number_format round abs format sort batch chunk map
reduce merge keys values filter column find pluck unique flatten sum without only index_by group_by url_encode nl2br
striptags spaceless json_encode to_json object_as_json raw date base64_encode base64_decode md5 random`.

`format` is sprintf: `'%02d'|format(n)` → `05`, `'%.1f'|format(x)`, `'%-8s'|format(name)`, `'%+d'|format(delta)`. A bare
`%f` keeps the number's own digits.

A lookup across two sources — a row joined to the stats around it:

```ts
"{% set s = apiContainer_stats.data.spaces|find('id', list_spaces.item.id) %}{{ s ? s.traffic.views|number_format(0, '.', ',') ~ ' views' : '—' }}"
// or, in one expression:
"{{ (apiContainer_stats.data.spaces|find('id', list_spaces.item.id)).traffic.views ?? 0 }}"
```

## Values to be careful with

- **An empty list is false**, like an absent one. To tell "arrived and empty" from "not arrived":
  `{{ items is defined and items is empty }}`.
- **`json_encode` prints JSON for any value** — a string quoted and escaped, nothing as `null` — so a JSON document
  is built by encoding each value, never by putting `"{{ text }}"` in quotes yourself:
  `'{ "board": {{ id|json_encode }}, "timer": {{ timer|json_encode }} }'`.
- **Numbers**: `number_format(decimals, point, thousands)`; `round(precision)`.
- **A template that renders a number hands on a number** in step params (`'1'` → `1`).

## Dates

- `|date(format, zone)` — tokens `Y y m n d j H G h g A a i s l D F M N w U`; a backslash prints the next character
  as it is (`\T`). **Always pass a zone** (`'UTC'`) and print it: with no zone the date is formatted in the local time
  of whoever renders it — the server's for the HTML, the visitor's after hydration — and the two disagree.
- A timestamp can be seconds or milliseconds, a number or a string of digits — all read.
- For "3 minutes ago", the `dateConverter` transformer with `{ asAge: true }`; give it `isUnix: false` for an ISO
  string. Its checkbox params accept real booleans (and `'true'`/`'false'`).
