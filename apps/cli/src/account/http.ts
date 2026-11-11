import tls from 'node:tls';

import { CLIENT_HEADER, clientHeaderValue, CURRENT_HEADER } from '@plitzi/sdk-shared/clients';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { isPlanRefusal } from '@plitzi/sdk-shared/network';

import { tellBehind } from './behind';
import { CLI_VERSION } from '../scaffold/project';

import type { RefusalCode } from '@plitzi/sdk-shared/refusals';

/**
 * The CLI's requests to the platform, and what it says when one never arrives.
 *
 * Node's `fetch` carries its own bundled certificate authorities and knows nothing about the machine's, so a server
 * whose certificate the machine trusts — a development one issued by a local CA, a company's own — is refused with
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE` while the browser beside it talks to the same host happily. The desktop app met
 * this first; here the fix is to trust what the system trusts, as the browser the sign-in happens in does.
 */

let trusted = false;

/** The system's certificate authorities, added to Node's own. Once per process; a no-op where Node cannot do it. */
export const trustSystemCertificates = (): void => {
  if (trusted) {
    return;
  }

  trusted = true;
  try {
    tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...tls.getCACertificates('system')]);
  } catch {
    // A Node without the system store (before 22.19) keeps its own, and `NODE_EXTRA_CA_CERTS` still works there.
  }
};

/** A call that answered — with whatever status — or has something specific to say about why it did not. */
export type Reply<T> = { ok: true; status: number; data: T } | { ok: false; code: RefusalCode; error: string };

/**
 * Why a request never reached anyone, in words somebody can act on.
 *
 * `fetch` reports every transport failure as the same "fetch failed"; the useful part is on `cause`. A certificate this
 * machine will not verify and a server that is not running are the two that actually happen.
 */
export const unreachable = (url: string, error: unknown): string => {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  const detail = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));

  return `Could not reach ${new URL(url).origin} (${detail}).`;
};

/** One request, answered as JSON. A gateway's HTML page is said as such rather than read as the server refusing. */
export const requestJson = async <T>(url: string, init: RequestInit = {}): Promise<Reply<T>> => {
  trustSystemCertificates();

  // Every request says which CLI it is: the platform refuses one older than it takes, and tells one behind it.
  const headers = new Headers(init.headers);
  headers.set(CLIENT_HEADER, clientHeaderValue('cli', CLI_VERSION));
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    return { ok: false, code: 'unanswered', error: unreachable(url, error) };
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      code: 'refused-by-platform',
      error: `${new URL(url).pathname} answered ${response.status}, and not with JSON.`
    };
  }

  if (response.status === 426 && isRecord(data) && data.code === 'outdated' && typeof data.error === 'string') {
    return { ok: false, code: 'outdated', error: data.error };
  }

  const current = response.headers.get(CURRENT_HEADER);
  if (current) {
    await tellBehind(new URL(url).origin, current);
  }

  // A plan that does not include what was asked — said as the server says it, with the plan and the link, whatever
  // command asked: no command carries a plan of its own, and a self-hosted server never answers one.
  if (isPlanRefusal(data)) {
    return {
      ok: false,
      code: 'not-allowed',
      error: data.error.includes(data.upgradeUrl) ? data.error : `${data.error} ${data.upgradeUrl}`
    };
  }

  // The platform's JSON, read for the fields each caller names: every one is checked where it is used.
  return { ok: true, status: response.status, data: data as T };
};

export const postForm = <T>(url: string, body: Record<string, string>): Promise<Reply<T>> =>
  requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString()
  });
