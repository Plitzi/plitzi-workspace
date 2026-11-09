import { z } from 'zod';

import { setCodegenEnabled } from '@plitzi/nexus';

import type { TrustedTypesPolicyName } from '../helpers/security';

/** What of the browser's `trustedTypes` the SDK uses: TypeScript's DOM library does not declare it yet. */
export type TrustedTypesRules = {
  createHTML?: (input: string) => string | null;
  createScript?: (input: string) => string | null;
  createScriptURL?: (input: string) => string | null;
};
export type TrustedTypesPolicy = { createHTML: (input: string) => TrustedHTML };
type TrustedTypesFactory = {
  createPolicy: (name: TrustedTypesPolicyName, rules: TrustedTypesRules) => TrustedTypesPolicy;
  /** The page's `default` policy, once something made it. */
  defaultPolicy?: TrustedTypesPolicy | null;
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

/**
 * A script of the page's own origin — a `blob:` it made, or a file it serves: only a script already running there can
 * have asked for it, and what it names is the origin's own.
 */
const isOwnScript = (input: string): boolean => {
  if (typeof location === 'undefined') {
    return false;
  }

  if (input.startsWith(`blob:${location.origin}/`)) {
    return true;
  }

  try {
    return new URL(input, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

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
  // page: a second copy of this module (the builder's, a plugin's own) finds it made, and leaves it — making it again is
  // itself a violation the page reports.
  if (!factory.defaultPolicy) {
    try {
      factory.createPolicy('default', {
        createHTML: input => (input === REACT_SCRIPT_SHELL || isText(input) ? input : null),
        createScript: input => (isJson(input) ? input : null),
        createScriptURL: input => (isOwnScript(input) ? input : null)
      });
    } catch {
      // Made between the check and here, by another copy: the page has its default.
    }
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
 * The page's script policy as its server said it on `<html data-plitzi-script-policy>`: what a copy of this module the
 * SDK does not start — the builder's own, a plugin's that bundles its own — holds itself to. Nothing on the server, nor
 * on a page with no policy.
 */
export const pageScriptPolicy = (): 'report-only' | 'enforce' | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const said = document.documentElement.dataset.plitziScriptPolicy;

  return said === 'report-only' || said === 'enforce' ? said : undefined;
};

/**
 * The page's policies, made as the SDK starts — before anything writes markup: the head's JSON-LD and React's first
 * script go through `default` from the first commit — with the page's script policy as its server sent it
 * (`Server.scriptPolicy`). What the policies clean depends on it: enforced, what an author wrote is cleaned; reported,
 * it passes as it was, since cleaning it then would take away what still runs (an inline handler the policy does not
 * refuse yet).
 *
 * A page held to a policy, reported or enforced, never asks for `eval`: the store writes without its compiled writers
 * (nexus's `new Function`), and zod parses without compiling. Reported, their probes are reports on every page a visitor
 * opens, which would bury the reports worth reading; enforced, they are refused anyway. It costs about 5 µs a store
 * write, and loading the dashboard writes about a hundred times.
 *
 * Called with nothing, it reads the policy off the document (`pageScriptPolicy`): how a copy of this module the SDK did
 * not start — the builder's — learns it.
 *
 * Nothing on the server: what is decided here is one page's, and a server renders many at once.
 */
export const startMarkupPolicies = (next: 'report-only' | 'enforce' | undefined = pageScriptPolicy()): void => {
  if (typeof window === 'undefined') {
    return;
  }

  mode = next;
  setCodegenEnabled(next ? false : undefined);
  // zod compiles a schema it parses often with `new Function`, and probes for it first: the same refusal, the same report.
  if (next) {
    z.config({ jitless: true });
  }

  own();
};
