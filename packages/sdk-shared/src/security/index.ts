import { setCodegenEnabled } from '@plitzi/nexus';

/**
 * The Trusted Types policies the SDK makes, by name: what a page's policy lets write markup into it
 * (`trusted-types …`), and what the SDK creates them as — one list, so the two cannot come apart.
 *
 * - `plitzi-html`: markup the page itself made — the server's own HTML kept through hydration, the dev tools'.
 * - `plitzi-author-html`: markup an author or the data wrote — a raw HTML block, rich text, an SVG — cleaned when the
 *   page's script policy is enforced (sdk-elements, beside the cleaner).
 * - `default`: what a library writes without asking for a policy, and only what cannot run: text (the head's JSON-LD,
 *   which Helmet writes as `innerHTML`), the empty script React makes one from, JSON as a script, and a worker the
 *   page made itself (a map's, from a `blob:` of its own origin).
 * - `dompurify`: the cleaner's own, which it makes to read the markup it is handed before it cleans it.
 */
export const TRUSTED_TYPES_POLICIES = ['plitzi-html', 'plitzi-author-html', 'default', 'dompurify'] as const;

export type TrustedTypesPolicyName = (typeof TRUSTED_TYPES_POLICIES)[number];

/** What of the browser's `trustedTypes` the SDK uses: TypeScript's DOM library does not declare it yet. */
export type TrustedTypesRules = {
  createHTML?: (input: string) => string | null;
  createScript?: (input: string) => string | null;
  createScriptURL?: (input: string) => string | null;
};
export type TrustedTypesPolicy = { createHTML: (input: string) => TrustedHTML };
type TrustedTypesFactory = {
  createPolicy: (name: TrustedTypesPolicyName, rules: TrustedTypesRules) => TrustedTypesPolicy;
};

/** The browser's factory, where there is one: none on the server, nor in a browser without Trusted Types. */
export const trustedTypesFactory = (): TrustedTypesFactory | undefined =>
  // The global is the browser's, and only declared by the DOM library of a newer TypeScript.
  (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;

let mode: 'report-only' | 'enforce' | undefined;

export const scriptPolicyEnforced = (): boolean => mode === 'enforce';

/** What may be a script without a policy of its own: data (JSON-LD), and the empty one React builds a script from. */
const isJson = (input: string): boolean => {
  try {
    JSON.parse(input);

    return true;
  } catch {
    return false;
  }
};

const REACT_SCRIPT_SHELL = '<script></script>';

/**
 * Markup with no tag in it is text: it makes no element, so nothing in it runs where it is written. Written into a
 * script, it is checked again before that script runs (`createScript`).
 */
const isText = (input: string): boolean => !input.includes('<');

/** A `blob:` the page made: only a script already running on its origin can have made it. */
const isOwnBlob = (input: string): boolean =>
  typeof location !== 'undefined' && input.startsWith(`blob:${location.origin}/`);

let ownPolicy: TrustedTypesPolicy | null | undefined;

/** `plitzi-html`, and `default` beside it, made the first time markup is written: never on the server. */
const own = (): TrustedTypesPolicy | null => {
  if (ownPolicy !== undefined) {
    return ownPolicy;
  }

  const factory = trustedTypesFactory();
  if (!factory) {
    ownPolicy = null;

    return ownPolicy;
  }

  ownPolicy = factory.createPolicy('plitzi-html', { createHTML: input => input });
  // Anything else written without a policy is refused, and reported: that is how a sink nobody named is found. One per
  // page: a second copy of this module (a plugin that brought its own) finds it made, which the browser says by throwing.
  try {
    factory.createPolicy('default', {
      createHTML: input => (input === REACT_SCRIPT_SHELL || isText(input) ? input : null),
      createScript: input => (isJson(input) ? input : null),
      createScriptURL: input => (isOwnBlob(input) ? input : null)
    });
  } catch {
    // Made already, by the first copy: the page has its default.
  }

  return ownPolicy;
};

/** Bounded, and once full it keeps what it has (nexus's `getByPath` says why evicting is worse than not caching). */
const MAX_KEPT = 500;
const kept = new Map<string, TrustedHTML>();

/**
 * Markup the page made itself (`plitzi-html`), as a trusted value where the browser asks for one — the same object for
 * the same markup, since React writes `innerHTML` again whenever the value is a different one. The markup as it is on
 * the server and where there is no Trusted Types.
 */
export const ownHtml = (html: string): string | TrustedHTML => {
  const policy = own();
  if (!policy) {
    return html;
  }

  const known = kept.get(html);
  if (known) {
    return known;
  }

  const trusted = policy.createHTML(html);
  if (kept.size < MAX_KEPT) {
    kept.set(html, trusted);
  }

  return trusted;
};

/**
 * The page's policies, made as the SDK starts — before anything writes markup: the head's JSON-LD and React's first
 * script go through `default` from the first commit — with the page's script policy as its server sent it
 * (`Server.scriptPolicy`). What the policies clean depends on it: enforced, what an author wrote is cleaned; reported,
 * it passes as it was, since cleaning it then would take away what still runs (an inline handler the policy does not
 * refuse yet).
 *
 * A page held to a policy, reported or enforced, never asks for `eval`: the store writes without its compiled writers
 * (nexus's `new Function`). Reported, their probe is two reports on every page a visitor opens, which would bury the
 * reports worth reading; enforced, it is refused anyway. It costs about 5 µs a write, and loading the dashboard writes
 * about a hundred times.
 *
 * Nothing on the server: what is decided here is one page's, and a server renders many at once.
 */
export const startMarkupPolicies = (next: 'report-only' | 'enforce' | undefined): void => {
  if (typeof window === 'undefined') {
    return;
  }

  mode = next;
  setCodegenEnabled(next ? false : undefined);
  own();
};
