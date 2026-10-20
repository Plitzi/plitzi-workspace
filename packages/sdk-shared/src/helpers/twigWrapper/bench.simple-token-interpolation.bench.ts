import { test } from 'vitest';

import { processTwig } from './processTwig';
import {
  applyChained,
  applyInLoop,
  applyInLoopBench,
  applyInLoopBenchCtx,
  applyInLoopCtx,
  applyTagChained,
  applyTagSimple,
  applyTagWithRaw,
  applyUpper,
  breakCtx,
  breakTemplate,
  combinedCtx,
  combinedTemplate,
  complexCtx,
  complexTemplate,
  concatHeavy,
  concatHeavyCtx,
  concatWithFilters,
  concatWithFiltersCtx,
  conditionalChained,
  conditionalSimple,
  continueCtx,
  continueTemplate,
  deepSetBlocks,
  deeplyNestedFor,
  deeplyNestedForCtx,
  deeplyNestedIf,
  emptyTemplate,
  filterChain,
  filterChainCtx,
  forLoopLarge,
  forLoopLargeCtx,
  forLoopSimple,
  forLoopSimpleCtx,
  forLoopWithElse,
  forLoopWithElseCtx,
  forLoopWithElseEmptyCtx,
  largeContextCtx,
  largeContextTemplate,
  manyTokens,
  manyTokensCtx,
  megaCtx,
  megaTemplate,
  mixedHtmlAndTokens,
  mixedHtmlAndTokensCtx,
  multipleApplyBlocks,
  nestedForLoop,
  nestedTernaryVar,
  noOpTemplate,
  pureHtml,
  sequentialSmallIfs,
  sequentialSmallIfsCtx,
  setChainConcat,
  setHeavyTemplate,
  shallowLookupTemplate,
  simpleTokens,
  simpleTokensCtx,
  singleToken,
  tenBranchIf,
  ternaryNested,
  ternarySimple,
  tokenWithDefault,
  tokenWithDefaultPresent,
  tokenWithDefaultPresentCtx,
  whitespaceOnly
} from './tests/bench';

// ── Benchmarks ──────────────────────────────────────────────────────────────

