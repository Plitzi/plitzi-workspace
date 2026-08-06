import { describe, expect, it } from 'vitest';

import { createMcpLog } from './log';

import type { McpResourceLogEvent, McpToolLogEvent, ServerLogEvent } from '@plitzi/sdk-shared';

// The MCP sink emits only tool and resource events (requests come from the dispatcher); narrowing here keeps the
// assertions typed against the shape under test.
const firstTool = (events: ServerLogEvent[]): McpToolLogEvent => {
  const [event] = events;
  if (event.kind !== 'tool') {
    throw new Error(`expected a tool event, got ${event.kind}`);
  }

  return event;
};

const firstResource = (events: ServerLogEvent[]): McpResourceLogEvent => {
  const [event] = events;
  if (event.kind !== 'resource') {
    throw new Error(`expected a resource event, got ${event.kind}`);
  }

  return event;
};

describe('createMcpLog', () => {
  it('emits a structured tool event to the injected logger', () => {
    const events: ServerLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.toolCall('plitzi_apply', { operations: [{ type: 'patchElement' }] }, 12.4);

    expect(events).toHaveLength(1);
    const event = firstTool(events);
    expect(event.name).toBe('plitzi_apply');
    expect(event.ok).toBe(true);
    expect(event.argsSummary).toBe('{operations:[1]}');
    expect(event.error).toBeUndefined();
    expect(typeof event.timestamp).toBe('string');
  });

  it('summarises tool args by shape, never by value', () => {
    const events: ServerLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.toolCall('plitzi_apply', { email: 'ada@example.com', count: 2, nested: { deep: { secret: 'x' } } }, 1);

    expect(firstTool(events).argsSummary).toBe('{email:string,count:number,nested:{deep:{…}}}');
    expect(firstTool(events).argsSummary).not.toContain('ada@example.com');
  });

  it('marks a failed tool call and carries the error message', () => {
    const events: ServerLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.toolCall('plitzi_search', { query: 'x' }, 3, new Error('boom'));

    expect(firstTool(events).ok).toBe(false);
    expect(firstTool(events).error).toBe('boom');
  });

  it('emits a resource event with the uri as name', () => {
    const events: ServerLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.resourceRead('plitzi://primer/main', 8);

    expect(firstResource(events).name).toBe('plitzi://primer/main');
    expect(firstResource(events).ok).toBe(true);
  });

  it('is inert (no throw, no logger calls) when no logger is set and MCP_DEBUG is off', () => {
    const log = createMcpLog(undefined);
    expect(() => log.toolCall('plitzi_read', { uris: [] }, 1)).not.toThrow();
    expect(() => log.resourceRead('plitzi://guide', 1)).not.toThrow();
  });
});
