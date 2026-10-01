import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';

import type { Environment } from '@plitzi/sdk-shared';
import type { SpaceExport } from '@plitzi/sdk-shared/source';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A platform for the tests to sign in to: the native OAuth endpoints, the account's session, a space and its CDNs —
 * on a real loopback port, so the CLI's requests travel as they do against the real one.
 *
 * `browser` stands in for the person at the grant screen: handed the `/authorize` address, it answers the loopback
 * callback with a code, having chosen `choose` when the client asked to choose a space.
 */

export interface FakeUpload {
  path: string;
  contentType: string;
  bytes: number;
}

export interface FakePlatform {
  api: string;
  /** Opens the grant screen and answers it, as the person would. */
  browser: (url: string) => void;
  /** What the person picks on the grant screen when asked to choose a space. */
  choose: string;
  /** Every scope an `/authorize` was asked with (`''` for none). */
  scopes: string[];
  /** Refresh tokens revoked. */
  revoked: string[];
  /** What each client registered as. */
  registrations: Record<string, unknown>[];
  uploads: FakeUpload[];
  /** Every source snapshot kept (`PUT /spaces/:id/sources`), read back as JSON. */
  sources: unknown[];
  cdns: {
    identifier: string;
    name: string;
    provider: string;
    buckets: { identifier: string; name: string; visibility: 'public' | 'private'; domain: string }[];
  }[];
  /** Access tokens the platform accepts; emptied to have it answer 401. */
  valid: Set<string>;
  /** Answers 401 to every access token, the ones it has just renewed included. */
  refuseAll: boolean;
  /** Refresh tokens it renews. */
  renewable: Set<string>;
  /** Seconds each access token lives. */
  expiresIn: number;
  /** Space 3's functions draft: saved whole, a new version each time; a file containing `BROKEN` does not build. */
  functions: { files: Record<string, string>; version: string };
  /** Every task tried, with its params. */
  tried: { task: string; params: unknown }[];
  /** Space 3's runtime: every push as it arrived, and its variables — a value the platform keeps and never shows. */
  runtime: { pushed: FakeUpload[]; variables: Map<string, string> };
  /**
   * Space 3 (Pizarra) as its export gives it: its pages as code, by path, and the packages its code asks for — the
   * draft's, and each published environment's by revision.
   */
  pizarra: {
    pages: Record<string, string>;
    dependencies: Record<string, string>;
    snapshots: Partial<Record<string, Record<number, { pages: Record<string, string>; description: string }>>>;
  };
  close: () => Promise<void>;
}

const ENVIRONMENTS: readonly Environment[] = ['main', 'development', 'staging', 'production'];

const readBody = async (req: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks);
};

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
};

