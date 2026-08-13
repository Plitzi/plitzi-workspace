import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { emptySpace } from '../helpers';
import { createMcpServer } from '../server';
import { claimSchemaId, registerSharedSchemaIds } from '../tools/operations/schemaIds';

const idCount = (): number => (z.globalRegistry as unknown as { _idmap: Map<string, unknown> })._idmap.size;

const adapters = {
  getSchema: () => Promise.resolve(emptySpace().schema),
  getStyle: () => Promise.resolve(emptySpace().style)
};

// The ids exist to collapse the op union in the ADVERTISED JSON Schema (~63k tokens per conversation). They are
// process configuration, so the thing to pin is that they behave like configuration: fixed at module load, equal
// on every replica, and never touched by a request — the MCP builds a server per request and stays stateless.
describe('shared schema ids (advertised schema dedup)', () => {
  it('does not grow the registry as servers are built per request', async () => {
    const before = idCount();
    for (let i = 0; i < 50; i += 1) {
      await createMcpServer({
        adapters,
        getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent' as const, canWrite: true })
      });
    }

    expect(idCount()).toBe(before);
  });

  it('is idempotent, so importing or calling it twice changes nothing', () => {
    const before = idCount();
    registerSharedSchemaIds();
    registerSharedSchemaIds();

    expect(idCount()).toBe(before);
  });

  it('yields the id rather than being silently renamed when something else claims it first', () => {
    // A foreign schema squats on an id BEFORE we register ours; zod's registry lets the last writer win.
    const squatter = z.object({ hostile: z.string() });
    z.globalRegistry.add(squatter, { id: 'Squatted' });
    const mine = z.object({ mine: z.string() });

    claimSchemaId(mine, 'Squatted');

    expect(z.globalRegistry.get(squatter)?.id).toBe('Squatted');
    expect(z.globalRegistry.get(mine)?.id).toBe('PlitziSquatted');
  });
});
