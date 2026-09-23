import { describe, expect, it } from 'vitest';

import { templateProblem } from './templateProblem';

describe('templateProblem', () => {
  it('says nothing about plain text or a template the runtime reads', () => {
    expect(templateProblem('Hello')).toBeUndefined();
    expect(templateProblem('{{ source|upper }} min')).toBeUndefined();
    expect(templateProblem(42)).toBeUndefined();
  });

  it('names what the runtime would read past', () => {
    expect(templateProblem('{{ source matches "^A" }}')).toMatch(/^This template cannot be read as written — /);
    expect(templateProblem('{{ source|nofilter }}')).toContain('nofilter');
  });
});
