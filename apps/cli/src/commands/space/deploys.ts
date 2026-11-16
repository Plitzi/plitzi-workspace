import { writeFile } from 'node:fs/promises';

import chalk from 'chalk';

import { CLIENT_HEADER, clientHeaderValue } from '@plitzi/sdk-shared/clients';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { trustSystemCertificates } from '../../account/http';
import { authorizedRequest } from '../../account/session';
import { CLI_VERSION } from '../../scaffold/project';
import { connectToSpace } from '../account/account';
import { fail } from '../shared/terminal';

import type { Connection } from '../../account/connection';
import type { AccountOptions } from '../account/account';

/**
 * `plitzi space targets | deploy | deploys | download` (RFC 0034): where each domain's site is and where it stands, a
 * target deployed again (followed to its end), its deploys and a kept one's site as a zip — the builder's publish sheet
 * for a terminal, a CI job or an agent, held to the same rules on the platform.
 */

export interface DeployOptions extends AccountOptions {
  json?: boolean;
  redeploy?: boolean;
  follow?: boolean;
}

export interface DownloadOptions extends AccountOptions {
  out?: string;
}

type Ask = { status: number; data: unknown } | undefined;

const ask = async (
  connection: Connection,
  path: string,
  init: { method?: 'POST'; body?: unknown } = {}
): Promise<Ask> => {
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

const refusalOf = (data: unknown, status: number): string =>
  isRecord(data) && typeof data.error === 'string' ? data.error : `The platform answered ${String(status)}.`;

type Deploy = {
  id: number;
  domain: string;
  status: string;
  environment: string;
  revision: number;
  provider: string;
  error: string | null;
  url: string | null;
  kept: boolean;
  createdAt: number;
};

const isDeploy = (value: unknown): value is Deploy =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  typeof value.status === 'string' &&
  typeof value.environment === 'string' &&
  typeof value.revision === 'number';

const STATUS_COLOR: Record<string, (text: string) => string> = {
  succeeded: chalk.green,
  failed: chalk.red,
  canceled: chalk.dim
};

/** One deploy as a list says it: when (UTC), what, where it stands. */
export const deployLine = (deploy: Deploy): string =>
  `#${String(deploy.id)}  ${new Date(deploy.createdAt * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC  ${deploy.domain}  ${deploy.environment} r${String(deploy.revision)}  ${(STATUS_COLOR[deploy.status] ?? chalk.cyan)(deploy.status)}${deploy.error ? chalk.dim(` — ${deploy.error}`) : ''}`;

type Target = {
  domain: string;
  mode: string;
  providerLabel: string;
  verified: boolean;
  serves: { environment: string; revision: number } | null;
  lastDeploy: Deploy | null;
  update: { words: string } | null;
  required: string | null;
  locked: { requires: string } | null;
};

const isTarget = (value: unknown): value is Target =>
  isRecord(value) &&
  typeof value.domain === 'string' &&
  typeof value.mode === 'string' &&
  typeof value.providerLabel === 'string';

const MODE_WORDS: Record<string, string> = {
  ssr: 'Plitzi',
  spa: 'SPA',
  static: 'prerendered',
  selfHosted: 'your server'
};

/** One target: where its site is, what it serves, and what it asks. */
export const targetLine = (target: Target): string => {
  const where =
    target.mode === 'ssr' ? 'Plitzi' : `${target.providerLabel} (${MODE_WORDS[target.mode] ?? target.mode})`;
  const serves = target.serves
    ? target.serves.environment === 'main'
      ? 'the draft'
      : `${target.serves.environment} r${String(target.serves.revision)}`
    : 'nothing yet';
  const asks = target.required
    ? chalk.red(target.required)
    : target.lastDeploy?.status === 'failed'
      ? chalk.red(`last deploy failed: ${target.lastDeploy.error ?? 'see plitzi space deploys'}`)
      : target.locked
        ? chalk.yellow(`its plan no longer includes it (${target.locked.requires})`)
        : target.update
          ? chalk.yellow(target.update.words)
          : !target.verified
            ? chalk.yellow('not verified')
            : '';

  return [chalk.bold(target.domain), where, `serves ${serves}`, asks].filter(Boolean).join('  ');
};

export const targets = async (options: DeployOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to read the targets of');
  const answer = connection ? await ask(connection, '/targets') : undefined;
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

  const listed =
    isRecord(answer.data) && Array.isArray(answer.data.targets) ? answer.data.targets.filter(isTarget) : [];
  console.log(listed.length > 0 ? listed.map(targetLine).join('\n') : 'No domains yet.');
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Follows a deploy to its end, saying each line of its log once, and answers how it ended. */
const follow = async (connection: Connection, id: number): Promise<Deploy | undefined> => {
  let said = 0;
  for (;;) {
    const answer = await ask(connection, `/deploys/${String(id)}`);
    const body: unknown = isRecord(answer?.data) ? answer.data.deploy : undefined;
    const log: unknown[] = isRecord(body) && Array.isArray(body.log) ? body.log : [];
    if (!isDeploy(body)) {
      return undefined;
    }

    const deploy = body;
    for (const line of log.slice(said)) {
      if (isRecord(line) && typeof line.line === 'string') {
        console.log(
          line.level === 'error' ? chalk.red(line.line) : line.level === 'warn' ? chalk.yellow(line.line) : line.line
        );
      }
    }

    said = log.length;
    if (!['queued', 'building', 'uploading'].includes(deploy.status)) {
      return deploy;
    }

    await sleep(1_500);
  }
};

export const deploy = async (domain: string, options: DeployOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to deploy');
  const answer = connection
    ? await ask(connection, '/deploys', {
        method: 'POST',
        body: { domain, kind: options.redeploy ? 'redeploy' : 'deploy' }
      })
    : undefined;
  if (!connection || !answer) {
    return;
  }

  const queued = isRecord(answer.data) ? answer.data.deploy : undefined;
  if (answer.status !== 201 || !isDeploy(queued)) {
    fail('refused-by-platform', refusalOf(answer.data, answer.status));

    return;
  }

  if (!options.follow) {
    console.log(
      options.json
        ? JSON.stringify(answer.data)
        : `Deploy #${String(queued.id)} of ${chalk.bold(domain)} is queued. Follow it: plitzi space deploy ${domain} --follow, or plitzi space deploys ${domain}`
    );

    return;
  }

  const ended = await follow(connection, queued.id);
  if (!ended) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(ended));
  } else {
    console.log(deployLine(ended));
  }

  if (ended.status !== 'succeeded') {
    fail('refused-by-platform', ended.error ?? `Deploy #${String(ended.id)} ${ended.status}.`);
  }
};

