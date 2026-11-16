import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { authorizedRequest } from '../../account/session';
import { connectToSpace } from '../account/account';
import { fail } from '../shared/terminal';

import type { Connection } from '../../account/connection';
import type { AccountOptions } from '../account/account';

/**
 * `plitzi space snapshot | publish | rollback | releases` (RFC 0034): keep the draft as a revision, point a domain at
 * one, put back what a domain served before, and read what each domain serves and has served — the builder's Snapshot
 * and Publish, for a terminal, a CI job or an agent, held to the same rules on the platform.
 */

export interface ReleaseOptions extends AccountOptions {
  json?: boolean;
}

export interface SnapshotOptions extends ReleaseOptions {
  environment?: string;
  message?: string;
}

export interface PublishOptions extends ReleaseOptions {
  environment?: string;
  revision?: number;
  deploy?: boolean;
  /** An ISO 8601 moment: set for later instead of now. */
  at?: string;
}

export interface RollbackOptions extends ReleaseOptions {
  to?: string;
}

export const PUBLISHED_ENVIRONMENTS = ['development', 'staging', 'production'] as const;

type Served = { environment: string; revision: number };

const isServed = (value: unknown): value is Served =>
  isRecord(value) && typeof value.environment === 'string' && typeof value.revision === 'number';

/** `production r12`, or the draft. */
export const versionName = ({ environment, revision }: Served): string =>
  environment === 'main' ? 'the draft' : `${environment} r${String(revision)}`;

/** `production@12` or `production:12` named on the command line, as the version it is. */
export const parseVersion = (asked: string): Served | undefined => {
  const match = /^(main|development|staging|production)[@:](\d+)$/.exec(asked.trim());

  return match ? { environment: match[1], revision: Number(match[2]) } : undefined;
};

/** What the platform said when it refused, in its own words. */
const refusalOf = (data: unknown, status: number): string =>
  isRecord(data) && typeof data.error === 'string' ? data.error : `The platform answered ${String(status)}.`;

/** A request on the connected space, its answer when it is the one expected, and the platform's refusal said when not. */
const ask = async (
  connection: Connection,
  path: string,
  init: { method?: 'POST'; body?: unknown } = {}
): Promise<{ status: number; data: unknown } | undefined> => {
  const spaceId = connection.space?.id;
  if (spaceId === undefined) {
    return undefined;
  }

  const answered = await authorizedRequest<unknown>(connection, `/spaces/${String(spaceId)}${path}`, {
    method: init.method ?? 'GET',
    ...(init.body === undefined
      ? {}
      : { body: JSON.stringify(init.body), headers: { 'Content-Type': 'application/json' } })
  });
  if (!answered.ok) {
    fail('refused-by-platform', answered.error);

    return undefined;
  }

  return { status: answered.value.reply.status, data: answered.value.reply.data };
};

export const snapshot = async (options: SnapshotOptions): Promise<void> => {
  const environment = options.environment ?? 'production';
  if (!PUBLISHED_ENVIRONMENTS.some(known => known === environment)) {
    fail('bad-value', `A snapshot goes to ${PUBLISHED_ENVIRONMENTS.join(', ')} — not ${environment}.`);

    return;
  }

  const connection = await connectToSpace(options, 'to take a snapshot of');
  if (!connection) {
    return;
  }

  const answer = await ask(connection, '/snapshots', {
    method: 'POST',
    body: { environment, description: options.message ?? '' }
  });
  if (!answer) {
    return;
  }

  const kept = isRecord(answer.data) ? answer.data.snapshot : undefined;
  const taken = isServed(kept) ? kept : undefined;
  if (answer.status !== 201 || !taken) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  if (options.json) {
    console.log(JSON.stringify(answer.data));

    return;
  }

  const preview = isRecord(kept) && typeof kept.previewUrl === 'string' ? kept.previewUrl : undefined;
  console.log(
    [
      `Kept the draft as ${chalk.bold(versionName(taken))}.`,
      ...(preview
        ? [`Look at it before any domain serves it: ${preview} (only whoever has the link can open it)`]
        : []),
      `Put it on a domain: plitzi space publish <domain> --revision ${String(taken.revision)}`
    ].join('\n')
  );
};

