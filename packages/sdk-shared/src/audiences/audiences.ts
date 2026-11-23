import { evaluateRuleGroup } from '../conditions';
import { hasConditions } from '../flags/resolveFlags';
import { cookieFromHeader } from '../helpers/cookies';
import { isRecord } from '../helpers/isRecord';
import { chooseByOf, variantItemsOf, variantsElementsOf } from '../variants/variants';

import type { FlagScope } from '../flags/resolveFlags';
import type { Element, Schema } from '../types';

export type VisitorDevice = 'mobile' | 'tablet' | 'desktop';

/**
 * What an audience's rules know of the visitor beyond what a flag's do, read as `visitor.<fact>`: whether they came
 * before, the language their browser asks for first (its primary subtag: `es`, `en`), the kind of device, and the
 * country they are in (ISO 3166-1 alpha-2: `ES`, `MX`) — empty where nothing in front of the server says it.
 */
export type VisitorFacts = { returning: boolean; language: string; device: VisitorDevice; country: string };

export const VISITOR_FACTS = ['returning', 'language', 'device', 'country'] as const;

export type VisitorFact = (typeof VISITOR_FACTS)[number];

/** What an audience's rules are matched against: what a flag's are, and the visitor's facts. */
export type AudienceScope = FlagScope & { visitor?: VisitorFacts };

/**
 * The kind of device a user agent says, with the client hint `Sec-CH-UA-Mobile` (`?1`) first where the browser sends
 * one. A tablet says so in its agent (`iPad`, `Tablet`) or is an Android one without `Mobile`.
 */
export const deviceFromUserAgent = (userAgent: string | undefined, mobileHint?: string): VisitorDevice => {
  if (mobileHint === '?1') {
    return 'mobile';
  }

  const agent = userAgent ?? '';
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(agent)) {
    return 'tablet';
  }

  return /Mobi|iPhone|iPod|Android|Windows Phone/i.test(agent) ? 'mobile' : 'desktop';
};

/** The language a browser asks for first, by its primary subtag — `es` for `es-AR,es;q=0.9,en;q=0.8` — or none. */
export const languageFrom = (preferred: string | undefined): string =>
  (preferred ?? '').split(',')[0]?.split(';')[0]?.split('-')[0]?.trim().toLowerCase() ?? '';

/**
 * The headers a CDN in front of the server says the visitor's country in, the first one present winning: Cloudflare's,
 * CloudFront's, Vercel's. A server with none in front gets none — and any visitor could send one, so a country is for
 * what a page shows, never for who may see it.
 */
export const COUNTRY_HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-vercel-ip-country'] as const;

/**
 * A country as an edge says it, as rules compare it: two letters, upper case — `ES` for `es` — or none for what is no
 * country (`XX`, unknown, and `T1`, Tor, as Cloudflare says them).
 */
export const countryFrom = (value: string | undefined): string => {
  const code = (value ?? '').trim().toUpperCase();

  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : '';
};

/**
 * The cookie that says when a visitor was first seen, in seconds since the epoch (UTC): what makes them returning. Named
 * with the port, as the others a page keeps for its visitor are.
 */
export const seenCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_seen_${port}` : 'plitzi_seen';
};

/** How long a visit lasts, at most: a visitor first seen longer ago than this is returning. */
export const VISIT_LENGTH_S = 30 * 60;

/** How long the cookie that says a visitor came before is kept. */
const SEEN_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

/** When a visitor was first seen, from a `Cookie` header or `document.cookie` — none for a first visit. */
export const firstSeenOf = (cookies: string | undefined, host: string | undefined): number | undefined => {
  const seen = Number(cookieFromHeader(cookies, seenCookieName(host)));

  return Number.isInteger(seen) && seen > 0 ? seen : undefined;
};

/** Whether a visitor first seen then is returning now (`now` in ms). */
export const isReturning = (firstSeen: number | undefined, now: number): boolean =>
  firstSeen !== undefined && now / 1000 - firstSeen > VISIT_LENGTH_S;

/** The cookie's whole text, for `document.cookie`: first seen now. */
export const seenCookie = (host: string | undefined, now: number, { secure }: { secure: boolean }): string =>
  [
    `${seenCookieName(host)}=${String(Math.floor(now / 1000))}`,
    'Path=/',
    `Max-Age=${String(SEEN_COOKIE_MAX_AGE_S)}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : [])
  ].join('; ');

