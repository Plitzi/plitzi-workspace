import { bench, describe } from 'vitest';

import { processTwig } from './processTwig';

// ── Templates by category ──────────────────────────────────────────────────

const simpleTokens = '{{ name }} is {{ age }} years old and lives in {{ city }}';
const simpleTokensCtx = { name: 'Alice', age: 30, city: 'Madrid' };

const manyTokens = Array.from({ length: 200 }, (_, i) => `{{ item${i} }}`).join(' ');
const manyTokensCtx: Record<string, unknown> = {};
for (let i = 0; i < 200; i++) {
  manyTokensCtx[`item${i}`] = `val${i}`;
}

const filterChain = '{{ name | upper | trim | capitalize }}';
const filterChainCtx = { name: '  alice  ' };

const conditionalSimple = '{% if active %}ON{% else %}OFF{% endif %}';
const conditionalChained =
  '{% if status == "a" %}alpha{% elseif status == "b" %}beta{% elseif status == "c" %}gamma{% else %}delta{% endif %}';

const forLoopSimple = '{% for item in items %}{{ item }} {% endfor %}';
const forLoopSimpleCtx = { items: ['a', 'b', 'c', 'd', 'e'] };

const forLoopLarge = '{% for i in items %}{{ i }} {% endfor %}';
const forLoopLargeCtx = { items: Array.from({ length: 100 }, (_, i) => `item${i}`) };

const nestedForLoop = `
{% for row in rows %}{% for col in cols %}{{ row }}-{{ col }} {% endfor %}{% endfor %}
`.trim();

const combinedTemplate = `
{% set greeting = "Hello" %}
{% for user in users %}
  {% if user.active %}
    {{ greeting }} {{ user.name | upper }}!
  {% else %}
    {{ greeting }} {{ user.name | lower }} (inactive)
  {% endif %}
{% endfor %}
`.trim();

const combinedCtx = {
  users: [
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
    { name: 'Carol', active: true },
    { name: 'Dave', active: false }
  ]
};

const megaTemplate = `
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

const megaCtx = {
  products: Array.from({ length: 50 }, (_, i) => ({
    name: `Product ${i}`,
    description: `this is product number ${i} with a long description`,
    price: 10 + i * 5,
    inStock: i % 3 !== 0,
    discount: i % 5 === 0 ? 20 : 0
  }))
};

const noOpTemplate = 'Just plain text with no tokens or tags at all.';

const setHeavyTemplate = `
{% set a = "hello" %}{% set b = "world" %}{% set c = a ~ " " ~ b %}
{% set x = 1 %}{% set y = 2 %}{% set z = x + y %}
{{ c }}
`.trim();

const deeplyNestedIf = (() => {
  let tpl = '{% if x1 %}deep{% endif %}';
  for (let i = 2; i <= 20; i++) {
    tpl = `{% if x${i} %}${tpl}{% endif %}`;
  }
  return tpl;
})();

const deeplyNestedFor = (() => {
  let body = '{{ a }}';
  for (let i = 0; i < 4; i++) {
    body = `{% for x${i} in items %}${body}{% endfor %}`;
  }
  return body;
})();

const deeplyNestedForCtx = {
  items: [1, 2, 3],
  a: 'ok',
  x0: 1,
  x1: 1,
  x2: 1,
  x3: 1
};

// ── Benchmarks ──────────────────────────────────────────────────────────────

describe('simple token interpolation', () => {
  bench('3 tokens', () => {
    processTwig(simpleTokens, simpleTokensCtx);
  });

  bench('200 tokens', () => {
    processTwig(manyTokens, manyTokensCtx);
  });
});

describe('filter chains', () => {
  bench('triple filter', () => {
    processTwig(filterChain, filterChainCtx);
  });
});

describe('conditionals', () => {
  bench('simple if/else', () => {
    processTwig(conditionalSimple, { active: true });
  });

  bench('3-branch elseif chain', () => {
    processTwig(conditionalChained, { status: 'c' });
  });

  bench('20-deep nested if (all true)', () => {
    processTwig(deeplyNestedIf, { x1: true, x2: true, x3: true, x4: true, x5: true });
  });
});

describe('for loops', () => {
  bench('5-item loop', () => {
    processTwig(forLoopSimple, forLoopSimpleCtx);
  });

  bench('100-item loop', () => {
    processTwig(forLoopLarge, forLoopLargeCtx);
  });

  bench('100-item loop with accumulator', () => {
    processTwig('{% set r = "" %}{% for i in items %}{% set r = r ~ i ~ " " %}{% endfor %}{{ r | trim }}', {
      items: Array.from({ length: 100 }, (_, i) => `v${i}`)
    });
  });

  bench('3×3 nested loop', () => {
    processTwig(nestedForLoop, { rows: ['A', 'B', 'C'], cols: ['1', '2', '3'] });
  });

  bench('4-level nested loop (3 items each)', () => {
    processTwig(deeplyNestedFor, deeplyNestedForCtx);
  });
});

describe('combined features', () => {
  bench('set + for + if + filters (4 users)', () => {
    processTwig(combinedTemplate, combinedCtx);
  });

  bench('mega template (50 products, set + for + if + filters)', () => {
    processTwig(megaTemplate, megaCtx);
  });
});

describe('no-op / trivial', () => {
  bench('plain text (no tokens)', () => {
    processTwig(noOpTemplate, {});
  });

  bench('set-heavy (6 set + concat)', () => {
    processTwig(setHeavyTemplate, {});
  });
});

describe('throughput: process 1000 templates', () => {
  bench('mixed templates ×1000', () => {
    const templates = [simpleTokens, conditionalSimple, conditionalChained, forLoopSimple, filterChain, noOpTemplate];
    const contexts = [simpleTokensCtx, { active: true }, { status: 'c' }, forLoopSimpleCtx, filterChainCtx, {}];

    for (let i = 0; i < 1000; i++) {
      const idx = i % templates.length;
      processTwig(templates[idx], contexts[idx]);
    }
  });
});