export const publish = async (domain: string, options: PublishOptions): Promise<void> => {
  const environment = options.environment ?? 'production';
  const at = options.at === undefined ? undefined : Date.parse(options.at);
  if (at !== undefined && Number.isNaN(at)) {
    fail('bad-value', `--at is an ISO 8601 moment — 2026-12-01T09:00Z — not ${options.at ?? ''}.`);

    return;
  }

  const connection = await connectToSpace(options, 'to publish');
  if (!connection) {
    return;
  }

  if (at !== undefined) {
    await scheduleLater(connection, domain, environment, options, Math.floor(at / 1000));

    return;
  }

  const answer = await ask(connection, '/releases', {
    method: 'POST',
    body: {
      domain,
      environment,
      ...(options.revision ? { revision: options.revision } : {}),
      ...(options.deploy ? { deploy: true } : {})
    }
  });
  if (!answer) {
    return;
  }

  const release = isRecord(answer.data) && isServed(answer.data.release) ? answer.data.release : undefined;
  if (answer.status !== 201 || !release) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  const queued = isRecord(answer.data) && isRecord(answer.data.deploy) ? answer.data.deploy.id : undefined;
  console.log(
    options.json
      ? JSON.stringify(answer.data)
      : `${chalk.bold(domain)} serves ${versionName(release)}.${typeof queued === 'number' ? ` Its copy is being deployed (#${String(queued)}): plitzi space deploys ${domain}.` : ''} Changed your mind: plitzi space rollback ${domain}`
  );
};

/** A publish set for later: the revision named, or the environment's latest now — what is published is fixed now. */
const scheduleLater = async (
  connection: Connection,
  domain: string,
  environment: string,
  options: PublishOptions,
  at: number
): Promise<void> => {
  let revision = options.revision;
  if (revision === undefined) {
    const latest = await ask(connection, `/snapshots?environment=${encodeURIComponent(environment)}`);
    const listed: unknown = isRecord(latest?.data) ? latest.data.snapshots : undefined;
    const first: unknown = Array.isArray(listed) ? (listed as unknown[]).at(0) : undefined; // A JSON array: its items unread.
    revision = isServed(first) ? first.revision : undefined;
    if (revision === undefined) {
      fail(
        'refused-by-platform',
        `${environment} has no snapshot to set for later: take one with plitzi space snapshot`
      );

      return;
    }
  }

  const answer = await ask(connection, '/releases/schedule', {
    method: 'POST',
    body: { domain, environment, revision, at }
  });
  if (!answer) {
    return;
  }

  if (answer.status !== 201) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  console.log(
    options.json
      ? JSON.stringify(answer.data)
      : `${chalk.bold(domain)} will serve ${environment} r${String(revision)} at ${new Date(at * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC, with its deploy when it needs one.`
  );
};

export const rollback = async (domain: string, options: RollbackOptions): Promise<void> => {
  const to = options.to === undefined ? undefined : parseVersion(options.to);
  if (options.to !== undefined && !to) {
    fail('bad-value', `--to names a version as environment@revision — production@9 — not ${options.to}.`);

    return;
  }

  const connection = await connectToSpace(options, 'to roll back');
  if (!connection) {
    return;
  }

  const answer = await ask(connection, '/releases/rollback', { method: 'POST', body: { domain, ...(to ?? {}) } });
  if (!answer) {
    return;
  }

  const release = isRecord(answer.data) && isServed(answer.data.release) ? answer.data.release : undefined;
  if (answer.status !== 201 || !release) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  console.log(
    options.json
      ? JSON.stringify(answer.data)
      : `${chalk.bold(domain)} serves ${versionName(release)} again. Feature flags and the space’s data stay as they are.`
  );
};

type DomainLine = { domain: string; verified: boolean; serves: Served | null; rollback: Served | null };

const isDomainLine = (value: unknown): value is DomainLine =>
  isRecord(value) &&
  typeof value.domain === 'string' &&
  typeof value.verified === 'boolean' &&
  (value.serves === null || isServed(value.serves)) &&
  (value.rollback === null || isServed(value.rollback));

type ReleaseLine = Served & { kind: string; at: number; by: { username: string } | null };

const isReleaseLine = (value: unknown): value is ReleaseLine =>
  isRecord(value) &&
  typeof value.kind === 'string' &&
  typeof value.at === 'number' &&
  (value.by === null || (isRecord(value.by) && typeof value.by.username === 'string')) &&
  isServed(value);

/** One domain as `plitzi space releases` lists it: what it serves, and what a rollback would put back. */
export const domainLine = ({ domain, verified, serves, rollback: back }: DomainLine): string =>
  [
    chalk.bold(domain),
    verified ? (serves ? versionName(serves) : 'nothing published yet') : chalk.yellow('not verified'),
    back ? chalk.dim(`rollback: ${versionName(back)}`) : ''
  ]
    .filter(Boolean)
    .join('  ');

/** One release, newest first: what it put on the domain, how, who and when (UTC). */
export const releaseLine = ({ kind, at, by, ...served }: ReleaseLine): string =>
  `${new Date(at * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC  ${kind === 'rollback' ? 'rolled back to' : 'published'} ${versionName(served)}${by ? chalk.dim(` · ${by.username}`) : ''}`;

export const releases = async (domain: string | undefined, options: ReleaseOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to read the releases of');
  if (!connection) {
    return;
  }

  const answer = await ask(connection, domain ? `/releases?domain=${encodeURIComponent(domain)}` : '/releases');
  if (!answer) {
    return;
  }

  if (answer.status !== 200) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  if (options.json) {
    console.log(JSON.stringify(answer.data));

    return;
  }

  const listed = isRecord(answer.data) ? (domain ? answer.data.releases : answer.data.domains) : undefined;
  const lines = Array.isArray(listed)
    ? listed.flatMap(entry =>
        domain ? (isReleaseLine(entry) ? [releaseLine(entry)] : []) : isDomainLine(entry) ? [domainLine(entry)] : []
      )
    : [];
  console.log(lines.length > 0 ? lines.join('\n') : domain ? `Nothing published on ${domain} yet.` : 'No domains yet.');
};
