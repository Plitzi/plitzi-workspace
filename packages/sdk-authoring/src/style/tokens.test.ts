import { describe, expect, expectTypeOf, it } from 'vitest';

import { authorSpace, styles, text } from '../index';
import { tokens } from './tokens';

import type { SpaceSpec } from '../schema';

const variables = {
  color: { surface: { light: '#ffffff', dark: '#0f172a', default: '#ffffff' } },
  spacing: { gutter: '24px' }
} satisfies SpaceSpec['variables'];

describe('tokens', () => {
  const t = tokens(variables);

  it('is each variable as the value a rule writes', () => {
    expect(t).toEqual({ surface: 'var(--surface)', gutter: 'var(--gutter)' });
    expectTypeOf(t.surface).toEqualTypeOf<'var(--surface)'>();
  });

  it('makes a name the space does not declare a type error', () => {
    // @ts-expect-error -- `surfce` is not a variable of the space.
    expect(t.surfce).toBeUndefined();
  });

  it('writes what the space then reads without a warning', () => {
    const card = styles('card', { backgroundColor: t.surface, padding: t.gutter });
    const space = authorSpace({
      name: 'Tokens',
      permanentUrl: 'tokens',
      variables,
      classes: { card },
      pages: [{ id: 'home', name: 'Home', slug: '', body: [text('Hi', { class: card })] }]
    });

    expect(space.warnings.map(warning => warning.code)).not.toContain('unknown-variable');
  });

  it('leaves a name written by hand to the linter, which warns of one nothing declares', () => {
    const card = styles('card', { backgroundColor: 'var(--surfce)' });
    const space = authorSpace({
      name: 'Tokens',
      permanentUrl: 'tokens',
      variables,
      classes: { card },
      pages: [{ id: 'home', name: 'Home', slug: '', body: [text('Hi', { class: card })] }]
    });

    expect(space.warnings).toContainEqual(expect.objectContaining({ code: 'unknown-variable' }));
  });
});
