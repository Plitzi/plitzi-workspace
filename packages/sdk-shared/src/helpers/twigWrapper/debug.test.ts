import { describe, it } from 'vitest';

import { processTwig } from './index';

describe('debug', () => {
  it('nested ternary standalone', () => {
    const result = processTwig('{{ x == 1 ? "one" : x == 2 ? "two" : "other" }}', { x: 2 });
    console.log('nested ternary standalone:', JSON.stringify(result));
  });

  it('nested ternary in arrow', () => {
    const result = processTwig('{{ items | map(x => x == 1 ? "one" : x == 2 ? "two" : "other") | join(", ") }}', {
      items: [1, 2, 3]
    });
    console.log('nested ternary arrow:', JSON.stringify(result));
  });

  it('unary minus', () => {
    const result = processTwig('{{ nums | map(n => -n) | join(", ") }}', { nums: [1, -2, 3] });
    console.log('unary minus:', JSON.stringify(result));
  });

  it('chained arithmetic', () => {
    const result = processTwig('{{ nums | map(n => n * 3 - 1 + 10 / 2) | join(", ") }}', { nums: [1, 2] });
    console.log('chained arithmetic:', JSON.stringify(result));
  });
});
