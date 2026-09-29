import net from 'node:net';

import type { Dispatcher } from 'undici';

type HeaderValue = string | number | string[] | undefined;

/** Headers as a dispatch carries them — a record, name/value pairs flattened into one list, or pairs — plus one more. */
const withHeader = (
  headers: Dispatcher.DispatchOptions['headers'],
  name: string,
  value: string
): Record<string, HeaderValue> => {
  const entries: [string, HeaderValue][] = [];
  if (Array.isArray(headers)) {
    for (let index = 0; index < headers.length; index += 2) {
      entries.push([headers[index], headers[index + 1]]);
    }
  } else if (headers && Symbol.iterator in headers) {
    entries.push(...headers);
  } else if (headers) {
    entries.push(...Object.entries(headers));
  }

  return { ...Object.fromEntries(entries), [name]: value };
};

/**
 * The space's own public address, reached from inside the network this runtime runs in: every request this process
 * makes to the space's host — `fetch` and `WebSocket` alike, which share Node's dispatcher — connects to `insideUrl`
 * instead, over plain HTTP, the space's host and the public protocol kept (`X-Forwarded-Proto`). It is the path a
 * request takes once past the edge, without leaving to come back through it; the space's code keeps writing its public
 * address, and nothing else it reaches changes.
 *
 * `undici` is imported here, when a runtime asks, and never with the module: loading the package installs a global
 * dispatcher of its own, and this entry is loaded by the platform's page server too (`createRuntimeProxyStage`), whose
 * every `fetch` must stay Node's.
 */
export const reachSpaceInside = async ({ publicUrl, insideUrl }: { publicUrl: string; insideUrl: string }) => {
  const outside = new URL(publicUrl);
  const inside = new URL(insideUrl);
  if (inside.protocol !== 'http:') {
    throw new Error(`A space is reached from inside over plain HTTP, not ${inside.protocol} (${insideUrl})`);
  }

  const { Agent, buildConnector, setGlobalDispatcher } = await import('undici');
  const port = Number(inside.port || 80);
  const protocol = outside.protocol.replace(':', '');
  const connect = buildConnector({});
  const agent = new Agent({
    connect: (options, callback) => {
      if (options.hostname !== outside.hostname) {
        connect(options, callback);

        return;
      }

      const socket = net.connect(port, inside.hostname);
      socket.once('connect', () => callback(null, socket));
      socket.once('error', error => callback(error, null));
    }
  }).compose(
    dispatch => (options, handler) =>
      dispatch(
        new URL(String(options.origin)).hostname === outside.hostname
          ? { ...options, headers: withHeader(options.headers, 'x-forwarded-proto', protocol) }
          : options,
        handler
      )
  );
  setGlobalDispatcher(agent);
};
