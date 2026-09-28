import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startBalancer } from './balancer.ts';

import type { ChildProcess } from 'node:child_process';

/**
 * Pizarra as a cluster, on one machine: `REPLICAS` replicas sharing one Redis, behind a round-robin balancer with no
 * affinity at `PORT` — the address to open, in as many browsers as there are people, and to give agents
 * (`<PORT>/mcp`). Every request and every socket goes to the next replica, so the people on a board are spread across
 * them, and so is an agent's every call.
 *
 *     REDIS_URL=redis://127.0.0.1:6379 yarn workspace @plitzi/example-whiteboard start:replicas
 *
 * - `REDIS_URL`: the Redis they share. Default `redis://127.0.0.1:6379`.
 * - `REPLICAS`: how many. Default 3.
 * - `PORT`: the balancer's. Default 4016; the replicas take the ports after `REPLICA_PORT` (default 4100).
 * - `SIGNING_SECRET`: what they all sign with. A development one when not given.
 *
 * A replica's own port is open too, to pin a browser to one: `http://127.0.0.1:4101/b/…`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const main = path.resolve(here, '../src/main.ts');
const count = Number(process.env.REPLICAS ?? 3);
const port = Number(process.env.PORT ?? 4016);
const first = Number(process.env.REPLICA_PORT ?? 4100) + 1;
const host = '127.0.0.1';
const redis = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const secret = process.env.SIGNING_SECRET ?? 'pizarra-replicas-on-one-machine-only';
const ports = Array.from({ length: count }, (_, index) => first + index);

const replicas: ChildProcess[] = ports.map(replicaPort => {
  const child = spawn(process.execPath, [main], {
    env: {
      ...process.env,
      PORT: String(replicaPort),
      HOST: host,
      REDIS_URL: redis,
      SIGNING_SECRET: secret,
      REPLICA_URL: `http://${host}:${replicaPort}`,
      // Links an agent is handed are to the balancer's address: that is this Pizarra's, not a replica's.
      PIZARRA_PUBLIC_URL: `http://${host}:${port}`
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const tag = `[replica ${replicaPort}] `;
  const relay = (to: NodeJS.WriteStream) => (chunk: Buffer) => {
    to.write(
      chunk
        .toString()
        .split('\n')
        .filter(Boolean)
        .map(line => `${tag}${line}\n`)
        .join('')
    );
  };
  child.stdout.on('data', relay(process.stdout));
  child.stderr.on('data', relay(process.stderr));
  child.on('exit', code => {
    console.error(`${tag}stopped (${code ?? 'signal'})`);
  });

  return child;
});

const balancer = startBalancer(port, host, ports);
console.log(
  `[replicas] ${count} replicas (${ports.join(', ')}) over ${new URL(redis).host}, round robin at http://${host}:${port}/` +
    ` — agents at http://${host}:${port}/mcp`
);

const stop = (): void => {
  balancer.close();
  replicas.forEach(child => child.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 1500).unref();
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
