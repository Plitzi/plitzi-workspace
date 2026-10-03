import { lookup } from 'node:dns/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { apiFor, signedIn } from './account';
import { authorizedRequest } from '../account/session';

import type { AccountOptions } from './account';

/**
 * Whether a site is the person's to import — the check `plitzi import` makes before it reads anything.
 *
 * Proof is a verified domain of one of their spaces that covers the host: the `_plitzi` TXT record a custom domain is
 * verified by, which only whoever controls the zone can publish. A site served from this machine needs none — it is
 * the person's own development server.
 */

export type SiteOwnership = { ok: true; said: string } | { ok: false; problem: string };

const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

/** Served from this machine: `localhost`, or a name that resolves only to loopback addresses (a `/etc/hosts` entry). */
export const isThisMachine = async (host: string): Promise<boolean> => {
  const name = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (name === 'localhost' || name.endsWith('.localhost')) {
    return true;
  }

  try {
    const addresses = await lookup(name, { all: true });

    return addresses.length > 0 && addresses.every(({ address }) => LOOPBACK.test(address));
  } catch {
    return false;
  }
};

const NOT_YOURS = (host: string): string =>
  `${host} is not a verified domain of any space of yours, so it is not imported. If the site is yours: add its ` +
  'domain to one of your spaces under Domains in the dashboard, publish the `_plitzi` TXT record it shows, verify ' +
  'it, and import again.';

export const siteOwnership = async (url: URL, options: AccountOptions): Promise<SiteOwnership> => {
  if (await isThisMachine(url.hostname)) {
    return { ok: true, said: 'served from this machine' };
  }

  const api = await apiFor(options);
  if (!api) {
    return { ok: false, problem: 'There is no platform to ask whether the site is yours: pass --api.' };
  }

  const connection = await signedIn(api, `to show ${url.hostname} is yours`);
  if (!connection) {
    return { ok: false, problem: `Sign in to import ${url.hostname}: only a site whose domain you verified is read.` };
  }

  const answered = await authorizedRequest<unknown>(
    connection,
    `/account/domains/covering?host=${encodeURIComponent(url.hostname)}`
  );
  if (!answered.ok) {
    return { ok: false, problem: answered.error };
  }

  const { status, data } = answered.value.reply;
  const space = isRecord(data) && isRecord(data.space) && typeof data.space.name === 'string' ? data.space.name : '';
  if (status === 200 && isRecord(data) && typeof data.domain === 'string') {
    return { ok: true, said: `${data.domain}, verified for ${space || 'one of your spaces'}` };
  }

  if (status === 404) {
    return { ok: false, problem: NOT_YOURS(url.hostname) };
  }

  return { ok: false, problem: `The platform could not say whether ${url.hostname} is yours (${String(status)}).` };
};
