import { answerGraphQL } from './graphql';

import type { Page } from '@playwright/test';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export * from './graphql';

/** Answers the builder's backend calls in the browser, for the runs that have no backend to call.
 *
 *  Registered AFTER the offline-network stub so it wins: Playwright matches routes in reverse registration
 *  order, and the general "nothing leaves this machine" rule would otherwise abort these before they are seen. */
/** The graphql-ws handshake, answered so the client is acknowledged instead of left waiting. */
const messageType = (payload: string): string => {
  try {
    return (JSON.parse(payload) as { type?: string }).type ?? '';
  } catch {
    return '';
  }
};

/** WebSockets do not go through `page.route` — different protocol, different API — so the mock never covered the
 *  two the builder opens on boot: graphql-ws for subscriptions, and one for collaborator presence.
 *
 *  That was invisible on a laptop, where `server.plitzi.local` resolves and a real server answers, and red on
 *  every CI runner, where the name does not resolve and the browser reports each failed connection as a console
 *  error. Answered here, no connection is attempted at all.
 *
 *  Nothing is pretended to work beyond the handshake: a subscription is acknowledged and then silent, which is
 *  the truth — there is no server to publish anything. */
const mockSockets = async (page: Page): Promise<void> => {
  await page.routeWebSocket(
    url => /server\./.test(url.host),
    socket => {
      // No `connectToServer()`: there is nothing to connect to, and reaching for it is the failure being fixed.
      socket.onMessage(message => {
        const payload = typeof message === 'string' ? message : message.toString();

        if (messageType(payload) === 'connection_init') {
          socket.send(JSON.stringify({ type: 'connection_ack' }));
        }

        if (messageType(payload) === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      });
    }
  );
};

export const mockBackend = async (page: Page, space: OfflineDataRaw): Promise<void> => {
  await mockSockets(page);

  await page.route(
    url => url.pathname === '/' && /server\./.test(url.host),
    async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();

        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(answerGraphQL(route.request().postData(), space))
      });
    }
  );
};
