import { describe, it, expect } from 'vitest';

import { buildSpace, malformedSpace, spaceWithRoute, varOp } from './helpers';
import { operation, validate } from '../tools';

import type { Operation } from '../tools';

describe('mcp-ai validator (teaching errors)', () => {
  it('rejects camelCase CSS and suggests the kebab key', () => {
    const result = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { backgroundColor: '#000' } }] },
      buildSpace()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].hint).toContain('background-color');
  });

  it('rejects an unknown style-variable category with validValues', () => {
    const result = validate(
      {
        operations: [
          { type: 'upsertStyleVariable', category: 'typography', name: '--x', value: '1px' } as unknown as Operation
        ]
      },
      buildSpace()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].validValues).toEqual(['color', 'spacing', 'shadow', 'custom']);
  });

  it('rejects a non-existent pageRef with the list of valid refs', () => {
    const result = validate({ operations: [{ type: 'deleteElement', pageRef: 'ghost', ref: 'c1' }] }, buildSpace());
    expect(result.valid).toBe(false);
    expect(result.errors[0].validValues).toEqual(['home']);
  });
});

describe('mcp-ai variable-reference validation', () => {
  it('accepts a known space schema variable', () => {
    const r = validate({ operations: [varOp('home', 'text', '{{apiUrl}}/x')] }, buildSpace());
    expect(r.valid).toBe(true);
  });

  // An attribute reading a name nothing answers renders empty, and nothing anywhere says why: refused.
  it('refuses an unknown/hallucinated variable', () => {
    const r = validate({ operations: [varOp('home', 'text', '{{bogusVar}}')] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('"bogusVar"') && e.message.includes('nothing here answers'))).toBe(
      true
    );
  });

  it('accepts a page route param (from the slug) as a valid {{name}}', () => {
    const r = validate({ operations: [varOp('home', 'text', '{{apiUrl}}/spaces/{{spaceId}}')] }, spaceWithRoute());
    expect(r.valid).toBe(true);
  });

  it('accepts a variable the same batch declares', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertVariable', name: 'newVar', variableType: 'text', value: 'v' },
          varOp('home', 'text', '{{newVar}}')
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
  });

  it('skips {{...}} inside raw-code element types (no false positives on JSX)', () => {
    const r = validate(
      { operations: [varOp('home', 'blockJsx', 'style={{ position: "relative" }} {{bogusVar}}')] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
  });

  it('validates var(--token) in CSS values against the design tokens', () => {
    const known = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { color: 'var(--foreground)' } }] },
      buildSpace()
    );
    expect(known.warnings.some(w => w.includes('Unknown style variable'))).toBe(false);

    const unknown = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { color: 'var(--nope)' } }] },
      buildSpace()
    );
    expect(unknown.warnings.some(w => w.includes('Unknown style variable var(--nope)'))).toBe(true);
  });
});

