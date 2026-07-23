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

// ── New: cache performance ────────────────────────────────────────────────────

describe('cache performance', () => {
  bench('same template ×1000 (cache hit)', () => {
    for (let i = 0; i < 1000; i++) {
      processTwig(simpleTokens, simpleTokensCtx);
    }
  });

  bench('same complex template ×500 (cache hit)', () => {
    for (let i = 0; i < 500; i++) {
      processTwig(megaTemplate, megaCtx);
    }
  });

  bench('256 unique templates (cache full)', () => {
    for (let i = 0; i < 256; i++) {
      processTwig(`{{ item${i} }}`, { [`item${i}`]: `val${i}` });
    }
  });
});

// ── New: keepEmptyTokens mode ─────────────────────────────────────────────────

describe('keepEmptyTokens mode', () => {
  bench('simple token — present', () => {
    processTwig('{{ name }}', { name: 'Alice' }, true);
  });

  bench('simple token — missing', () => {
    processTwig('{{ missing }}', {}, true);
  });

  bench('mixed present + missing', () => {
    processTwig('{{ a }} {{ b }} {{ c }}', { a: 'X' }, true);
  });

  bench('conditional — present', () => {
    processTwig('{% if active %}ON{% endif %}', { active: true }, true);
  });

  bench('conditional — missing', () => {
    processTwig('{% if active %}ON{% endif %}', {}, true);
  });
});

// ── New: in operator stress ───────────────────────────────────────────────────

describe('in operator', () => {
  const arrayCtx = { items: Array.from({ length: 100 }, (_, i) => `item${i}`) };
  const objectCtx = { obj: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, i])) };

  bench('in array (hit, last element)', () => {
    processTwig('{% if "item99" in items %}found{% endif %}', arrayCtx);
  });

  bench('in array (miss)', () => {
    processTwig('{% if "missing" in items %}found{% endif %}', arrayCtx);
  });

  bench('in object (hit)', () => {
    processTwig('{% if "key99" in obj %}found{% endif %}', objectCtx);
  });

  bench('in object (miss)', () => {
    processTwig('{% if "missing" in obj %}found{% endif %}', objectCtx);
  });

  bench('not in array (miss)', () => {
    processTwig('{% if "missing" not in items %}not found{% endif %}', arrayCtx);
  });
});

// ── New: binary expression chains ─────────────────────────────────────────────

describe('binary expression chains', () => {
  bench('2-way and', () => {
    processTwig('{% if a == 1 and b == 2 %}yes{% endif %}', { a: 1, b: 2 });
  });

  bench('3-way and', () => {
    processTwig('{% if a == 1 and b == 2 and c == 3 %}yes{% endif %}', { a: 1, b: 2, c: 3 });
  });

  bench('2-way or', () => {
    processTwig('{% if a == 1 or b == 2 %}yes{% endif %}', { a: 0, b: 2 });
  });

  bench('mixed and/or', () => {
    processTwig('{% if a == 1 and b == 2 or c == 3 %}yes{% endif %}', { a: 0, b: 0, c: 3 });
  });

  bench('not + comparison', () => {
    processTwig('{% if not (a == 1) %}yes{% endif %}', { a: 2 });
  });

  bench('string comparison ==', () => {
    processTwig('{% if name == "Alice" %}yes{% endif %}', { name: 'Alice' });
  });

  bench('numeric > < >= <=', () => {
    processTwig('{% if age >= 18 and age < 65 %}yes{% endif %}', { age: 30 });
  });
});

// ── New: filter chain depth ───────────────────────────────────────────────────

describe('filter chain depth', () => {
  bench('5 chained filters', () => {
    processTwig('{{ name | upper | trim | capitalize | reverse | title }}', { name: '  alice  ' });
  });

  bench('default filter — missing', () => {
    processTwig('{{ missing | default("fallback") }}', {});
  });

  bench('default filter — present', () => {
    processTwig('{{ present | default("fallback") }}', { present: 'actual' });
  });

  bench('length filter — array', () => {
    processTwig('{{ items | length }}', { items: [1, 2, 3, 4, 5] });
  });

  bench('join filter', () => {
    processTwig('{{ items | join(", ") }}', { items: ['a', 'b', 'c', 'd', 'e'] });
  });

  bench('slice filter', () => {
    processTwig('{{ items | slice(0, 3) | join(", ") }}', { items: ['a', 'b', 'c', 'd', 'e'] });
  });
});

// ── New: large context (1000 keys) ───────────────────────────────────────────

