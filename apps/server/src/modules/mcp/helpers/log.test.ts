import { describe, expect, it } from 'vitest';

import { createMcpLog } from './log';

import type { McpLogEvent } from '@plitzi/sdk-shared';

describe('createMcpLog', () => {
  it('emits a structured tool event to the injected logger', () => {
    const events: McpLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.toolCall('plitzi_apply', { operations: [{ type: 'patchElement' }] }, 12.4);

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.kind).toBe('tool');
    expect(event.name).toBe('plitzi_apply');
    expect(event.ok).toBe(true);
    expect(event.argsSummary).toContain('patchElement');
    expect(event.error).toBeUndefined();
    expect(typeof event.timestamp).toBe('string');
  });

  it('marks a failed tool call and carries the error message', () => {
    const events: McpLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.toolCall('plitzi_search', { query: 'x' }, 3, new Error('boom'));

    expect(events[0].ok).toBe(false);
    expect(events[0].error).toBe('boom');
  });

  it('emits a resource event with the uri as name', () => {
    const events: McpLogEvent[] = [];
    const log = createMcpLog(e => events.push(e));

    log.resourceRead('plitzi://primer/main', 8);

    expect(events[0].kind).toBe('resource');
    expect(events[0].name).toBe('plitzi://primer/main');
    expect(events[0].argsSummary).toBeUndefined();
  });

  it('is inert (no throw, no logger calls) when no logger is set and MCP_DEBUG is off', () => {
    const log = createMcpLog(undefined);
    expect(() => log.toolCall('plitzi_read', { uris: [] }, 1)).not.toThrow();
    expect(() => log.resourceRead('plitzi://guide', 1)).not.toThrow();
  });
});
