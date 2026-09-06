import type { Server } from '@plitzi/sdk-shared';

/**
 * Where the canvas and the panels address an uploaded face from.
 *
 * What the deployment declared, and otherwise the page server's own `/fonts` — which is where a self-hosted
 * server keeps them. Guessing is confined to this one function so the canvas and the editor cannot disagree about
 * which origin a font came from.
 */
export const fontsBaseUrl = (server: Pick<Server, 'fontsBaseUrl' | 'ssrServer'>): string | undefined =>
  server.fontsBaseUrl || (server.ssrServer ? `${server.ssrServer}/fonts` : undefined);