describe('large context (1000 keys)', () => {
  const hugeCtx: Record<string, unknown> = {};
  for (let i = 0; i < 1000; i++) {
    hugeCtx[`key${i}`] = `val${i}`;
  }
  hugeCtx.user = { profile: { name: 'Alice', address: { city: 'Madrid' } } };

  bench('shallow lookup (key500)', () => {
    processTwig('{{ key500 }}', hugeCtx);
  });

  bench('deep path (4 levels)', () => {
    processTwig('{{ user.profile.name }}', hugeCtx);
  });

  bench('deep path (6 levels)', () => {
    processTwig('{{ user.profile.address.city }}', hugeCtx);
  });

  bench('multiple shallow lookups', () => {
    processTwig('{{ key0 }} {{ key100 }} {{ key200 }} {{ key300 }} {{ key400 }}', hugeCtx);
  });
});

// ── New: string-heavy templates ───────────────────────────────────────────────

describe('string-heavy templates', () => {
  const longText = 'Lorem ipsum dolor sit amet. '.repeat(100);
  const longTextWithToken = `${longText}{{ name }}`;
  const longHtmlNoTokens = '<div>' + '<p>paragraph</p>'.repeat(50) + '</div>';
  const longHtmlWithTokens = '<div>' + '<p>{{ title }}</p>'.repeat(20) + '</div>';

  bench('long text, no tokens (5KB)', () => {
    processTwig(longText, {});
  });

  bench('long text + single token at end', () => {
    processTwig(longTextWithToken, { name: 'Alice' });
  });

  bench('long HTML, no tokens (2KB)', () => {
    processTwig(longHtmlNoTokens, {});
  });

  bench('long HTML + 20 tokens', () => {
    processTwig(longHtmlWithTokens, { title: 'Hello' });
  });
});

// ── New: for loop with key-value iteration ────────────────────────────────────

describe('for loop key-value', () => {
  const kvCtx = {
    data: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`key${i}`, `value${i}`]))
  };

  bench('key-value for loop (20 entries)', () => {
    processTwig('{% for k, v in data %}{{ k }}={{ v }} {% endfor %}', kvCtx);
  });

  bench('array for loop (20 items)', () => {
    processTwig('{% for item in items %}{{ item }} {% endfor %}', {
      items: Array.from({ length: 20 }, (_, i) => `item${i}`)
    });
  });
});

// ── New: range function ──────────────────────────────────────────────────────

describe('range function', () => {
  bench('range(10) + for loop', () => {
    processTwig('{% for i in range(10) %}{{ i }} {% endfor %}', {});
  });

  bench('range(1, 10, 2) + for loop', () => {
    processTwig('{% for i in range(1, 10, 2) %}{{ i }} {% endfor %}', {});
  });

  bench('range literal syntax 1..10', () => {
    processTwig('{% for i in 1..10 %}{{ i }} {% endfor %}', {});
  });
});

// ── New: nested if/for interactions ──────────────────────────────────────────

// ── New: break / continue ────────────────────────────────────────────────────

const breakTemplate = '{% for i in items %}{% if i == 50 %}{% break %}{% endif %}{{ i }} {% endfor %}';
const continueTemplate = '{% for i in items %}{% if i % 2 == 0 %}{% continue %}{% endif %}{{ i }} {% endfor %}';
const breakCtx = { items: Array.from({ length: 100 }, (_, i) => i) };
const continueCtx = { items: Array.from({ length: 100 }, (_, i) => i) };

describe('break / continue', () => {
  bench('break at item 50 (100 items)', () => {
    processTwig(breakTemplate, breakCtx);
  });

  bench('continue skip even (100 items)', () => {
    processTwig(continueTemplate, continueCtx);
  });

  bench('break in nested loop', () => {
    processTwig(
      '{% for a in outer %}{% for b in items %}{% if b == 50 %}{% break %}{% endif %}{{ b }}{% endfor %}{% endfor %}',
      { outer: [1, 2, 3], items: Array.from({ length: 100 }, (_, i) => i) }
    );
  });
});

// ── New: apply tag variants ───────────────────────────────────────────────────

const applyUpper = '{% apply upper %}hello world{% endapply %}';
const applyChained = '{% apply upper | trim | capitalize %}  hello world  {% endapply %}';
const applyInLoopBench = '{% for item in items %}{% apply upper %}{{ item }}{% endapply %} {% endfor %}';
const applyInLoopBenchCtx = { items: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'] };

describe('apply tag variants', () => {
  bench('single apply (upper)', () => {
    processTwig(applyUpper, {});
  });

  bench('chained apply (3 filters)', () => {
    processTwig(applyChained, {});
  });

  bench('apply in 8-item loop', () => {
    processTwig(applyInLoopBench, applyInLoopBenchCtx);
  });
});

// ── New: nested ternary with variable resolution ─────────────────────────────

const nestedTernaryVar = '{{ score >= 90 ? "A" : (score >= 80 ? "B" : (score >= 70 ? "C" : "F")) }}';

describe('nested ternary expressions', () => {
  bench('nested ternary (3-deep, var resolution)', () => {
    processTwig(nestedTernaryVar, { score: 85 });
  });

  bench('simple ternary with arithmetic', () => {
    processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: 5 });
  });
});

