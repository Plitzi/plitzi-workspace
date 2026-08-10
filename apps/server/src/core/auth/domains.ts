/**
 * Declared domains are stored and signed as full origins (`https://site.example.com`) while a request host is bare
 * (`site.example.com`), so both sides are reduced to a hostname before being compared. A value that is not a URL at
 * all (`plitzi-desktop`, `chrome-extension://…`) has no hostname and simply never matches a host.
 */
export const hostnameOf = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return '';
  }
};

/** The wildcard a space sets when its embed target is genuinely unknown. Named so an API can warn about it. */
export const ANY_DOMAIN = '*';

/**
 * May a token declaring `origins` be presented on `host`?
 *
 * `platformHosts` are this deployment's own — its builder, its renderer, its MCP endpoint — which serve first-party
 * traffic for every space and are therefore valid destinations for any token, whatever domains it declares. They are
 * passed in rather than read from configuration here because only the deployment knows what it runs.
 */
export const domainAllowed = (host: string, origins: string[], platformHosts: string[] = []): boolean => {
  if (origins.includes(ANY_DOMAIN)) {
    return true;
  }

  const hostname = hostnameOf(host);
  if (!hostname) {
    return false;
  }

  return [...platformHosts.map(hostnameOf), ...origins.map(hostnameOf)].filter(Boolean).includes(hostname);
};

/**
 * User input arrives as whatever someone typed — `example.com`, `https://example.com/`, `HTTPS://Example.com/x`. It
 * is stored as a canonical origin so the signed claim, the stored column and the comparison all agree.
 */
export const normalizeDomain = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed === ANY_DOMAIN) {
    return ANY_DOMAIN;
  }

  if (!hostnameOf(trimmed)) {
    return undefined;
  }

  // The port is part of the origin a browser sends, and local development runs on one (app.plitzi.local:3000).
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);

    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
};

/**
 * Who may put this space in an iframe, as CSP `frame-ancestors` sources.
 *
 * The deployment's own hosts are the floor — a builder previews every space in one — and a space widens it with the
 * domains its owner declared. `*` opts out entirely. Without this a published space is framable from any site on the
 * web, which is how one customer wraps another's space inside their own page and passes it off as theirs.
 *
 * Unlike the token's domain binding, this one is enforced by the browser, which is why it is worth stating even
 * though a determined caller can ignore the header: it stops the attack that needs a real visitor's browser.
 */
export const frameAncestors = (declared: string[], platformHosts: string[] = []): string[] => {
  if (declared.includes(ANY_DOMAIN)) {
    return [ANY_DOMAIN];
  }

  // CSP keywords carry their own quotes inside the header value, hence the escaping.
  return [...new Set(['\'self\'', ...platformHosts, ...declared])];
};

/**
 * Which origins a request bearing this grant may be answered for.
 *
 * A space is reachable from the origins its own token declares, plus this deployment's own apps; `*` means anywhere,
 * and a grant that declares nothing at all falls back to the deployment's own unless it allows anonymous origins.
 * Returning `true` means "reflect whatever asked", which is what a CORS layer wants for the wildcard case.
 */
export const corsOrigins = (
  declared: string[] | undefined,
  platformOrigins: string[] = [],
  allowWithoutOrigin = false
): true | string[] => {
  const origins = declared ?? [];

  if (origins.includes(ANY_DOMAIN) || (origins.length === 0 && allowWithoutOrigin)) {
    return true;
  }

  return [...new Set([...platformOrigins, ...origins])];
};
