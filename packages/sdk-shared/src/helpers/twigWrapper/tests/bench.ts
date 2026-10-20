export const sequentialSmallIfsCtx: Record<string, unknown> = {};

export const largeContextCtx: Record<string, unknown> = {};

// ── Templates by category ──────────────────────────────────────────────────
export const simpleTokens = '{{ name }} is {{ age }} years old and lives in {{ city }}';

export const simpleTokensCtx = { name: 'Alice', age: 30, city: 'Madrid' };

export const manyTokens = Array.from({ length: 200 }, (_, i) => `{{ item${i} }}`).join(' ');

export const manyTokensCtx: Record<string, unknown> = Object.fromEntries(
  Array.from({ length: 200 }, (_, i) => [`item${i}`, `val${i}`])
);

export const filterChain = '{{ name | upper | trim | capitalize }}';

export const filterChainCtx = { name: '  alice  ' };

export const conditionalSimple = '{% if active %}ON{% else %}OFF{% endif %}';

export const conditionalChained =
  '{% if status == "a" %}alpha{% elseif status == "b" %}beta{% elseif status == "c" %}gamma{% else %}delta{% endif %}';

export const forLoopSimple = '{% for item in items %}{{ item }} {% endfor %}';

export const forLoopSimpleCtx = { items: ['a', 'b', 'c', 'd', 'e'] };

export const forLoopLarge = '{% for i in items %}{{ i }} {% endfor %}';

export const forLoopLargeCtx = { items: Array.from({ length: 100 }, (_, i) => `item${i}`) };

export const nestedForLoop = `
{% for row in rows %}{% for col in cols %}{{ row }}-{{ col }} {% endfor %}{% endfor %}
`.trim();

export const combinedTemplate = `
{% set greeting = "Hello" %}
{% for user in users %}
  {% if user.active %}
    {{ greeting }} {{ user.name | upper }}!
  {% else %}
    {{ greeting }} {{ user.name | lower }} (inactive)
  {% endif %}
{% endfor %}
`.trim();

export const combinedCtx = {
  users: [
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
    { name: 'Carol', active: true },
    { name: 'Dave', active: false }
  ]
};

export const megaTemplate = `
{% set title = "Product List" %}
<h1>{{ title }}</h1>
{% set count = 0 %}
{% for product in products %}
  {% if product.inStock %}
    <div class="product">
      <h2>{{ product.name | upper }}</h2>
      <p>{{ product.description | capitalize }}</p>
      <span class="price">{{ product.price | number_format }}</span>
      {% if product.discount > 0 %}
        <span class="sale">SALE: {{ product.discount }}% off</span>
      {% endif %}
    </div>
    {% set count = count ~ 1 %}
  {% endif %}
{% endfor %}
<p>Total in stock: {{ count }}</p>
`.trim();

export const megaCtx = {
  products: Array.from({ length: 50 }, (_, i) => ({
    name: `Product ${i}`,
    description: `this is product number ${i} with a long description`,
    price: 10 + i * 5,
    inStock: i % 3 !== 0,
    discount: i % 5 === 0 ? 20 : 0
  }))
};

export const noOpTemplate = 'Just plain text with no tokens or tags at all.';

export const setHeavyTemplate = `
{% set a = "hello" %}{% set b = "world" %}{% set c = a ~ " " ~ b %}
{% set x = 1 %}{% set y = 2 %}{% set z = x + y %}
{{ c }}
`.trim();

export const deeplyNestedIf = (() => {
  let tpl = '{% if x1 %}deep{% endif %}';
  for (let i = 2; i <= 20; i++) {
    tpl = `{% if x${i} %}${tpl}{% endif %}`;
  }
  return tpl;
})();

export const deeplyNestedFor = (() => {
  let body = '{{ a }}';
  for (let i = 0; i < 4; i++) {
    body = `{% for x${i} in items %}${body}{% endfor %}`;
  }
  return body;
})();

export const deeplyNestedForCtx = {
  items: [1, 2, 3],
  a: 'ok',
  x0: 1,
  x1: 1,
  x2: 1,
  x3: 1
};

// ── New: deep set blocks ──────────────────────────────────────────────────────
export const deepSetBlocks = (() => {
  let body = '{{ z }}';
  for (let i = 2; i <= 20; i++) {
    body = `{% set z${i} = z${i - 1} ~ "x" %}${body}`;
  }
  return `{% set z1 = "a" %}${body}`;
})();

export const setChainConcat = `
{% set a = "hello" %}{% set b = a ~ " " %}{% set c = b ~ "world" %}{% set d = c ~ "!" %}
{% set e = d ~ " " %}{% set f = e ~ "end" %}{{ f }}
`.trim();

// ── New: apply-tag heavy ──────────────────────────────────────────────────────
export const applyTagSimple = '{{ content | upper }}';