export const deploys = async (domain: string | undefined, options: DeployOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to read the deploys of');
  const answer = connection
    ? await ask(connection, domain ? `/deploys?domain=${encodeURIComponent(domain)}` : '/deploys')
    : undefined;
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

  const listed =
    isRecord(answer.data) && Array.isArray(answer.data.deploys) ? answer.data.deploys.filter(isDeploy) : [];
  console.log(
    listed.length > 0 ? listed.map(deployLine).join('\n') : domain ? `${domain} has no deploys yet.` : 'No deploys yet.'
  );
};

/** A kept deploy's site, as the zip the platform keeps — saved where `--out` says, or beside where the CLI runs. */
export const download = async (deployId: number, options: DownloadOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to download a deploy of');
  const spaceId = connection?.space?.id;
  if (!connection || spaceId === undefined) {
    return;
  }

  trustSystemCertificates();
  const response = await fetch(`${connection.api}/spaces/${String(spaceId)}/deploys/${String(deployId)}/artifact`, {
    headers: {
      Authorization: `Bearer ${connection.grant.accessToken}`,
      [CLIENT_HEADER]: clientHeaderValue('cli', CLI_VERSION)
    }
  }).catch((error: unknown) => {
    fail('refused-by-platform', error instanceof Error ? error.message : String(error));

    return undefined;
  });
  if (!response) {
    return;
  }

  if (!response.ok) {
    const said: unknown = await response.json().catch(() => undefined);
    fail('refused-by-platform', refusalOf(said, response.status));

    return;
  }

  const out = options.out ?? `deploy-${String(deployId)}.zip`;
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(out, bytes);
  console.log(`Saved deploy #${String(deployId)} (${String(Math.round(bytes.byteLength / 1024))} KB) to ${out}`);
};