export const fakePlatform = async (): Promise<FakePlatform> => {
  let issued = 0;
  const pending = new Map<string, { challenge: string; target: string }>();
  const grants = new Map<string, string>();

  const mint = (target: string) => {
    issued += 1;
    const access = `access-${issued}`;
    const refresh = `refresh-${issued}`;
    platform.valid.add(access);
    platform.renewable.add(refresh);
    grants.set(refresh, target);

    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: platform.expiresIn,
      token_type: 'Bearer',
      target
    };
  };

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', platform.api);
      const body = await readBody(req);
      const form = new URLSearchParams(body.toString());
      const signedIn =
        !platform.refuseAll && platform.valid.has((req.headers.authorization ?? '').replace('Bearer ', ''));

      if (url.pathname === '/.well-known/oauth-authorization-server') {
        json(res, 200, {
          issuer: platform.api,
          authorization_endpoint: `${platform.api}/authorize`,
          token_endpoint: `${platform.api}/token`,
          registration_endpoint: `${platform.api}/register`,
          revocation_endpoint: `${platform.api}/revoke`
        });
      } else if (url.pathname === '/register') {
        platform.registrations.push(JSON.parse(body.toString()) as Record<string, unknown>);
        json(res, 201, { client_id: `client-${issued + 1}` });
      } else if (url.pathname === '/token' && form.get('grant_type') === 'authorization_code') {
        const code = pending.get(form.get('code') ?? '');
        const verifier = createHash('sha256')
          .update(form.get('code_verifier') ?? '')
          .digest('base64url');
        if (code?.challenge !== verifier) {
          json(res, 400, { error: 'invalid_grant' });

          return;
        }

        json(res, 200, mint(code.target));
      } else if (url.pathname === '/token' && form.get('grant_type') === 'refresh_token') {
        const refresh = form.get('refresh_token') ?? '';
        if (!platform.renewable.has(refresh)) {
          json(res, 400, { error: 'invalid_grant', error_description: 'The refresh token is unknown or has expired.' });

          return;
        }

        platform.renewable.delete(refresh);
        json(res, 200, mint(grants.get(refresh) ?? 'account'));
      } else if (url.pathname === '/revoke') {
        platform.revoked.push(form.get('token') ?? '');
        json(res, 200, {});
      } else if (url.pathname === '/files/pizarra/assets/world.json') {
        // A public CDN's file: no session asked for, as a bucket serving a space's files asks none.
        json(res, 200, { land: [] });
      } else if (!signedIn) {
        json(res, 401, { error: 'Not authenticated' });
      } else if (url.pathname === '/auth/session') {
        json(res, 200, { success: true, details: { email: 'ada@example.com', username: 'ada' } });
      } else if (url.pathname === '/spaces/3') {
        json(res, 200, { space: { id: 3, name: 'Website', permanentUrl: 'website' } });
      } else if (url.pathname === '/spaces/3/cdns') {
        json(res, 200, { cdns: platform.cdns });
      } else if (url.pathname.startsWith('/spaces/3/cdns/') && req.method === 'POST') {
        platform.uploads.push({
          path: `${url.pathname}${url.search}`,
          contentType: req.headers['content-type'] ?? '',
          bytes: body.byteLength
        });
        json(res, 201, {
          resource: { path: 'https://cdn.example.com/website/plugins/ab12_seat-picker/ab12_seat-picker.zip' },
          plugin: { root: 'seatPicker', version: '1.2.0' },
          installed: 'added'
        });
      } else if (url.pathname === '/spaces/3/functions' && req.method === 'GET') {
        json(res, 200, { ...platform.functions, manifest: { hosts: [], tasks: [], routes: [] } });
      } else if (url.pathname === '/spaces/3/functions' && req.method === 'PUT') {
        const sent = JSON.parse(body.toString()) as { files: Record<string, string>; base?: string };
        const broken = Object.entries(sent.files).find(([, text]) => text.includes('BROKEN'));
        if (sent.base !== undefined && sent.base !== platform.functions.version) {
          json(res, 409, { ok: false, refusal: { status: 409, error: 'moved on', limit: 'version' } });
        } else if (broken) {
          json(res, 422, { ok: false, problems: [{ file: broken[0], line: 2, message: 'Expected ";"' }] });
        } else {
          platform.functions = {
            files: sent.files,
            version: `v${String(Number(platform.functions.version.slice(1)) + 1)}`
          };
          json(res, 200, {
            ok: true,
            version: platform.functions.version,
            manifest: { hosts: [], tasks: [{ namespace: 'feed', action: 'read' }], routes: [] }
          });
        }
      } else if (url.pathname === '/spaces/pizarra/export' || url.pathname === '/spaces/3/export') {
        const exported = pizarraExport(url);
        json(res, exported.status, exported.body);
      } else if (url.pathname === '/spaces/locked/export') {
        json(res, 403, { error: 'Taking a space out as a project is for whoever may change it' });
      } else if (url.pathname === '/spaces/3/sources' && req.method === 'PUT') {
        const snapshot: unknown = JSON.parse(gunzipSync(body).toString('utf-8'));
        platform.sources.push(snapshot);
        json(res, 200, { ok: true, files: 2 });
      } else if (url.pathname === '/spaces/3/runtime' && req.method === 'PUT') {
        platform.runtime.pushed.push({
          path: url.pathname,
          contentType: req.headers['content-type'] ?? '',
          bytes: body.byteLength
        });
        json(res, 200, { ok: true, digest: 'd'.repeat(64), size: body.byteLength });
      } else if (url.pathname === '/spaces/3/runtime' && req.method === 'GET') {
        json(res, 200, {
          environments: [
            {
              environment: 'main',
              revision: 0,
              digest: 'd'.repeat(64),
              status: 'ready',
              endpoints: ['/mcp'],
              tasks: ['board.create']
            }
          ],
          variables: [...platform.runtime.variables.keys()].sort()
        });
      } else if (url.pathname.startsWith('/spaces/3/runtime/variables/')) {
        const name = decodeURIComponent(url.pathname.slice('/spaces/3/runtime/variables/'.length));
        if (req.method === 'PUT') {
          platform.runtime.variables.set(name, (JSON.parse(body.toString()) as { value: string }).value);
        } else {
          platform.runtime.variables.delete(name);
        }

        res.writeHead(204).end();
      } else if (url.pathname === '/spaces/3/functions/try' && req.method === 'POST') {
        const sent = JSON.parse(body.toString()) as { task: string; params: unknown };
        platform.tried.push(sent);
        json(res, 200, {
          status: 'completed',
          output: { value: { echoed: sent.params } },
          steps: [{ id: 'task', action: sent.task, startTime: 1, endTime: 5, logs: ['reading'] }]
        });
      } else {
        json(res, 404, { error: 'Not found' });
      }
    })();
  });

  await new Promise<void>(done => {
    server.listen(0, '127.0.0.1', () => done());
  });

  /** What `GET /spaces/:id/export` answers for Pizarra: the draft, or a published environment's snapshot. */
  const pizarraExport = (url: URL): { status: number; body: SpaceExport | { error: string } } => {
    const askedEnvironment = url.searchParams.get('environment') ?? 'main';
    const environment = ENVIRONMENTS.find(candidate => candidate === askedEnvironment);
    if (!environment) {
      return { status: 400, body: { error: `"${askedEnvironment}" is not an environment` } };
    }

    const asked = url.searchParams.get('revision');
    const revisions = platform.pizarra.snapshots[environment] ?? {};
    const revision = asked ? Number(asked) : Math.max(0, ...Object.keys(revisions).map(Number));
    const snapshot = environment === 'main' ? undefined : revisions[revision];
    if (environment !== 'main' && !snapshot) {
      return { status: 404, body: { error: `${environment} has no snapshot to take out` } };
    }

    const pages = snapshot?.pages ?? platform.pizarra.pages;
    const version: SpaceExport['version'] = snapshot
      ? {
          environment,
          revision,
          snapshot: { description: snapshot.description, publishedAt: '2026-10-01T00:00:00.000Z' }
        }
      : { environment: 'main', revision: 0, snapshot: null };

    return {
      status: 200,
      body: {
        format: 1,
        space: { id: 3, name: 'Pizarra', permanentUrl: 'pizarra' },
        version,
        authoring: url.searchParams.get('source') === 'cloud' ? null : { exportName: 'pizarra', files: pages },
        actions: [],
        connectors: [],
        functions: platform.functions,
        source: { files: {}, dependencies: platform.pizarra.dependencies, runtime: null, plugins: [] },
        builtOnly: { plugins: [], runtime: null },
        assets: [{ url: `${platform.api}/files/pizarra/assets/world.json`, path: 'assets/world.json' }],
        variables: [],
        credentials: [],
        visitorRoles: [],
        report: { conflicts: [], rangeConflicts: [], corrections: [] }
      }
    };
  };

  const platform: FakePlatform = {
    // A listening server always has an address object; only a pipe's is a string.
    api: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    choose: 'space:3',
    scopes: [],
    revoked: [],
    registrations: [],
    uploads: [],
    sources: [],
    cdns: [
      {
        identifier: 'cdn-main',
        name: 'Main',
        provider: 'r2',
        buckets: [
          { identifier: 'main-files', name: 'Files', visibility: 'public', domain: 'https://cdn.example.com' },
          { identifier: 'main-code', name: 'Code', visibility: 'private', domain: '' }
        ]
      }
    ],
    valid: new Set(),
    refuseAll: false,
    renewable: new Set(),
    expiresIn: 3600,
    functions: { files: {}, version: 'v0' },
    tried: [],
    runtime: { pushed: [], variables: new Map() },
    pizarra: { pages: { 'index.ts': 'export const pizarra = {};\n' }, dependencies: {}, snapshots: {} },
    browser: url => {
      const asked = new URL(url).searchParams;
      const scope = asked.get('scope') ?? '';
      platform.scopes.push(scope);
      const code = `code-${platform.scopes.length}`;
      pending.set(code, {
        challenge: asked.get('code_challenge') ?? '',
        target: scope.split(' ').includes('space') ? platform.choose : 'account'
      });
      const callback = new URL(asked.get('redirect_uri') ?? '');
      callback.search = new URLSearchParams({ code, state: asked.get('state') ?? '' }).toString();
      void fetch(callback);
    },
    close: () =>
      new Promise<void>(done => {
        server.closeAllConnections();
        server.close(() => done());
      })
  };

  return platform;
};
