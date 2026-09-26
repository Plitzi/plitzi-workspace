import { describe, expect, it, vi } from 'vitest';

import { GLOBAL_SOURCES } from '@plitzi/sdk-authoring';

import { guideText } from '../helpers/guide';
import { registerResources } from '../resources';
import { registerRenderResources } from '../resources/renderGuide';
import { operation } from '../tools/operations';

import type { McpLog } from '../helpers/log';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** The guide is the agent's manual, and nothing but this file ties it to the server it describes. It drifted every way
 *  there is: operations nobody explained, resources nobody could find, globals that no longer exist. */

const ENV = 'main';

/** Every URI the server registers, written the way the guide writes them (`{env}` for the environment). */
const registeredUris = (): string[] => {
  const uris: string[] = [];
  // Only `registerResource` is called while registering; the rest of the server is never reached.
  const server = {
    registerResource: (_name: string, uri: string | { uriTemplate: { toString: () => string } }) => {
      uris.push(typeof uri === 'string' ? uri : uri.uriTemplate.toString());
    }
  } as unknown as McpServer;
  // Registering logs nothing; a read would, and none happens here.
  const log = {} as McpLog;

  // With the history adapter, so its resources are registered — and held to the guide — like every other.
  registerResources(server, vi.fn(), ENV, log, true, vi.fn());
  registerRenderResources(server, log);

  return uris.map(uri => uri.replaceAll(`/${ENV}`, '/{env}'));
};

describe('plitzi://guide', () => {
  it('explains every operation plitzi_apply accepts', () => {
    const types = operation.options.map(option => option.shape.type.value);
    const missing = types.filter(type => !guideText.includes(`\`${type}`));

    expect(missing).toEqual([]);
  });

  // A per-item template counts as named when its listing is: the guide writes `/{ref} for one` beside the list.
  it('names every resource the server registers', () => {
    const uris = registeredUris();
    const missing = uris.filter(uri => !guideText.includes(uri.replace(/\/\{[a-zA-Z]+\}$/u, '')));

    expect(uris.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it('lists the global sources the linter accepts, and no others', () => {
    for (const source of GLOBAL_SOURCES) {
      expect(guideText).toContain(`\`${source}\``);
    }

    expect(guideText).not.toMatch(/`collection`/u);
  });
});
