import { describeTarget, expect, test } from '../../fixtures';

import type { Page } from '@playwright/test';

/** Pizarra as a cluster: three replicas over one Redis, behind a balancer that sends every request and every socket to
 *  the next one. The README promises that the people on a board may be on any of them, and so may an agent's every
 *  call — this is that promise, with a person pinned to each of two replicas and an agent going through the
 *  balancer the way anyone's agent would. */

/** A replica's own address, past the balancer: `REPLICA_PORT=5020` puts them at 5021, 5022 and 5023. */
const replica = (index: 1 | 2 | 3): string => `http://127.0.0.1:${5020 + index}`;

const action = async (origin: string, actionId: string, input: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(new URL('/_action', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, input })
  });
  const body = (await response.json()) as { output?: unknown };

  return body.output;
};

type ToolResult = { content?: { type: string; text?: string }[]; isError?: boolean };

/** An MCP client in a few lines of JSON-RPC over HTTP — what an agent's app sends to `/mcp` — that notes which replica
 *  answered each call. */
const agentAt = async (origin: string) => {
  let session = '';
  let id = 0;
  const replicas = new Set<string>();
  const rpc = async (method: string, params: object, notification = false): Promise<unknown> => {
    const response = await fetch(new URL('/mcp', origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {})
      },
      body: JSON.stringify(
        notification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params }
      )
    });
    session = response.headers.get('mcp-session-id') ?? session;
    replicas.add(response.headers.get('x-pizarra-replica') ?? '');
    if (notification) {
      return undefined;
    }

    expect(response.status, `${method} answered ${response.status}`).toBe(200);
    // An event stream, as the endpoint answers: the answer is the `data:` of its message.
    const stream = await response.text();
    const data = stream
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice('data: '.length)) as { id?: number; result?: unknown })
      .find(message => message.id === id);

    return data?.result;
  };

  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'claude-code', version: 'e2e' }
  });
  await rpc('notifications/initialized', {}, true);

  return {
    replicas,
    call: async (name: string, args: Record<string, unknown> = {}): Promise<string> => {
      const result = (await rpc('tools/call', { name, arguments: args })) as ToolResult;
      const text = (result.content ?? []).map(part => part.text ?? '').join('\n');
      expect(result.isError, `${name}: ${text}`).toBeFalsy();

      return text;
    }
  };
};

const chatLines = (page: Page) => page.locator('[data-id="chat"] li');

const say = async (page: Page, words: string): Promise<void> => {
  await page.locator('[data-id="chat-text"] input').fill(words);
  await page.keyboard.press('Enter');
};

describeTarget('whiteboard-replicas', subject => {
  test('people on two replicas and an agent through the balancer are on one board', async ({ browser }) => {
    const created = (await action(subject.origin, 'board-create', { title: 'e2e — replicas', template: 'blank' })) as {
      id: string;
    };
    const [ana, leo] = await Promise.all(
      [replica(1), replica(2)].map(async origin => {
        const page = await (await browser.newContext()).newPage();
        await page.goto(`${origin}/b/${created.id}`);
        await expect(page.locator('canvas').first()).toBeVisible();
        await page.locator('[data-id="chat-open"]').click();

        return page;
      })
    );

    // Said on one replica, heard on the other.
    await say(ana, 'Hello from the first replica');
    await expect(chatLines(leo)).toContainText(['Hello from the first replica']);

    // An agent, as anyone adds one: the balancer's `/mcp`, every call to whichever replica comes next.
    const agent = await agentAt(subject.origin);
    await agent.call('join_board', { link: `${subject.origin}/b/${created.id}` });
    await agent.call('add_elements', { elements: [{ type: 'sticky', text: 'From the agent', color: 'yellow' }] });
    await agent.call('say', { text: 'Hi from the agent' });
    await expect(chatLines(ana)).toContainText(['Hi from the agent']);
    await expect(chatLines(leo)).toContainText(['Hi from the agent']);

    // What it drew is the board's, whichever replica is asked.
    const board = (await (await fetch(`${replica(3)}/_rsc?location=/b/${created.id}&ids=board`)).json()) as {
      serverData: { board: { elements: { type: string; text?: string; deleted?: boolean }[] } };
    };
    expect(
      board.serverData.board.elements.filter(element => element.type === 'sticky' && !element.deleted).map(e => e.text)
    ).toEqual(['From the agent']);

    // And it hears the people, wherever they are: a line said on the second replica, while it waits — once what it
    // was already told (the two of them arriving) is out of the way.
    await agent.call('wait_for_activity', { seconds: 0 });
    const heard = agent.call('wait_for_activity', { seconds: 20 });
    await leo.waitForTimeout(500);
    await say(leo, 'Are you there, agent?');
    expect(await heard).toContain('Are you there, agent?');

    // Its session lives on one replica; the balancer spread its calls over more than one.
    expect(agent.replicas.size).toBeGreaterThan(1);
    await agent.call('leave_board');
  });
});