// ── New: object iteration ────────────────────────────────────────────────────

describe('object iteration', () => {
  const obj20 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, `v${i}`]));
  const obj100 = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, `v${i}`]));

  bench('for key, value in object (20 entries)', () => {
    processTwig('{% for k, v in obj %}{{ k }}={{ v }} {% endfor %}', { obj: obj20 });
  });

  bench('for key, value in object (100 entries)', () => {
    processTwig('{% for k, v in obj %}{{ k }}={{ v }} {% endfor %}', { obj: obj100 });
  });

  bench('for value in object values (20 entries)', () => {
    processTwig('{% for v in obj %}{{ v }} {% endfor %}', { obj: obj20 });
  });
});

// ── New: set with expression evaluation ──────────────────────────────────────

const setArithmetic = '{% set x = a + b * c - d %}{{ x }}';
const setConcat = '{% set s = a ~ " " ~ b ~ " " ~ c %}{{ s }}';
const setNested = '{% set a = 1 %}{% set b = a + 1 %}{% set c = b + 1 %}{% set d = c + 1 %}{{ d }}';

describe('set with expression evaluation', () => {
  bench('set with arithmetic (4 vars)', () => {
    processTwig(setArithmetic, { a: 10, b: 3, c: 2, d: 5 });
  });

  bench('set with concat (3 vars)', () => {
    processTwig(setConcat, { a: 'hello', b: 'world', c: '!' });
  });

  bench('4 chained sets with dependency', () => {
    processTwig(setNested, {});
  });
});

// ── New: complex and/or/not conditions ───────────────────────────────────────

describe('complex logical conditions', () => {
  bench('3-way and with not', () => {
    processTwig('{% if a and not b and c %}yes{% endif %}', { a: true, b: false, c: true });
  });

  bench('mixed and/or with comparisons', () => {
    processTwig('{% if (x > 0 and x < 100) or (y == "special") %}yes{% endif %}', { x: 50, y: 'normal' });
  });

  bench('nested not in + and', () => {
    processTwig('{% if "admin" not in roles and active %}yes{% endif %}', {
      roles: ['viewer', 'editor'],
      active: true
    });
  });
});

// ── New: loop metadata ───────────────────────────────────────────────────────

describe('loop metadata access', () => {
  bench('loop.index + loop.index0 (100 items)', () => {
    processTwig('{% for i in items %}{{ loop.index }}:{{ loop.index0 }} {% endfor %}', {
      items: Array.from({ length: 100 }, (_, i) => i)
    });
  });

  bench('loop.first + loop.last (100 items)', () => {
    processTwig('{% for i in items %}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}{% endfor %}', {
      items: Array.from({ length: 100 }, (_, i) => i)
    });
  });

  bench('loop.revindex (100 items)', () => {
    processTwig('{% for i in items %}{{ loop.revindex }} {% endfor %}', {
      items: Array.from({ length: 100 }, (_, i) => i)
    });
  });
});

// ── New: empty / trivial loop / if ──────────────────────────────────────────

describe('empty loop and if bodies', () => {
  bench('for with empty body (100 items)', () => {
    processTwig('{% for i in items %}{% endfor %}', { items: Array.from({ length: 100 }, (_, i) => i) });
  });

  bench('if true with empty body', () => {
    processTwig('{% if active %}{% endif %}', { active: true });
  });

  bench('for with else branch (empty array)', () => {
    processTwig('{% for i in items %}X{% else %}empty{% endfor %}', { items: [] as number[] });
  });
});

// ── New: deep path resolution with large context ─────────────────────────────

describe('deep path with large context', () => {
  const hugeCtx: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) {
    hugeCtx[`k${i}`] = `v${i}`;
  }
  hugeCtx.user = { profile: { settings: { theme: 'dark', lang: 'en', notifications: { email: true } } } };

  bench('3-level deep path (500-key context)', () => {
    processTwig('{{ user.profile.settings }}', hugeCtx);
  });

  bench('4-level deep path (500-key context)', () => {
    processTwig('{{ user.profile.settings.theme }}', hugeCtx);
  });

  bench('5-level deep path (500-key context)', () => {
    processTwig('{{ user.profile.settings.notifications.email }}', hugeCtx);
  });
});

