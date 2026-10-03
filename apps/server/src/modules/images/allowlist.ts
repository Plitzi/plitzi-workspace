/**
 * Whether a host is one a picture may come from: named exactly (`images.example.com`), or under a wildcard
 * (`*.example.com` — its subdomains, not `example.com` itself, which is named on its own when it is meant).
 */
export const isAllowedImageHost = (domains: readonly string[], hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  return domains.some(entry => {
    const domain = entry.toLowerCase().trim();
    if (domain.startsWith('*.')) {
      const parent = domain.slice(2);

      return host.endsWith(`.${parent}`);
    }

    return host === domain;
  });
};
