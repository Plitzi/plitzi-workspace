import { test } from 'vitest';

import { processTwig } from './processTwig';
import { largeContextCtx, sequentialSmallIfsCtx } from './tests/bench';

// ── Benchmarks ──────────────────────────────────────────────────────────────
// ── New: set with expression evaluation ──────────────────────────────────────
const setArithmetic = '{% set x = a + b * c - d %}{{ x }}';
const setConcat = '{% set s = a ~ " " ~ b ~ " " ~ c %}{{ s }}';
const setNested = '{% set a = 1 %}{% set b = a + 1 %}{% set c = b + 1 %}{% set d = c + 1 %}{{ d }}';
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

test('set with expression evaluation', async ({ bench }) => {
  await bench.compare(
    bench('set with arithmetic (4 vars)', () => {
      processTwig(setArithmetic, { a: 10, b: 3, c: 2, d: 5 });
    }),
    bench('set with concat (3 vars)', () => {
      processTwig(setConcat, { a: 'hello', b: 'world', c: '!' });
    }),
    bench('4 chained sets with dependency', () => {
      processTwig(setNested, {});
    })
  );
});
// ── New: complex and/or/not conditions ───────────────────────────────────────
test('complex logical conditions', async ({ bench }) => {
  await bench.compare(
    bench('3-way and with not', () => {
      processTwig('{% if a and not b and c %}yes{% endif %}', { a: true, b: false, c: true });
    }),
    bench('mixed and/or with comparisons', () => {
      processTwig('{% if (x > 0 and x < 100) or (y == "special") %}yes{% endif %}', { x: 50, y: 'normal' });
    }),
    bench('nested not in + and', () => {
      processTwig('{% if "admin" not in roles and active %}yes{% endif %}', {
        roles: ['viewer', 'editor'],
        active: true
      });
    })
  );
});
// ── New: loop metadata ───────────────────────────────────────────────────────
test('loop metadata access', async ({ bench }) => {
  await bench.compare(
    bench('loop.index + loop.index0 (100 items)', () => {
      processTwig('{% for i in items %}{{ loop.index }}:{{ loop.index0 }} {% endfor %}', {
        items: Array.from({ length: 100 }, (_, i) => i)
      });
    }),
    bench('loop.first + loop.last (100 items)', () => {
      processTwig('{% for i in items %}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}{% endfor %}', {
        items: Array.from({ length: 100 }, (_, i) => i)
      });
    }),
    bench('loop.revindex (100 items)', () => {
      processTwig('{% for i in items %}{{ loop.revindex }} {% endfor %}', {
        items: Array.from({ length: 100 }, (_, i) => i)
      });
    })
  );
});
// ── New: empty / trivial loop / if ──────────────────────────────────────────
test('empty loop and if bodies', async ({ bench }) => {
  await bench.compare(
    bench('for with empty body (100 items)', () => {
      processTwig('{% for i in items %}{% endfor %}', { items: Array.from({ length: 100 }, (_, i) => i) });
    }),
    bench('if true with empty body', () => {
      processTwig('{% if active %}{% endif %}', { active: true });
    }),
    bench('for with else branch (empty array)', () => {
      processTwig('{% for i in items %}X{% else %}empty{% endfor %}', { items: [] as number[] });
    })
  );
});
// ── New: deep path resolution with large context ─────────────────────────────
test('deep path with large context', async ({ bench }) => {
  const hugeCtx: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) {
    hugeCtx[`k${i}`] = `v${i}`;
  }
  hugeCtx.user = { profile: { settings: { theme: 'dark', lang: 'en', notifications: { email: true } } } };

  await bench.compare(
    bench('3-level deep path (500-key context)', () => {
      processTwig('{{ user.profile.settings }}', hugeCtx);
    }),
    bench('4-level deep path (500-key context)', () => {
      processTwig('{{ user.profile.settings.theme }}', hugeCtx);
    }),
    bench('5-level deep path (500-key context)', () => {
      processTwig('{{ user.profile.settings.notifications.email }}', hugeCtx);
    })
  );
});
// ── New: filter stress ──────────────────────────────────────────────────────
test('filter stress', async ({ bench }) => {
  await bench.compare(
    bench('column + join (20 items)', () => {
      processTwig('{{ items | column("name") | join(", ") }}', {
        items: Array.from({ length: 20 }, (_, i) => ({ name: `Item${i}` }))
      });
    }),
    bench('sort + join (20 items)', () => {
      processTwig('{{ items | sort | join(", ") }}', {
        items: ['z', 'm', 'a', 'k', 'b', 'y', 'c', 'x', 'd', 'w', 'e', 'v', 'f', 'u', 'g', 't', 'h', 's', 'i', 'r']
      });
    }),
    bench('batch + loop (20 items, batch 5)', () => {
      processTwig('{% for batch in items | batch(5) %}[{{ batch | join(",") }}]{% endfor %}', {
        items: Array.from({ length: 20 }, (_, i) => i)
      });
    }),
    bench('filter chain: split + map + join', () => {
      processTwig('{{ data | split(",") | join(" | ") }}', { data: 'a,b,c,d,e,f,g,h' });
    })
  );
});
// ── New: range variants ──────────────────────────────────────────────────────
test('range variants', async ({ bench }) => {
  await bench.compare(
    bench('range(50) + for loop', () => {
      processTwig('{% for i in range(50) %}{{ i }} {% endfor %}', {});
    }),
    bench('range(0, 100, 3) + for loop', () => {
      processTwig('{% for i in range(0, 100, 3) %}{{ i }} {% endfor %}', {});
    }),
    bench('literal range 1..20 + for', () => {
      processTwig('{% for i in 1..20 %}{{ i }} {% endfor %}', {});
    })
  );
});
// ── New: mixed set + for + filter pipeline ──────────────────────────────────
test('set + for + filter pipeline', async ({ bench }) => {
  await bench.compare(
    bench('set accumulator in loop (100 items)', () => {
      processTwig('{% set total = 0 %}{% for i in items %}{% set total = total + i %}{% endfor %}{{ total }}', {
        items: Array.from({ length: 100 }, (_, i) => i + 1)
      });
    }),
    bench('set string accumulator in loop (100 items)', () => {
      processTwig('{% set r = "" %}{% for i in items %}{% set r = r ~ i ~ "," %}{% endfor %}{{ r }}', {
        items: Array.from({ length: 100 }, (_, i) => i)
      });
    }),
    bench('set + filter pipeline (5 items)', () => {
      processTwig('{% set names = items | column("name") | sort | join(", ") %}{{ names }}', {
        items: [{ name: 'Z' }, { name: 'A' }, { name: 'M' }, { name: 'B' }, { name: 'K' }]
      });
    })
  );
});
test('mega deep template', async ({ bench }) => {
  await bench('200 products: set + for + if + filters + number_format', () => {
    processTwig(megaDeepTemplate, megaDeepCtx);
  }).run();
});
test('nested if/for interactions', async ({ bench }) => {
  const usersCtx = {
    users: Array.from({ length: 10 }, (_, i) => ({
      name: `User${i}`,
      role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'editor' : 'viewer',
      active: i % 2 === 0
    }))
  };

  await bench.compare(
    bench('for + nested if (3 branches, 10 users)', () => {
      processTwig(
        '{% for u in users %}{% if u.role == "admin" %}A{% elseif u.role == "editor" %}E{% else %}V{% endif %}{% endfor %}',
        usersCtx
      );
    }),
    bench('for + nested for (3×3)', () => {
      processTwig('{% for r in rows %}{% for c in cols %}{{ r }}-{{ c }} {% endfor %}{% endfor %}', {
        rows: ['A', 'B', 'C'],
        cols: ['1', '2', '3']
      });
    }),
    bench('for + if guard + set accumulator', () => {
      processTwig(
        '{% set total = 0 %}{% for u in users %}{% if u.active %}{% set total = total + 1 %}{% endif %}{% endfor %}{{ total }}',
        usersCtx
      );
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
