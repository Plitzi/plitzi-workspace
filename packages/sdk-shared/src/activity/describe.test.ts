import { describe, expect, it } from 'vitest';

import { activityLine } from './describe';

describe('activityLine', () => {
  it('says who changed the draft, through what, and the first thing the change did', () => {
    expect(
      activityLine({
        kind: 'change',
        at: 0,
        seq: 41,
        document: 'schema',
        author: { userId: 3, name: 'ana' },
        origin: 'builder',
        summary: 'Changed the content of text “hero”\nAdded button “cta” to “hero”',
        touched: ['hero', 'cta']
      })
    ).toBe('ana in the builder, schema #41: Changed the content of text “hero” (+1 more)');
  });

  it('names an agent by its application, for the member it writes for — never a builder tab by its id', () => {
    const change = {
      kind: 'change' as const,
      at: 0,
      seq: 3,
      document: 'schema' as const,
      author: { userId: 3, name: 'ana' },
      summary: 'Changed content of heading “hero”',
      touched: ['hero']
    };

    expect(activityLine({ ...change, origin: 'mcp', client: 'Claude' })).toBe(
      'Claude for ana over the MCP, schema #3: Changed content of heading “hero”'
    );
    expect(activityLine({ ...change, origin: 'builder', client: 'd31cac71' })).toBe(
      'ana in the builder, schema #3: Changed content of heading “hero”'
    );
  });

  it('names nobody as somebody, and a change with no summary as a change', () => {
    expect(
      activityLine({
        kind: 'change',
        at: 0,
        seq: 1,
        document: 'style',
        author: { userId: null, name: '' },
        origin: 'system',
        summary: '',
        touched: []
      })
    ).toBe('somebody by the platform, style #1: changed it');
  });

  it('says a publish in the words the space’s log has it', () => {
    expect(
      activityLine({
        kind: 'publish',
        at: 0,
        author: { userId: 3, name: 'ana' },
        what: 'deployment',
        environment: 'production',
        message: 'Space deployed to production environment by ana'
      })
    ).toBe('Space deployed to production environment by ana');
  });

  it('says why an action failed or was refused', () => {
    expect(
      activityLine({ kind: 'action', at: 0, actionId: 'signup', trigger: 'call', status: 'failed', error: 'SMTP down' })
    ).toBe('action signup (call) failed: SMTP down');
    expect(
      activityLine({
        kind: 'action',
        at: 0,
        actionId: 'hook',
        trigger: 'webhook',
        status: 'refused',
        reason: 'signature'
      })
    ).toBe('action hook (webhook) refused: signature');
  });
});
