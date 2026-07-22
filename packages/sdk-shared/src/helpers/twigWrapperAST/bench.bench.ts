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

// ── New: deep set blocks ──────────────────────────────────────────────────────

const deepSetBlocks = (() => {
  let body = '{{ z }}';
  for (let i = 2; i <= 20; i++) {
    body = `{% set z${i} = z${i - 1} ~ "x" %}${body}`;
  }
  return `{% set z1 = "a" %}${body}`;
})();

const setChainConcat = `
{% set a = "hello" %}{% set b = a ~ " " %}{% set c = b ~ "world" %}{% set d = c ~ "!" %}
{% set e = d ~ " " %}{% set f = e ~ "end" %}{{ f }}
`.trim();

// ── New: apply-tag heavy ──────────────────────────────────────────────────────

const applyTagSimple = '{{ content | upper }}';
const applyTagChained = '{{ content | upper | trim | capitalize }}';
const applyTagWithRaw = '{{ "<b>bold</b>" | striptags }}';

const multipleApplyBlocks = `
{% apply upper %}first{% endapply %}
{% apply trim %}  second  {% endapply %}
{% apply capitalize %}third{% endapply %}
{% apply upper | trim %}  fourth  {% endapply %}
`.trim();

const applyInLoop = `
{% for item in items %}
  {% apply upper %}{{ item }}{% endapply %}
{% endfor %}
`.trim();

const applyInLoopCtx = { items: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] };

// ── New: many conditional branches ────────────────────────────────────────────

