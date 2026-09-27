import http from 'node:http';
import net from 'node:net';

/**
 * A balancer as unkind as one can be: round robin, no affinity — every request and every socket to the next replica,
 * whoever sent it and whatever it belongs to. What Pizarra has to work behind: a page's requests and its socket land
 * on different replicas, and an agent's session on one is asked about on all of them.
 *
 * Each answer says which replica gave it (`X-Pizarra-Replica`), for whoever wants to see the spread.
 */
export const startBalancer = (port: number, host: string, targets: readonly number[]): http.Server => {
  let next = 0;
  const pick = (): number => {
    const target = targets[next % targets.length];
    next += 1;

    return target;
  };

  const server = http.createServer((req, res) => {
    const target = pick();
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: target,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress ?? '' }
      },
      answer => {
        res.writeHead(answer.statusCode ?? 502, { ...answer.headers, 'x-pizarra-replica': String(target) });
        answer.pipe(res);
      }
    );
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/plain' });
      }

      res.end(`Replica ${target} is not answering`);
    });
    // A client gone is gone for the replica too, as for any balancer: an open stream to it is closed, not left open.
    res.on('close', () => {
      if (!res.writableFinished) {
        upstream.destroy();
      }
    });
    req.pipe(upstream);
  });

  // A socket is passed through whole: the upgrade is replayed to the replica, and the two ends joined.
  server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    const target = pick();
    const upstream = net.connect(target, '127.0.0.1', () => {
      const headers = Object.entries(req.headers).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(one => `${name}: ${one}`)
      );
      upstream.write(`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`);
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  server.listen(port, host);

  return server;
};
