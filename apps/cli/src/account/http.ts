import tls from 'node:tls';

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
export type Reply<T> = { ok: true; status: number; data: T } | { ok: false; error: string };

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

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return { ok: false, error: unreachable(url, error) };
  }

  const text = await response.text();
  try {
    // The platform's JSON, read for the fields each caller names: every one is checked where it is used.
    return { ok: true, status: response.status, data: (text ? JSON.parse(text) : {}) as T };
  } catch {
    return { ok: false, error: `${new URL(url).pathname} answered ${response.status}, and not with JSON.` };
  }
};

export const postForm = <T>(url: string, body: Record<string, string>): Promise<Reply<T>> =>
  requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString()
  });