const tenBranchIf = (() => {
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

const sequentialSmallIfs = Array.from({ length: 20 }, (_, i) => `{% if a${i} %}X{% endif %}`).join('');

const sequentialSmallIfsCtx: Record<string, unknown> = {};
for (let i = 0; i < 20; i++) {
  sequentialSmallIfsCtx[`a${i}`] = i % 3 === 0;
}

// ── New: for loop with else ───────────────────────────────────────────────────

const forLoopWithElse = '{% for item in items %}{{ item }} {% else %}empty{% endfor %}';
const forLoopWithElseCtx = { items: ['a', 'b', 'c'] };
const forLoopWithElseEmptyCtx = { items: [] as string[] };

// ── New: ternary ──────────────────────────────────────────────────────────────

const ternarySimple = '{{ active ? "yes" : "no" }}';
const ternaryNested = '{{ status == "a" ? "alpha" : (status == "b" ? "beta" : "other") }}';

// ── New: large context (resolvePath stress) ───────────────────────────────────

const largeContextTemplate = '{{ deep.nested.value }}';
const largeContextCtx: Record<string, unknown> = {};
for (let i = 0; i < 200; i++) {
  largeContextCtx[`key${i}`] = `val${i}`;
}
largeContextCtx.deep = { nested: { value: 'found' } };

const shallowLookupTemplate = '{{ key42 }}';

// ── New: edge cases ───────────────────────────────────────────────────────────

const emptyTemplate = '';
const singleToken = '{{ x }}';
const whitespaceOnly = '   \n  \t  ';
const pureHtml = '<div><p>Hello</p><span>World</span></div>';
const mixedHtmlAndTokens = '<div class="{{ cls }}">{{ greeting }} {{ name }}</div>';
const mixedHtmlAndTokensCtx = { cls: 'active', greeting: 'Hi', name: 'Alice' };

const tokenWithDefault = '{{ missing | default("fallback") }}';
const tokenWithDefaultPresent = '{{ present | default("fallback") }}';
const tokenWithDefaultPresentCtx = { present: 'actual' };

// ── New: string concatenation heavy ───────────────────────────────────────────

const concatHeavy = '{{ a ~ b ~ c ~ d ~ e ~ f }}';
const concatHeavyCtx = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F' };

const concatWithFilters = '{{ (a ~ b) | upper }}';
const concatWithFiltersCtx = { a: 'hello', b: 'world' };

// ── New: mixed throughput ─────────────────────────────────────────────────────

const complexTemplate = `
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

const complexCtx = {
  items: Array.from({ length: 30 }, (_, i) => ({
    name: `Item ${i}`,
    value: (i + 1) * 10,
    active: i % 2 === 0
  }))
};

// ── Benchmarks ────────────────────────────────────────────────────────────────

describe('deep set blocks', () => {
  bench('20 nested set blocks', () => {
    processTwig(deepSetBlocks, {});
  });

  bench('6 chained concat sets', () => {
    processTwig(setChainConcat, {});
  });
});

describe('apply-tag heavy', () => {
  bench('single apply (upper)', () => {
    processTwig(applyTagSimple, { content: 'hello world' });
  });

  bench('triple chained apply', () => {
    processTwig(applyTagChained, { content: '  hello world  ' });
  });

  bench('striptags apply', () => {
    processTwig(applyTagWithRaw, {});
  });

  bench('4 sequential apply blocks', () => {
    processTwig(multipleApplyBlocks, {});
  });

  bench('apply inside 5-item loop', () => {
    processTwig(applyInLoop, applyInLoopCtx);
  });
});

describe('conditional density', () => {
  bench('10-branch elseif chain (match at end)', () => {
    processTwig(tenBranchIf, { v: 9 });
  });

  bench('10-branch elseif chain (match at start)', () => {
    processTwig(tenBranchIf, { v: 0 });
  });

  bench('20 sequential small ifs', () => {
    processTwig(sequentialSmallIfs, sequentialSmallIfsCtx);
  });
});

describe('for loop variants', () => {
  bench('for with else (non-empty)', () => {
    processTwig(forLoopWithElse, forLoopWithElseCtx);
  });

  bench('for with else (empty → else branch)', () => {
    processTwig(forLoopWithElse, forLoopWithElseEmptyCtx);
  });
});

describe('ternary expressions', () => {
  bench('simple ternary', () => {
    processTwig(ternarySimple, { active: true });
  });

  bench('nested ternary', () => {
    processTwig(ternaryNested, { status: 'b' });
  });
});

describe('context lookup depth', () => {
  bench('large context (200 keys) — deep path', () => {
    processTwig(largeContextTemplate, largeContextCtx);
  });

  bench('large context (200 keys) — shallow lookup', () => {
    processTwig(shallowLookupTemplate, largeContextCtx);
  });
});

describe('edge cases / trivial', () => {
  bench('empty string', () => {
    processTwig(emptyTemplate, {});
  });

  bench('single token', () => {
    processTwig(singleToken, { x: 'value' });
  });

  bench('whitespace only', () => {
    processTwig(whitespaceOnly, {});
  });

  bench('pure HTML (no tokens)', () => {
    processTwig(pureHtml, {});
  });

  bench('HTML + tokens', () => {
    processTwig(mixedHtmlAndTokens, mixedHtmlAndTokensCtx);
  });

  bench('token with default (missing)', () => {
    processTwig(tokenWithDefault, {});
  });

  bench('token with default (present)', () => {
    processTwig(tokenWithDefaultPresent, tokenWithDefaultPresentCtx);
  });
});

describe('string concatenation', () => {
  bench('6-way concat', () => {
    processTwig(concatHeavy, concatHeavyCtx);
  });

  bench('concat + filter', () => {
    processTwig(concatWithFilters, concatWithFiltersCtx);
  });
});

describe('throughput: process 1000 templates', () => {
  bench('mixed templates ×1000', () => {
    const templates = [
      simpleTokens,
      conditionalSimple,
      conditionalChained,
      forLoopSimple,
      filterChain,
      noOpTemplate,
      ternarySimple,
      setChainConcat,
      applyTagChained,
      multipleApplyBlocks,
      sequentialSmallIfs,
      concatHeavy
    ];
    const contexts = [
      simpleTokensCtx,
      { active: true },
      { status: 'c' },
      forLoopSimpleCtx,
      filterChainCtx,
      {},
      { active: true },
      {},
      { content: 'test' },
      {},
      sequentialSmallIfsCtx,
      concatHeavyCtx
    ];

    for (let i = 0; i < 1000; i++) {
      const idx = i % templates.length;
      processTwig(templates[idx], contexts[idx]);
    }
  });

  bench('complex template ×500', () => {
    for (let i = 0; i < 500; i++) {
      processTwig(complexTemplate, complexCtx);
    }
  });
});