// ── New: filter stress ──────────────────────────────────────────────────────

describe('filter stress', () => {
  bench('column + join (20 items)', () => {
    processTwig('{{ items | column("name") | join(", ") }}', {
      items: Array.from({ length: 20 }, (_, i) => ({ name: `Item${i}` }))
    });
  });

  bench('sort + join (20 items)', () => {
    processTwig('{{ items | sort | join(", ") }}', {
      items: ['z', 'm', 'a', 'k', 'b', 'y', 'c', 'x', 'd', 'w', 'e', 'v', 'f', 'u', 'g', 't', 'h', 's', 'i', 'r']
    });
  });

  bench('batch + loop (20 items, batch 5)', () => {
    processTwig('{% for batch in items | batch(5) %}[{{ batch | join(",") }}]{% endfor %}', {
      items: Array.from({ length: 20 }, (_, i) => i)
    });
  });

  bench('filter chain: split + map + join', () => {
    processTwig('{{ data | split(",") | join(" | ") }}', { data: 'a,b,c,d,e,f,g,h' });
  });
});

// ── New: range variants ──────────────────────────────────────────────────────

describe('range variants', () => {
  bench('range(50) + for loop', () => {
    processTwig('{% for i in range(50) %}{{ i }} {% endfor %}', {});
  });

  bench('range(0, 100, 3) + for loop', () => {
    processTwig('{% for i in range(0, 100, 3) %}{{ i }} {% endfor %}', {});
  });

  bench('literal range 1..20 + for', () => {
    processTwig('{% for i in 1..20 %}{{ i }} {% endfor %}', {});
  });
});

// ── New: mixed set + for + filter pipeline ──────────────────────────────────

describe('set + for + filter pipeline', () => {
  bench('set accumulator in loop (100 items)', () => {
    processTwig('{% set total = 0 %}{% for i in items %}{% set total = total + i %}{% endfor %}{{ total }}', {
      items: Array.from({ length: 100 }, (_, i) => i + 1)
    });
  });

  bench('set string accumulator in loop (100 items)', () => {
    processTwig('{% set r = "" %}{% for i in items %}{% set r = r ~ i ~ "," %}{% endfor %}{{ r }}', {
      items: Array.from({ length: 100 }, (_, i) => i)
    });
  });

  bench('set + filter pipeline (5 items)', () => {
    processTwig('{% set names = items | column("name") | sort | join(", ") %}{{ names }}', {
      items: [{ name: 'Z' }, { name: 'A' }, { name: 'M' }, { name: 'B' }, { name: 'K' }]
    });
  });
});

// ── New: deep set + for + if + filter mega template ────────────────────────

const megaDeepTemplate = `
{% set title = "Inventory" %}
{% set totalValue = 0 %}
{% set totalCount = 0 %}
{% set categories = [] %}
{% for product in products %}
  {% if product.price > 100 %}
    <div class="premium">
      {{ product.name | upper }}
      {{ product.price | number_format(2, '.', ',') }}
    </div>
    {% set totalValue = totalValue + product.price %}
    {% set totalCount = totalCount + 1 %}
  {% endif %}
{% endfor %}
{{ title }}: {{ totalCount }} items worth {{ totalValue | number_format(2, '.', ',') }}
`.trim();

const megaDeepCtx = {
  products: Array.from({ length: 200 }, (_, i) => ({
    name: `Product ${i}`,
    price: 10 + i * 10,
    inStock: i % 3 !== 0
  }))
};

describe('mega deep template', () => {
  bench('200 products: set + for + if + filters + number_format', () => {
    processTwig(megaDeepTemplate, megaDeepCtx);
  });
});

describe('nested if/for interactions', () => {
  const usersCtx = {
    users: Array.from({ length: 10 }, (_, i) => ({
      name: `User${i}`,
      role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'editor' : 'viewer',
      active: i % 2 === 0
    }))
  };

  bench('for + nested if (3 branches, 10 users)', () => {
    processTwig(
      '{% for u in users %}{% if u.role == "admin" %}A{% elseif u.role == "editor" %}E{% else %}V{% endif %}{% endfor %}',
      usersCtx
    );
  });

  bench('for + nested for (3×3)', () => {
    processTwig('{% for r in rows %}{% for c in cols %}{{ r }}-{{ c }} {% endfor %}{% endfor %}', {
      rows: ['A', 'B', 'C'],
      cols: ['1', '2', '3']
    });
  });

  bench('for + if guard + set accumulator', () => {
    processTwig(
      '{% set total = 0 %}{% for u in users %}{% if u.active %}{% set total = total + 1 %}{% endif %}{% endfor %}{{ total }}',
      usersCtx
    );
  });
});