describe('mcp-ai deep validation of when (RuleGroup) and transformers', () => {
  const withWhen = (when: unknown): unknown => ({
    type: 'upsertBinding',
    pageRef: 'home',
    ref: 'c1',
    category: 'attributes',
    binding: { to: 'items', source: 'api.data', when }
  });

  it('accepts a well-formed RuleGroup guard', () => {
    const when = { combinator: 'and', rules: [{ field: 'user.role', operator: '=', value: 'admin' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(true);
  });

  it('accepts nested groups', () => {
    const when = {
      combinator: 'or',
      rules: [
        { field: 'a', operator: 'notEmpty', value: '' },
        { combinator: 'and', rules: [{ field: 'b', operator: '=', value: 1 }] }
      ]
    };
    expect(operation.safeParse(withWhen(when)).success).toBe(true);
  });

  it('rejects an invalid combinator', () => {
    expect(operation.safeParse(withWhen({ combinator: 'xor', rules: [] })).success).toBe(false);
  });

  it('rejects an invalid operator', () => {
    const when = { combinator: 'and', rules: [{ field: 'a', operator: 'LIKE', value: 'x' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(false);
  });

  it('rejects a rule missing its field', () => {
    const when = { combinator: 'and', rules: [{ operator: '=', value: 'x' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(false);
  });

  it('rejects rules that are not an array', () => {
    expect(operation.safeParse(withWhen({ combinator: 'and', rules: {} })).success).toBe(false);
  });

  it('validates the same RuleGroup on an interaction step', () => {
    const flow = (when: unknown): unknown => ({
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'c1',
      nodes: [{ nodeType: 'trigger', action: 'onClick', title: 'Click', when }]
    });
    expect(operation.safeParse(flow({ combinator: 'and', rules: [] })).success).toBe(true);
    expect(operation.safeParse(flow({ combinator: 'nope', rules: [] })).success).toBe(false);
  });

  it('rejects a malformed transformer (params must be a string map)', () => {
    const op = {
      type: 'upsertBinding',
      pageRef: 'home',
      ref: 'c1',
      category: 'attributes',
      binding: { to: 'items', source: 'api.data', transformers: [{ action: 'toUpper', params: { x: 5 } }] }
    };
    expect(operation.safeParse(op).success).toBe(false);
  });

  it('rejects a transformer missing its action', () => {
    const op = {
      type: 'upsertBinding',
      pageRef: 'home',
      ref: 'c1',
      category: 'attributes',
      binding: { to: 'items', source: 'api.data', transformers: [{ params: {} }] }
    };
    expect(operation.safeParse(op).success).toBe(false);
  });
});

describe('mcp-ai pre-existing malformation audit (blocks save until fixed)', () => {
  it('blocks an unrelated valid edit while a touched element has a pre-existing malformed transformer', () => {
    const r = validate(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'txt', initialState: { visibility: true } }] },
      malformedSpace()
    );
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        e => e.message.includes('Pre-existing malformation in element "txt"') && e.message.includes('template')
      )
    ).toBe(true);
  });

  it('passes when the SAME batch fixes the pre-existing malformation', () => {
    const r = validate(
      {
        operations: [
          {
            type: 'patchBinding',
            pageRef: 'home',
            ref: 'txt',
            category: 'attributes',
            to: 'content',
            transformers: [{ action: 'twigTemplate', params: { template: '{{source}}' } }]
          }
        ]
      },
      malformedSpace()
    );
    expect(r.valid).toBe(true);
  });

  it('does not audit an element the batch never touches', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'unrelated', desktop: { color: 'red' } }] },
      malformedSpace()
    );
    expect(r.errors.some(e => e.message.includes('Pre-existing'))).toBe(false);
  });
});

describe('mcp-ai type-aware props (I5)', () => {
  it('refuses a prop a built-in type never reads', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c2', type: 'container', props: { bogusProp: 1 } } }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('"bogusProp"') && e.message.includes('never reads'))).toBe(true);
  });

  it('accepts a prop the type reads', () => {
    const r = validate(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'c2', type: 'container', props: { subType: 'section' } }
          }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
  });
});

describe('mcp-ai style on a provider with no tag', () => {
  const styled = (props: Record<string, unknown>): Operation[] => [
    { type: 'upsertDefinition', ref: 'stack', desktop: { display: 'flex', 'row-gap': '32px' } },
    {
      type: 'upsertElement',
      pageRef: 'home',
      element: { ref: 'feed', type: 'apiContainer', props, style: { base: ['stack'] } }
    }
  ];

  /** A provider with no tag renders its children and no element, so the gap written on it lands nowhere. */
  it('warns that the style of an untagged apiContainer applies to nothing', () => {
    const r = validate({ operations: styled({ query: 'https://api.example.com/x' }) }, buildSpace());

    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes('element "feed"') && w.includes('no `subType`'))).toBe(true);
  });

  it('says nothing once the provider has a tag', () => {
    const r = validate({ operations: styled({ query: 'https://api.example.com/x', subType: 'div' }) }, buildSpace());

    expect(r.warnings.some(w => w.includes('no `subType`'))).toBe(false);
  });
});