test('simple token interpolation', async ({ bench }) => {
  await bench.compare(
    bench('3 tokens', () => {
      processTwig(simpleTokens, simpleTokensCtx);
    }),
    bench('200 tokens', () => {
      processTwig(manyTokens, manyTokensCtx);
    })
  );
});
test('filter chains', async ({ bench }) => {
  await bench('triple filter', () => {
    processTwig(filterChain, filterChainCtx);
  }).run();
});
test('conditionals', async ({ bench }) => {
  await bench.compare(
    bench('simple if/else', () => {
      processTwig(conditionalSimple, { active: true });
    }),
    bench('3-branch elseif chain', () => {
      processTwig(conditionalChained, { status: 'c' });
    }),
    bench('20-deep nested if (all true)', () => {
      processTwig(deeplyNestedIf, { x1: true, x2: true, x3: true, x4: true, x5: true });
    })
  );
});
test('for loops', async ({ bench }) => {
  await bench.compare(
    bench('5-item loop', () => {
      processTwig(forLoopSimple, forLoopSimpleCtx);
    }),
    bench('100-item loop', () => {
      processTwig(forLoopLarge, forLoopLargeCtx);
    }),
    bench('100-item loop with accumulator', () => {
      processTwig('{% set r = "" %}{% for i in items %}{% set r = r ~ i ~ " " %}{% endfor %}{{ r | trim }}', {
        items: Array.from({ length: 100 }, (_, i) => `v${i}`)
      });
    }),
    bench('3×3 nested loop', () => {
      processTwig(nestedForLoop, { rows: ['A', 'B', 'C'], cols: ['1', '2', '3'] });
    }),
    bench('4-level nested loop (3 items each)', () => {
      processTwig(deeplyNestedFor, deeplyNestedForCtx);
    })
  );
});
test('combined features', async ({ bench }) => {
  await bench.compare(
    bench('set + for + if + filters (4 users)', () => {
      processTwig(combinedTemplate, combinedCtx);
    }),
    bench('mega template (50 products, set + for + if + filters)', () => {
      processTwig(megaTemplate, megaCtx);
    })
  );
});
test('no-op / trivial', async ({ bench }) => {
  await bench.compare(
    bench('plain text (no tokens)', () => {
      processTwig(noOpTemplate, {});
    }),
    bench('set-heavy (6 set + concat)', () => {
      processTwig(setHeavyTemplate, {});
    })
  );
});
// ── Benchmarks ────────────────────────────────────────────────────────────────
test('deep set blocks', async ({ bench }) => {
  await bench.compare(
    bench('20 nested set blocks', () => {
      processTwig(deepSetBlocks, {});
    }),
    bench('6 chained concat sets', () => {
      processTwig(setChainConcat, {});
    })
  );
});
test('apply-tag heavy', async ({ bench }) => {
  await bench.compare(
    bench('single apply (upper)', () => {
      processTwig(applyTagSimple, { content: 'hello world' });
    }),
    bench('triple chained apply', () => {
      processTwig(applyTagChained, { content: '  hello world  ' });
    }),
    bench('striptags apply', () => {
      processTwig(applyTagWithRaw, {});
    }),
    bench('4 sequential apply blocks', () => {
      processTwig(multipleApplyBlocks, {});
    }),
    bench('apply inside 5-item loop', () => {
      processTwig(applyInLoop, applyInLoopCtx);
    })
  );
});
test('conditional density', async ({ bench }) => {
  await bench.compare(
    bench('10-branch elseif chain (match at end)', () => {
      processTwig(tenBranchIf, { v: 9 });
    }),
    bench('10-branch elseif chain (match at start)', () => {
      processTwig(tenBranchIf, { v: 0 });
    }),
    bench('20 sequential small ifs', () => {
      processTwig(sequentialSmallIfs, sequentialSmallIfsCtx);
    })
  );
});
test('for loop variants', async ({ bench }) => {
  await bench.compare(
    bench('for with else (non-empty)', () => {
      processTwig(forLoopWithElse, forLoopWithElseCtx);
    }),
    bench('for with else (empty → else branch)', () => {
      processTwig(forLoopWithElse, forLoopWithElseEmptyCtx);
    })
  );
});
test('ternary expressions', async ({ bench }) => {
  await bench.compare(
    bench('simple ternary', () => {
      processTwig(ternarySimple, { active: true });
    }),
    bench('nested ternary', () => {
      processTwig(ternaryNested, { status: 'b' });
    })
  );
});
test('context lookup depth', async ({ bench }) => {
  await bench.compare(
    bench('large context (200 keys) — deep path', () => {
      processTwig(largeContextTemplate, largeContextCtx);
    }),
    bench('large context (200 keys) — shallow lookup', () => {
      processTwig(shallowLookupTemplate, largeContextCtx);
    })
  );
});
test('edge cases / trivial', async ({ bench }) => {
  await bench.compare(
    bench('empty string', () => {
      processTwig(emptyTemplate, {});
    }),
    bench('single token', () => {
      processTwig(singleToken, { x: 'value' });
    }),
    bench('whitespace only', () => {
      processTwig(whitespaceOnly, {});
    }),
    bench('pure HTML (no tokens)', () => {
      processTwig(pureHtml, {});
    }),
    bench('HTML + tokens', () => {
      processTwig(mixedHtmlAndTokens, mixedHtmlAndTokensCtx);
    }),
    bench('token with default (missing)', () => {
      processTwig(tokenWithDefault, {});
    }),
    bench('token with default (present)', () => {
      processTwig(tokenWithDefaultPresent, tokenWithDefaultPresentCtx);
    })
  );
});
test('string concatenation', async ({ bench }) => {
  await bench.compare(
    bench('6-way concat', () => {
      processTwig(concatHeavy, concatHeavyCtx);
    }),
    bench('concat + filter', () => {
      processTwig(concatWithFilters, concatWithFiltersCtx);
    })
  );
});
test('throughput: process 1000 templates', async ({ bench }) => {
  await bench.compare(
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
    }),
    bench('complex template ×500', () => {
      for (let i = 0; i < 500; i++) {
        processTwig(complexTemplate, complexCtx);
      }
    })
  );
});
// ── New: cache performance ────────────────────────────────────────────────────
test('cache performance', async ({ bench }) => {
  await bench.compare(
    bench('same template ×1000 (cache hit)', () => {
      for (let i = 0; i < 1000; i++) {
        processTwig(simpleTokens, simpleTokensCtx);
      }
    }),
    bench('same complex template ×500 (cache hit)', () => {
      for (let i = 0; i < 500; i++) {
        processTwig(megaTemplate, megaCtx);
      }
    }),
    bench('256 unique templates (cache full)', () => {
      for (let i = 0; i < 256; i++) {
        processTwig(`{{ item${i} }}`, { [`item${i}`]: `val${i}` });
      }
    })
  );
});
// ── New: keepEmptyTokens mode ─────────────────────────────────────────────────
test('keepEmptyTokens mode', async ({ bench }) => {
  await bench.compare(
    bench('simple token — present', () => {
      processTwig('{{ name }}', { name: 'Alice' }, true);
    }),
    bench('simple token — missing', () => {
      processTwig('{{ missing }}', {}, true);
    }),
    bench('mixed present + missing', () => {
      processTwig('{{ a }} {{ b }} {{ c }}', { a: 'X' }, true);
    }),
    bench('conditional — present', () => {
      processTwig('{% if active %}ON{% endif %}', { active: true }, true);
    }),
    bench('conditional — missing', () => {
      processTwig('{% if active %}ON{% endif %}', {}, true);
    })
  );
});
// ── New: in operator stress ───────────────────────────────────────────────────
test('in operator', async ({ bench }) => {
  const arrayCtx = { items: Array.from({ length: 100 }, (_, i) => `item${i}`) };
  const objectCtx = { obj: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, i])) };

  await bench.compare(
    bench('in array (hit, last element)', () => {
      processTwig('{% if "item99" in items %}found{% endif %}', arrayCtx);
    }),
    bench('in array (miss)', () => {
      processTwig('{% if "missing" in items %}found{% endif %}', arrayCtx);
    }),
    bench('in object (hit)', () => {
      processTwig('{% if "key99" in obj %}found{% endif %}', objectCtx);
    }),
    bench('in object (miss)', () => {
      processTwig('{% if "missing" in obj %}found{% endif %}', objectCtx);
    }),
    bench('not in array (miss)', () => {
      processTwig('{% if "missing" not in items %}not found{% endif %}', arrayCtx);
    })
  );
});
// ── New: binary expression chains ─────────────────────────────────────────────
test('binary expression chains', async ({ bench }) => {
  await bench.compare(
    bench('2-way and', () => {
      processTwig('{% if a == 1 and b == 2 %}yes{% endif %}', { a: 1, b: 2 });
    }),
    bench('3-way and', () => {
      processTwig('{% if a == 1 and b == 2 and c == 3 %}yes{% endif %}', { a: 1, b: 2, c: 3 });
    }),
    bench('2-way or', () => {
      processTwig('{% if a == 1 or b == 2 %}yes{% endif %}', { a: 0, b: 2 });
    }),
    bench('mixed and/or', () => {
      processTwig('{% if a == 1 and b == 2 or c == 3 %}yes{% endif %}', { a: 0, b: 0, c: 3 });
    }),
    bench('not + comparison', () => {
      processTwig('{% if not (a == 1) %}yes{% endif %}', { a: 2 });
    }),
    bench('string comparison ==', () => {
      processTwig('{% if name == "Alice" %}yes{% endif %}', { name: 'Alice' });
    }),
    bench('numeric > < >= <=', () => {
      processTwig('{% if age >= 18 and age < 65 %}yes{% endif %}', { age: 30 });
    })
  );
});
// ── New: filter chain depth ───────────────────────────────────────────────────
test('filter chain depth', async ({ bench }) => {
  await bench.compare(
    bench('5 chained filters', () => {
      processTwig('{{ name | upper | trim | capitalize | reverse | title }}', { name: '  alice  ' });
    }),
    bench('default filter — missing', () => {
      processTwig('{{ missing | default("fallback") }}', {});
    }),
    bench('default filter — present', () => {
      processTwig('{{ present | default("fallback") }}', { present: 'actual' });
    }),
    bench('length filter — array', () => {
      processTwig('{{ items | length }}', { items: [1, 2, 3, 4, 5] });
    }),
    bench('join filter', () => {
      processTwig('{{ items | join(", ") }}', { items: ['a', 'b', 'c', 'd', 'e'] });
    }),
    bench('slice filter', () => {
      processTwig('{{ items | slice(0, 3) | join(", ") }}', { items: ['a', 'b', 'c', 'd', 'e'] });
    })
  );
});
// ── New: large context (1000 keys) ───────────────────────────────────────────
test('large context (1000 keys)', async ({ bench }) => {
  const hugeCtx: Record<string, unknown> = {};
  for (let i = 0; i < 1000; i++) {
    hugeCtx[`key${i}`] = `val${i}`;
  }
  hugeCtx.user = { profile: { name: 'Alice', address: { city: 'Madrid' } } };

  await bench.compare(
    bench('shallow lookup (key500)', () => {
      processTwig('{{ key500 }}', hugeCtx);
    }),
    bench('deep path (4 levels)', () => {
      processTwig('{{ user.profile.name }}', hugeCtx);
    }),
    bench('deep path (6 levels)', () => {
      processTwig('{{ user.profile.address.city }}', hugeCtx);
    }),
    bench('multiple shallow lookups', () => {
      processTwig('{{ key0 }} {{ key100 }} {{ key200 }} {{ key300 }} {{ key400 }}', hugeCtx);
    })
  );
});
// ── New: string-heavy templates ───────────────────────────────────────────────
test('string-heavy templates', async ({ bench }) => {
  const longText = 'Lorem ipsum dolor sit amet. '.repeat(100);
  const longTextWithToken = `${longText}{{ name }}`;
  const longHtmlNoTokens = '<div>' + '<p>paragraph</p>'.repeat(50) + '</div>';
  const longHtmlWithTokens = '<div>' + '<p>{{ title }}</p>'.repeat(20) + '</div>';

  await bench.compare(
    bench('long text, no tokens (5KB)', () => {
      processTwig(longText, {});
    }),
    bench('long text + single token at end', () => {
      processTwig(longTextWithToken, { name: 'Alice' });
    }),
    bench('long HTML, no tokens (2KB)', () => {
      processTwig(longHtmlNoTokens, {});
    }),
    bench('long HTML + 20 tokens', () => {
      processTwig(longHtmlWithTokens, { title: 'Hello' });
    })
  );
});
// ── New: for loop with key-value iteration ────────────────────────────────────
test('for loop key-value', async ({ bench }) => {
  const kvCtx = {
    data: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`key${i}`, `value${i}`]))
  };

  await bench.compare(
    bench('key-value for loop (20 entries)', () => {
      processTwig('{% for k, v in data %}{{ k }}={{ v }} {% endfor %}', kvCtx);
    }),
    bench('array for loop (20 items)', () => {
      processTwig('{% for item in items %}{{ item }} {% endfor %}', {
        items: Array.from({ length: 20 }, (_, i) => `item${i}`)
      });
    })
  );
});
// ── New: range function ──────────────────────────────────────────────────────
test('range function', async ({ bench }) => {
  await bench.compare(
    bench('range(10) + for loop', () => {
      processTwig('{% for i in range(10) %}{{ i }} {% endfor %}', {});
    }),
    bench('range(1, 10, 2) + for loop', () => {
      processTwig('{% for i in range(1, 10, 2) %}{{ i }} {% endfor %}', {});
    }),
    bench('range literal syntax 1..10', () => {
      processTwig('{% for i in 1..10 %}{{ i }} {% endfor %}', {});
    })
  );
});
test('break / continue', async ({ bench }) => {
  await bench.compare(
    bench('break at item 50 (100 items)', () => {
      processTwig(breakTemplate, breakCtx);
    }),
    bench('continue skip even (100 items)', () => {
      processTwig(continueTemplate, continueCtx);
    }),
    bench('break in nested loop', () => {
      processTwig(
        '{% for a in outer %}{% for b in items %}{% if b == 50 %}{% break %}{% endif %}{{ b }}{% endfor %}{% endfor %}',
        { outer: [1, 2, 3], items: Array.from({ length: 100 }, (_, i) => i) }
      );
    })
  );
});
test('apply tag variants', async ({ bench }) => {
  await bench.compare(
    bench('single apply (upper)', () => {
      processTwig(applyUpper, {});
    }),
    bench('chained apply (3 filters)', () => {
      processTwig(applyChained, {});
    }),
    bench('apply in 8-item loop', () => {
      processTwig(applyInLoopBench, applyInLoopBenchCtx);
    })
  );
});
test('nested ternary expressions', async ({ bench }) => {
  await bench.compare(
    bench('nested ternary (3-deep, var resolution)', () => {
      processTwig(nestedTernaryVar, { score: 85 });
    }),
    bench('simple ternary with arithmetic', () => {
      processTwig('{{ x > 0 ? x * 2 : 0 }}', { x: 5 });
    })
  );
});
// ── New: object iteration ────────────────────────────────────────────────────
test('object iteration', async ({ bench }) => {
  const obj20 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, `v${i}`]));
  const obj100 = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, `v${i}`]));

  await bench.compare(
    bench('for key, value in object (20 entries)', () => {
      processTwig('{% for k, v in obj %}{{ k }}={{ v }} {% endfor %}', { obj: obj20 });
    }),
    bench('for key, value in object (100 entries)', () => {
      processTwig('{% for k, v in obj %}{{ k }}={{ v }} {% endfor %}', { obj: obj100 });
    }),
    bench('for value in object values (20 entries)', () => {
      processTwig('{% for v in obj %}{{ v }} {% endfor %}', { obj: obj20 });
    })
  );
});
for (let i = 0; i < 20; i++) {
  sequentialSmallIfsCtx[`a${i}`] = i % 3 === 0;
}
for (let i = 0; i < 200; i++) {
  largeContextCtx[`key${i}`] = `val${i}`;
}
largeContextCtx.deep = { nested: { value: 'found' } };
