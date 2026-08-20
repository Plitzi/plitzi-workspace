import { describe, expect, it } from 'vitest';

import { validateActionDocument } from './validateDocument';

const document = (overrides: Record<string, unknown> = {}) => ({
  name: 'Send quote',
  enabled: true,
  access: { mode: 'session' },
  triggers: [{ type: 'call' }],
  input: { amount: { type: 'number', required: true } },
  output: { total: { type: 'number' } },
  nodes: {
    start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'ret' },
    ret: { id: 'ret', type: 'task', action: 'flow.return', params: { values: '{}' } }
  },
  ...overrides
});

const messages = (issues: { message: string }[]) => issues.map(issue => issue.message).join(' | ');

describe('validateActionDocument', () => {
  it('accepts a document the runner can execute', () => {
    const report = validateActionDocument(document());

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('refuses anything that is not a document', () => {
    expect(validateActionDocument(undefined).valid).toBe(false);
    expect(validateActionDocument('nope').valid).toBe(false);
    expect(validateActionDocument([]).valid).toBe(false);
  });

  it('requires access to be declared rather than guessed', () => {
    const report = validateActionDocument(document({ access: undefined }));

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('must declare a mode');
  });

  it('requires role access to name permissions', () => {
    const report = validateActionDocument(document({ access: { mode: 'role', permissions: [] } }));

    expect(messages(report.errors)).toContain('at least one permission');
  });

  // The rule the whole validator exists for: a client step in a server flow is shaped correctly and can never run.
  it('refuses a browser step inside a server flow', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'set' },
          set: { id: 'set', type: 'globalCallback', action: 'setState' }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('cannot run on the server');
  });

  it('refuses a flow with no entry, and one with several', () => {
    expect(messages(validateActionDocument(document({ nodes: {} })).errors)).toContain('no trigger step');

    const two = document({
      nodes: {
        a: { id: 'a', type: 'trigger', action: 'call' },
        b: { id: 'b', type: 'trigger', action: 'webhook' }
      }
    });
    expect(messages(validateActionDocument(two).errors)).toContain('2 trigger steps');
  });

  it('refuses a step pointing at one that does not exist', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'ret' },
          ret: { id: 'ret', type: 'task', action: 'flow.return', afterNode: 'ghost' }
        }
      })
    );

    expect(messages(report.errors)).toContain('not a step here');
  });

  it('refuses a task name that is not <namespace>.<action>', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'x' },
          x: { id: 'x', type: 'task', action: 'sendEmail' }
        }
      })
    );

    expect(messages(report.errors)).toContain('<namespace>.<action>');
  });

  it('warns about a webhook anyone can call unsigned', () => {
    const report = validateActionDocument(document({ triggers: [{ type: 'webhook' }] }));

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('unsigned requests');
  });

  it('warns when output is declared but nothing returns it', () => {
    const report = validateActionDocument(
      document({
        nodes: { start: { id: 'start', type: 'trigger', action: 'call' } }
      })
    );

    expect(messages(report.warnings)).toContain('no step returns anything');
  });

  it('warns about a connector step naming a connector the document does not declare', () => {
    const report = validateActionDocument(
      document({
        connectors: ['cms'],
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'read' },
          read: { id: 'read', type: 'task', action: 'connector.read', params: { connector: 'crm' } }
        }
      })
    );

    expect(messages(report.warnings)).toContain('not listed in this action');
  });

  it('warns about a credential token in a step that never asked for one', () => {
    const report = validateActionDocument(
      document({
        credentials: ['stripe'],
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'call' },
          call: {
            id: 'call',
            type: 'task',
            action: 'http.request',
            params: {
              url: 'https://api.stripe.com',
              headers: '{"Authorization": "Bearer {{ credential.stripe.key }}"}'
            }
          }
        }
      })
    );

    expect(messages(report.warnings)).toContain('resolves to nothing');
  });

  it('says nothing when the step names the credential it reads', () => {
    const report = validateActionDocument(
      document({
        credentials: ['stripe'],
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'call' },
          call: {
            id: 'call',
            type: 'task',
            action: 'http.request',
            params: {
              url: 'https://api.stripe.com',
              credential: 'stripe',
              headers: '{"Authorization": "Bearer {{ credential.key }}"}'
            }
          }
        }
      })
    );

    expect(report.warnings.filter(issue => issue.message.includes('resolves to nothing'))).toEqual([]);
  });

  it('says nothing about a connector chosen at run time', () => {
    const report = validateActionDocument(
      document({
        connectors: ['cms'],
        nodes: {
          start: { id: 'start', type: 'trigger', action: 'call', afterNode: 'read' },
          read: { id: 'read', type: 'task', action: 'connector.read', params: { connector: '{{ input.target }}' } }
        }
      })
    );

    expect(report.warnings.filter(issue => issue.path.includes('connector'))).toEqual([]);
  });
});
