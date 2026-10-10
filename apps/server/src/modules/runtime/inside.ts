import { X509Certificate } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

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
 * How every OTHER host is reached once one of these dispatchers is the process's: as Node's own `fetch` reaches it,
 * over HTTP/1.1. An undici connector offers HTTP/2 by default, and an answer that came back over h2 reached Node's
 * `fetch` without its `content-encoding` — so nothing decoded it, and every API that compresses read as Brotli bytes.
 */
const elsewhere = (undici: typeof import('undici')) => undici.buildConnector({ allowH2: false });

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

  const undici = await import('undici');
  const { Agent, setGlobalDispatcher } = undici;
  const port = Number(inside.port || 80);
  const protocol = outside.protocol.replace(':', '');
  const connect = elsewhere(undici);
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

export type OwnServer = {
  /** Where people reach this server — the address its code writes and fetches. */
  publicUrl: string;
  /** Where this machine reaches it: the address and port it listens on. */
  listener: { host: string; port: number };
  /** The certificate it serves, PEM: the one a connection to it has to present to be taken as this server. */
  cert: string | Buffer;
};

/**
 * A self-hosted server serving TLS itself, reached from its own process — the runtime calling its own MCP, a function
 * calling a route of its own space: every request to its public address connects to its listener on this machine.
 *
 * Its certificate is usually a local one (mkcert, for a tablet on the Wi-Fi), which the browsers on that network were
 * told to trust and Node was not, so these requests failed whatever the address said. They are taken when the peer
 * presents exactly this server's certificate — its fingerprint, not a chain — and refused otherwise; nothing else the
 * process reaches is verified any less.
 */
export const reachOwnServer = async ({ publicUrl, listener, cert }: OwnServer) => {
  const outside = new URL(publicUrl);
  const outsidePort = outside.port || (outside.protocol === 'https:' ? '443' : '80');
  const own = new X509Certificate(cert).fingerprint256;
  const undici = await import('undici');
  const { Agent, setGlobalDispatcher } = undici;
  const connect = elsewhere(undici);
  const agent = new Agent({
    connect: (options, callback) => {
      if (options.hostname !== outside.hostname || (options.port || outsidePort) !== outsidePort) {
        connect(options, callback);

        return;
      }

      const socket = tls.connect({
        host: listener.host,
        port: listener.port,
        // An address is not a name a certificate is chosen by: SNI carries host names only.
        ...(net.isIP(outside.hostname) ? {} : { servername: outside.hostname }),
        ALPNProtocols: ['http/1.1'],
        rejectUnauthorized: false
      });
      socket.once('secureConnect', () => {
        if (socket.getPeerX509Certificate()?.fingerprint256 !== own) {
          socket.destroy();
          callback(new Error(`${outside.host} answered with a certificate that is not this server's`), null);

          return;
        }

        callback(null, socket);
      });
      socket.once('error', error => callback(error, null));
    }
  });
  setGlobalDispatcher(agent);
};
