import { describe, expect, it } from 'vitest';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import { defineAction } from './index';

import type { ActionSpec } from './index';
import type { ElementInteraction } from '@plitzi/sdk-shared';

const minimal = (over: Partial<ActionSpec> = {}): ActionSpec => ({
  id: 'quote',
  name: 'Quote',
  trigger: { type: 'call', access: 'public', input: { city: { type: 'text', required: true } } },
  steps: [{ id: 'rate', task: 'example.rate' }],
  ...over
});

const nodesOf = (spec: ActionSpec): Record<string, ElementInteraction> => defineAction(spec).document.nodes;

describe('defineAction', () => {
  it('chains the steps it was given, in order', () => {
    const nodes = nodesOf(minimal());

    expect(Object.keys(nodes)).toEqual(['start', 'rate', 'answer']);
    expect([nodes.start.beforeNode, nodes.start.afterNode]).toEqual(['', 'rate']);
    expect([nodes.rate.beforeNode, nodes.rate.afterNode]).toEqual(['start', 'answer']);
    expect([nodes.answer.beforeNode, nodes.answer.afterNode]).toEqual(['rate', '']);
    expect(new Set(Object.values(nodes).map(node => node.flowId))).toEqual(new Set(['start']));
  });

  /**
   * The duplication this removes, and the reason it is worth removing: the contract and the step that consumes it
   * are the same list of names written twice. A field added to one and not the other is invisible from both ends
   * — the caller's value passes validation, is dropped before the task runs, and the task sees nothing.
   */
  it('passes the declared input through to a step that names no params', () => {
    const nodes = nodesOf(
      minimal({
        trigger: {
          type: 'call',
          access: 'public',
          input: { city: { type: 'text', required: true }, weightKg: { type: 'number', defaultValue: 1 } }
        }
      })
    );

    expect(nodes.rate.params).toEqual({ city: '{{input.city}}', weightKg: '{{input.weightKg}}' });
  });

  it('leaves a step that names its own params alone', () => {
    const nodes = nodesOf(minimal({ steps: [{ id: 'rate', task: 'example.rate', params: { ratePerKg: 4 } }] }));

    expect(nodes.rate.params).toEqual({ ratePerKg: 4 });
  });

  it('answers with the last step when no output was named', () => {
    expect(nodesOf(minimal()).answer.params).toEqual({ values: '{{ rate }}' });
  });

  it('answers with the template it was given', () => {
    const nodes = nodesOf(minimal({ output: '{"total": {{ rate.total }}}' }));

    expect(nodes.answer.params).toEqual({ values: '{"total": {{ rate.total }}}' });
  });

  it('writes the typed access as the flat pair the runtime reads back', () => {
    const nodes = nodesOf(
      minimal({ trigger: { type: 'call', access: { mode: 'role', permissions: ['postPublish', 'postEdit'] } } })
    );

    expect(nodes.start.params).toMatchObject({ access: 'role', permissions: 'postPublish,postEdit' });
  });

  it('writes the input contract as the JSON the trigger stores', () => {
    expect(nodesOf(minimal()).start.params.input).toBe('{"city":{"type":"text","required":true}}');
  });

  it('names each way in after its kind when there is more than one', () => {
    const nodes = nodesOf(
      minimal({
        trigger: [
          { type: 'call', access: 'public', input: { city: { type: 'text' } } },
          { type: 'webhook', access: 'public', input: { city: { type: 'text' } }, verify: { credential: 'stripe' } }
        ]
      })
    );

    expect(Object.keys(nodes)).toEqual(['call', 'webhook', 'rate', 'answer']);
    expect(nodes.webhook.params).toMatchObject({ signatureCredential: 'stripe' });
  });

  /**
   * The node map is keyed by id, so a repeated one does not add a step — it REPLACES one, and the flow that runs
   * is shorter than the one that was written with nothing saying so.
   */
  it('refuses two steps under one id', () => {
    expect(() =>
      defineAction(
        minimal({
          steps: [
            { id: 'rate', task: 'a' },
            { id: 'rate', task: 'b' }
          ]
        })
      )
    ).toThrow(/names the step "rate" twice/);
  });

  it('refuses a step that would collide with the way in, or with the answer', () => {
    expect(() => defineAction(minimal({ steps: [{ id: 'start', task: 'a' }] }))).toThrow(/"start" twice/);
    expect(() => defineAction(minimal({ steps: [{ id: 'answer', task: 'a' }] }))).toThrow(/"answer" twice/);
  });

  /** Two ways in taking different things have no single right answer to pass through, so it says so. */
  it('refuses to guess a passthrough when the ways in declare different inputs', () => {
    expect(() =>
      defineAction(
        minimal({
          trigger: [
            { type: 'call', access: 'public', input: { city: { type: 'text' } } },
            { type: 'webhook', access: 'public', input: { event: { type: 'text' } } }
          ]
        })
      )
    ).toThrow(/different inputs/);
  });

  it('refuses an action with no way in and one with no steps', () => {
    expect(() => defineAction(minimal({ trigger: [] }))).toThrow(/no way in/);
    expect(() => defineAction(minimal({ steps: [] }))).toThrow(/no steps/);
  });

  /**
   * The gate everything else goes through, and the point of writing the document from a declaration: what this
   * produces has to pass the validator the builder and the runner share, not merely typecheck here.
   */
  it('produces a document the shared validator accepts', () => {
    const specs: ActionSpec[] = [
      minimal(),
      minimal({ trigger: { type: 'schedule', cron: '0 9 * * 1-5' } }),
      minimal({ trigger: { type: 'custom', access: 'public', name: 'queue' } }),
      minimal({
        trigger: { type: 'webhook', access: 'public', verify: { credential: 'stripe' } },
        steps: [{ id: 'count', task: 'kv.increment', params: { key: 'a', amount: '1' } }],
        output: '{"seen": {{ count.value }}}'
      })
    ];

    for (const spec of specs) {
      const report = validateActionDocument(defineAction(spec).document);

      expect(report.errors).toEqual([]);
      expect(report.valid).toBe(true);
    }
  });

  it('carries the schedule and custom fields each kind needs', () => {
    expect(nodesOf(minimal({ trigger: { type: 'schedule', cron: '0 9 * * 1-5' } })).start.params).toMatchObject({
      cron: '0 9 * * 1-5'
    });
    expect(
      nodesOf(minimal({ trigger: { type: 'custom', access: 'public', name: 'queue' } })).start.params
    ).toMatchObject({ name: 'queue' });
    expect(
      nodesOf(minimal({ trigger: { type: 'render', access: 'public', cacheSeconds: 30 } })).start.params
    ).toMatchObject({ cacheSeconds: '30' });
  });
});
