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