/** A visitor's facts, as a request says them: its cookies, its agent, its languages and the country its edge said. */
export const visitorFactsOf = ({
  cookies,
  host,
  userAgent,
  mobileHint,
  acceptLanguage,
  country,
  now
}: {
  cookies: string | undefined;
  host: string | undefined;
  userAgent: string | undefined;
  mobileHint?: string;
  acceptLanguage: string | undefined;
  country?: string;
  now: number;
}): VisitorFacts => ({
  returning: isReturning(firstSeenOf(cookies, host), now),
  language: languageFrom(acceptLanguage),
  device: deviceFromUserAgent(userAgent, mobileHint),
  country: countryFrom(country)
});

/** The visitor facts an audience's rule reads: `visitor.device`, `visitor.language`, `visitor.returning`, `.country`. */
const factsReadBy = (when: unknown, read: Set<VisitorFact>): void => {
  if (!isRecord(when)) {
    return;
  }

  const { field, rules } = when;
  if (typeof field === 'string' && field.startsWith('visitor.')) {
    const fact = VISITOR_FACTS.find(name => `visitor.${name}` === field);
    if (fact) {
      read.add(fact);
    }
  }

  if (Array.isArray(rules)) {
    rules.forEach(rule => factsReadBy(rule, read));
  }
};

/** Every variant a space chooses by rules — of each `variants` element chosen by rules, on its pages and components. */
const ruledVariantsOf = (schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>): Element[] =>
  variantsElementsOf(schema)
    .filter(({ element }) => chooseByOf(element.attributes) === 'rules')
    .flatMap(({ element, flat }) => variantItemsOf(element, flat));

/**
 * The visitor facts a space's variants chosen by rules decide on, in order: what a page of it is drawn by besides the address and the
 * session — so what its pages are kept apart by. Empty for a space with no audience, or none reading a fact.
 */
export const audienceFactsUsed = (
  schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>
): VisitorFact[] => {
  const read = new Set<VisitorFact>();
  for (const variant of ruledVariantsOf(schema)) {
    factsReadBy(variant.attributes.when, read);
  }

  return VISITOR_FACTS.filter(fact => read.has(fact));
};

/** The facts a page is kept apart by, written as one part of a cache key: `device=mobile;language=es`. */
export const audienceKeyOf = (facts: VisitorFacts, used: readonly VisitorFact[]): string =>
  used.map(fact => `${fact}=${String(facts[fact])}`).join(';');

/**
 * Which of an audience's variants a visitor is shown: the first whose rule they match — one with no conditions matches
 * everybody, the "everyone else" an audience ends with — or none (`-1`).
 */
export const chooseAudienceVariant = (rules: readonly unknown[], scope: AudienceScope): number =>
  rules.findIndex(when => !hasConditions(when) || evaluateRuleGroup(when, scope));

/**
 * This page's visitor facts, in a browser that no server drew it for (a space with no server in front): read once,
 * so every audience of the page decides on the same ones — a visit's returning-ness does not flip under it. No country:
 * only an edge in front of a server knows it.
 */
let pageFacts: VisitorFacts | undefined;

export const browserVisitorFacts = (): VisitorFacts => {
  if (!pageFacts) {
    let cookies: string | undefined;
    try {
      cookies = document.cookie;
    } catch {
      cookies = undefined;
    }

    pageFacts = visitorFactsOf({
      cookies,
      host: window.location.host,
      userAgent: navigator.userAgent,
      acceptLanguage: navigator.languages.join(',') || navigator.language,
      now: Date.now()
    });
  }

  return pageFacts;
};

/** Says, for the visitor's next visits, when they were first seen — once: the cookie is never moved forward. */
export const keepFirstSeen = (): void => {
  try {
    const host = window.location.host;
    if (firstSeenOf(document.cookie, host) === undefined) {
      document.cookie = seenCookie(host, Date.now(), { secure: window.location.protocol === 'https:' });
    }
  } catch {
    // Where cookies may not be written, every visit is a first one.
  }
};