export const applyTagChained = '{{ content | upper | trim | capitalize }}';

export const applyTagWithRaw = '{{ "<b>bold</b>" | striptags }}';

export const multipleApplyBlocks = `
{% apply upper %}first{% endapply %}
{% apply trim %}  second  {% endapply %}
{% apply capitalize %}third{% endapply %}
{% apply upper | trim %}  fourth  {% endapply %}
`.trim();

export const applyInLoop = `
{% for item in items %}
  {% apply upper %}{{ item }}{% endapply %}
{% endfor %}
`.trim();

export const applyInLoopCtx = { items: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] };

// ── New: many conditional branches ────────────────────────────────────────────
export const tenBranchIf = (() => {
  const parts: string[] = [];
  for (let i = 0; i < 10; i++) {
    if (i === 0) {
      parts.push(`{% if v == ${i} %}branch${i}`);
    } else {
      parts.push(`{% elseif v == ${i} %}branch${i}`);
    }
  }
  parts.push('{% else %}other{% endif %}');
  return parts.join('');
})();

export const sequentialSmallIfs = Array.from({ length: 20 }, (_, i) => `{% if a${i} %}X{% endif %}`).join('');

// ── New: for loop with else ───────────────────────────────────────────────────
export const forLoopWithElse = '{% for item in items %}{{ item }} {% else %}empty{% endfor %}';

export const forLoopWithElseCtx = { items: ['a', 'b', 'c'] };

export const forLoopWithElseEmptyCtx = { items: [] as string[] };

// ── New: ternary ──────────────────────────────────────────────────────────────
export const ternarySimple = '{{ active ? "yes" : "no" }}';

export const ternaryNested = '{{ status == "a" ? "alpha" : (status == "b" ? "beta" : "other") }}';

// ── New: large context (resolvePath stress) ───────────────────────────────────
export const largeContextTemplate = '{{ deep.nested.value }}';

export const shallowLookupTemplate = '{{ key42 }}';

// ── New: edge cases ───────────────────────────────────────────────────────────
export const emptyTemplate = '';

export const singleToken = '{{ x }}';

export const whitespaceOnly = '   \n  \t  ';

export const pureHtml = '<div><p>Hello</p><span>World</span></div>';

export const mixedHtmlAndTokens = '<div class="{{ cls }}">{{ greeting }} {{ name }}</div>';

export const mixedHtmlAndTokensCtx = { cls: 'active', greeting: 'Hi', name: 'Alice' };

export const tokenWithDefault = '{{ missing | default("fallback") }}';

export const tokenWithDefaultPresent = '{{ present | default("fallback") }}';

export const tokenWithDefaultPresentCtx = { present: 'actual' };

// ── New: string concatenation heavy ───────────────────────────────────────────
export const concatHeavy = '{{ a ~ b ~ c ~ d ~ e ~ f }}';

export const concatHeavyCtx = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F' };

export const concatWithFilters = '{{ (a ~ b) | upper }}';

export const concatWithFiltersCtx = { a: 'hello', b: 'world' };

// ── New: mixed throughput ─────────────────────────────────────────────────────
export const complexTemplate = `
{% set title = "Report" %}
{% set total = 0 %}
{% for item in items %}
  {% if item.active %}
    {{ title }}: {{ item.name | upper }} - {{ item.value | number_format }}
    {% set total = total ~ item.value %}
  {% endif %}
{% endfor %}
Total: {{ total }}
`.trim();

export const complexCtx = {
  items: Array.from({ length: 30 }, (_, i) => ({
    name: `Item ${i}`,
    value: (i + 1) * 10,
    active: i % 2 === 0
  }))
};

// ── New: nested if/for interactions ──────────────────────────────────────────
// ── New: break / continue ────────────────────────────────────────────────────
export const breakTemplate = '{% for i in items %}{% if i == 50 %}{% break %}{% endif %}{{ i }} {% endfor %}';

export const continueTemplate = '{% for i in items %}{% if i % 2 == 0 %}{% continue %}{% endif %}{{ i }} {% endfor %}';

export const breakCtx = { items: Array.from({ length: 100 }, (_, i) => i) };

export const continueCtx = { items: Array.from({ length: 100 }, (_, i) => i) };

// ── New: apply tag variants ───────────────────────────────────────────────────
export const applyUpper = '{% apply upper %}hello world{% endapply %}';

export const applyChained = '{% apply upper | trim | capitalize %}  hello world  {% endapply %}';

export const applyInLoopBench = '{% for item in items %}{% apply upper %}{{ item }}{% endapply %} {% endfor %}';

export const applyInLoopBenchCtx = { items: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'] };

// ── New: nested ternary with variable resolution ─────────────────────────────
export const nestedTernaryVar = '{{ score >= 90 ? "A" : (score >= 80 ? "B" : (score >= 70 ? "C" : "F")) }}';
