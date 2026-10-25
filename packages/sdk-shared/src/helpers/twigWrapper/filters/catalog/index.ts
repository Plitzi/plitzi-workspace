/**
 * What each template filter is, for whoever writes one — `plitzi explain <filter>` and `--list filters` read it, so a
 * filter is asked for by name, never looked for in the source. One entry per filter of `filters`: `catalog.test.ts`
 * holds the two to each other. An entry of its own — words for an author, which a server running templates never reads.
 */

export interface FilterDoc {
  /** How it is written: `currency(code, locale?, { trimZeros? })`. */
  signature: string;
  summary: string;
  example: string;
}

export const FILTER_DOCS: Record<string, FilterDoc> = {
  raw: {
    signature: 'raw',
    summary: 'The value as it is, never serialised — what an attribute needing an object reads',
    example: '{{ items|raw }}'
  },
  to_json: {
    signature: 'to_json',
    summary: 'The value as JSON: a string quoted, nothing as null',
    example: '{{ settings|to_json }}'
  },
  json_encode: {
    signature: 'json_encode',
    summary: 'The same as to_json, by Twig’s name',
    example: '{{ settings|json_encode }}'
  },
  object_as_json: {
    signature: 'object_as_json',
    summary: 'An object as JSON text; anything else as it is',
    example: '{{ row|object_as_json }}'
  },
  default: {
    signature: 'default(fallback)',
    summary: 'The fallback when the value is undefined, null or an empty string',
    example: '{{ user.name|default("Guest") }}'
  },
  upper: { signature: 'upper', summary: 'A string in capitals', example: '{{ "hi"|upper }} → HI' },
  lower: { signature: 'lower', summary: 'A string in lower case', example: '{{ "Hi"|lower }} → hi' },
  trim: { signature: 'trim', summary: 'A string without the spaces around it', example: '{{ " hi "|trim }} → hi' },
  capitalize: {
    signature: 'capitalize',
    summary: 'The first letter in capitals, the rest in lower case',
    example: '{{ "hELLO"|capitalize }} → Hello'
  },
  title: {
    signature: 'title',
    summary: 'Every word’s first letter in capitals',
    example: '{{ "dog food"|title }} → Dog Food'
  },
  camelize: {
    signature: 'camelize',
    summary: 'foo_bar and foo-bar as fooBar',
    example: '{{ "pet_name"|camelize }} → petName'
  },
  kebab: { signature: 'kebab', summary: 'fooBar as foo-bar', example: '{{ "petName"|kebab }} → pet-name' },
  snake: { signature: 'snake', summary: 'fooBar as foo_bar', example: '{{ "petName"|snake }} → pet_name' },
  ltrim: { signature: 'ltrim', summary: 'A string without the spaces before it', example: '{{ "  hi"|ltrim }}' },
  rtrim: { signature: 'rtrim', summary: 'A string without the spaces after it', example: '{{ "hi  "|rtrim }}' },
  pad: {
    signature: 'pad(length, char?)',
    summary: 'A string padded on the left to a length, with spaces or char',
    example: '{{ "7"|pad(3, "0") }} → 007'
  },
  padRight: {
    signature: 'padRight(length, char?)',
    summary: 'A string padded on the right to a length',
    example: '{{ "id"|padRight(4, ".") }} → id..'
  },
  number: {
    signature: 'number(decimals?)',
    summary: 'The first number in a string; a number with that many decimals, as text',
    example: '{{ "€12.50"|number }} → 12.5'
  },
  replace: {
    signature: 'replace(search, replacement) | replace({ search: replacement, … })',
    summary: 'Every occurrence of search replaced — or of each key of a map by its value, in one pass',
    example: '{{ phone|replace({" ": "", "-": ""}) }}'
  },
  slice: {
    signature: 'slice(start, length?)',
    summary: 'Part of a string or a list, from start, length long',
    example: '{{ items|slice(0, 5) }}'
  },
  split: {
    signature: 'split(separator)',
    summary: 'A string as a list, cut at the separator',
    example: '{{ "a,b"|split(",") }}'
  },
  join: { signature: 'join(separator?)', summary: 'A list as one string', example: '{{ tags|join(", ") }}' },
  reverse: {
    signature: 'reverse',
    summary: 'A list, or a string, the other way round',
    example: '{{ items|sort(e => e.date)|reverse }}'
  },
  length: {
    signature: 'length',
    summary: 'How many: characters, items, or an object’s keys',
    example: '{{ pets|length }}'
  },
  first: {
    signature: 'first',
    summary: 'A list’s first item, or a string’s first character',
    example: '{{ items|first }}'
  },
  last: { signature: 'last', summary: 'A list’s last item, or a string’s last character', example: '{{ items|last }}' },
  contains: {
    signature: 'contains(needle)',
    summary: 'Whether a string holds the text, or a list the item',
    example: '{{ tags|contains("vet") }}'
  },
  startswith: {
    signature: 'startswith(prefix)',
    summary: 'Whether a string starts with the prefix',
    example: '{{ path|startswith("/pets") }}'
  },
  endswith: {
    signature: 'endswith(suffix)',
    summary: 'Whether a string ends with the suffix',
    example: '{{ file|endswith(".png") }}'
  },
  number_format: {
    signature: 'number_format(decimals?, point?, thousands?)',
    summary: 'A number with decimals and separators',
    example: '{{ 1234.5|number_format(2, ",", ".") }} → 1.234,50'
  },
  currency: {
    signature: 'currency(code, locale?, { trimZeros? })',
    summary: 'An amount as the locale writes it in that currency; en unless named, so server and browser agree',
    example: '{{ total|currency("EUR", "en") }} → €1,141.63'
  },
  percent: {
    signature: 'percent(decimals?, locale?)',
    summary: 'A share as a percentage',
    example: '{{ 0.256|percent(1) }} → 25.6%'
  },
  sort: {
    signature: 'sort(key? | compare?)',
    summary: 'A list in order: by itself, by what the arrow takes of each item, or by a two-argument comparator',
    example: '{{ expenses|sort(e => e.date) }}'
  },
  batch: { signature: 'batch(size)', summary: 'A list in groups of size', example: '{{ items|batch(3) }}' },
  map: {
    signature: 'map(item => …)',
    summary: 'Each item turned into what the arrow makes of it',
    example: '{{ pets|map(p => p.name) }}'
  },
  reduce: {
    signature: 'reduce((total, item) => …, initial)',
    summary: 'A list folded into one value',
    example: '{{ expenses|reduce((sum, e) => sum + e.amount, 0) }}'
  },
  merge: {
    signature: 'merge(other)',
    summary: 'Two lists one after the other, or two objects in one',
    example: '{{ a|merge(b) }}'
  },
  keys: { signature: 'keys', summary: 'An object’s keys, as a list', example: '{{ totals|keys }}' },
  values: { signature: 'values', summary: 'An object’s values, as a list', example: '{{ totals|values }}' },
  filter: {
    signature: 'filter("key" | item => …)',
    summary: 'The items whose key is truthy, or the arrow keeps',
    example: '{{ expenses|filter(e => e.category == "vet") }}'
  },
  column: {
    signature: 'column(key)',
    summary: 'Each object’s value at key, as a list',
    example: '{{ pets|column("name") }}'
  },
  url_encode: {
    signature: 'url_encode',
    summary: 'A string percent-encoded, an object as a query string',
    example: '{{ query|url_encode }}'
  },
  nl2br: { signature: 'nl2br', summary: 'A <br> before every line break', example: '{{ note|nl2br }}' },
  striptags: {
    signature: 'striptags(allowed?)',
    summary: 'A string without HTML tags, but those allowed',
    example: '{{ html|striptags }}'
  },
  abs: { signature: 'abs', summary: 'A number without its sign', example: '{{ -3|abs }} → 3' },
  round: {
    signature: 'round(precision?, "common" | "ceil" | "floor")',
    summary: 'A number rounded to precision decimals',
    example: '{{ 2.456|round(1) }} → 2.5'
  },
  format: {
    signature: 'format(values…)',
    summary: 'sprintf: %s, %d, %f and %%, with PHP’s flags, width and precision',
    example: '{{ "%02d"|format(5) }} → 05'
  },
  spaceless: {
    signature: 'spaceless',
    summary: 'HTML without the white space between its tags',
    example: '{{ html|spaceless }}'
  },
  random: {
    signature: 'random',
    summary: 'One item of a list, or one character of a string, at random',
    example: '{{ tips|random }}'
  },
  date: {
    signature: 'date(format, timeZone?)',
    summary:
      'A date as format writes it — Y m d j n H G h g A a i s w N U l D F M; an epoch in seconds or milliseconds; with no zone named, the visitor’s local time once the page hydrates (the server’s before); "now" is the render’s moment; a bare YYYY-MM-DD is read in "UTC"',
    example: '{{ expense.date|date("j M Y", "UTC") }} · {{ message.at|date("H:i") }} · {{ "now"|date("F Y") }}'
  },
  ago: {
    signature: 'ago(locale?)',
    summary:
      'Relative time: how long ago a moment was, or how far ahead, in words — "4 minutes ago", "in 3 hours", "now" — at the render’s moment, on the server and again in the browser',
    example: '{{ played.endedAt|ago }} · {{ post.at|ago("es") }}'
  },
  duration: {
    signature: 'duration',
    summary: 'A length in seconds as a clock writes it — 238 is "3:58", 3723 is "1:02:03"',
    example: '{{ track.duration|duration }}'
  },
  base64_encode: {
    signature: 'base64_encode',
    summary: 'A string in base64, UTF-8 safe',
    example: '{{ text|base64_encode }}'
  },
  base64_decode: {
    signature: 'base64_decode',
    summary: 'A base64 string decoded, UTF-8 safe',
    example: '{{ encoded|base64_decode }}'
  },
  md5: { signature: 'md5', summary: 'A string’s MD5, in lower-case hex', example: '{{ email|md5 }}' },
  without: {
    signature: 'without(key…)',
    summary: 'An object without those keys',
    example: '{{ user|without("password") }}'
  },
  only: {
    signature: 'only(key…)',
    summary: 'An object with only those keys',
    example: '{{ user|only("id", "name") }}'
  },
  find: {
    signature: 'find(item => … | "key", value)',
    summary: 'The first item the arrow keeps, or whose key is value',
    example: '{{ pets|find("id", expense.petId) }}'
  },
  pluck: {
    signature: 'pluck(key)',
    summary: 'Each object’s value at key, as a list',
    example: '{{ expenses|pluck("amount") }}'
  },
  unique: {
    signature: 'unique',
    summary: 'A list without repeats',
    example: '{{ expenses|pluck("category")|unique }}'
  },
  flatten: {
    signature: 'flatten',
    summary: 'A list of lists as one list, one level down',
    example: '{{ groups|flatten }}'
  },
  sum: {
    signature: 'sum',
    summary: 'The numbers of a list added up — of a list of objects, pluck the field first',
    example: '{{ expenses|pluck("amount")|sum }}'
  },
  chunk: { signature: 'chunk(size)', summary: 'A list in pieces of size', example: '{{ items|chunk(2) }}' },
  index_by: {
    signature: 'index_by(key)',
    summary: 'A list of objects as an object, keyed by key',
    example: '{{ pets|index_by("id") }}'
  },
  group_by: {
    signature: 'group_by(key)',
    summary: 'A list of objects grouped by their value at key',
    example: '{{ expenses|group_by("category") }}'
  }
};

/**
 * What each template function is — `{{ max(a, b) }}`, called by name rather than piped — for `plitzi explain` and the
 * check that refuses any other: the one list of them, which the evaluator implements and `catalog.test.ts` holds it to.
 */
export const FUNCTION_DOCS: Record<string, FilterDoc> = {
  cycle: {
    signature: 'cycle(values, index)',
    summary: 'The value at index, going round the list: alternating classes, colours of a row',
    example: "{{ cycle(['odd', 'even'], loop.index0) }}"
  },
  max: {
    signature: 'max(a, b, …) | max(list)',
    summary: 'The largest of the numbers given, or of a list',
    example: '{{ max(carousel_row.count - 3, 0) }}'
  },
  min: {
    signature: 'min(a, b, …) | min(list)',
    summary: 'The smallest of the numbers given, or of a list',
    example: '{{ min(state.page + 1, state.pages) }}'
  },
  range: {
    signature: 'range(end) | range(start, end, step?)',
    summary: 'The whole numbers from 0 (or start) to end, both included',
    example: '{% for n in range(1, 5) %}{{ n }}{% endfor %}'
  }
};
