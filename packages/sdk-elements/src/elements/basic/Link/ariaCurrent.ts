import type { LinkProps } from './Link';

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** Whether `shown` is `linked` or, for a section, a page under it — at a segment boundary: `/runs` holds `/runs/7`, not `/runsx`. */
const holds = (linked: string, shown: string, current: NonNullable<LinkProps['current']>): boolean =>
  shown === linked || (current === 'section' && shown.startsWith(linked === '/' ? '/' : `${linked}/`));

/** An address as the comparison reads it: its path, decoded and without a trailing slash, and its query. */
type Address = { path: string; query: URLSearchParams };

const addressOf = (url: URL): Address => ({
  path: withoutTrailingSlash(decodeURI(url.pathname)),
  query: url.searchParams
});

/**
 * The address shown, parsed once for every link of the page — the last one asked, since a page is drawn at one address —
 * and each link's own, parsed once per path: a link's path starts with `/`, so the path it leads to does not depend on
 * the address it is read against. Every link parsed both on every render: a URL each, twice, for every link of a sidebar.
 */
let shownAddress: { location: string; address: Address } | undefined;
const linkedAddresses = new Map<string, Address>();
/** Bounded, and once full it keeps what it has (nexus's `getByPath` says why evicting is worse than not caching). */
const MAX_LINKED = 4096;

const shownOf = (location: string): Address => {
  if (shownAddress?.location !== location) {
    shownAddress = { location, address: addressOf(new URL(location)) };
  }

  return shownAddress.address;
};

const linkedOf = (path: string, location: string): Address => {
  const known = linkedAddresses.get(path);
  if (known) {
    return known;
  }

  const address = addressOf(new URL(path, location));
  if (linkedAddresses.size < MAX_LINKED) {
    linkedAddresses.set(path, address);
  }

  return address;
};

/**
 * What a link says of the page being shown, given its whole address (`navigation.href`): `'page'` when it leads to that
 * page, `'true'` when it is the section that page is in — the entry of a menu lit for the pages under it — and nothing
 * otherwise. The values `aria-current` takes: a screen reader announces the first as "current page" and the second as
 * "current", since the link does not lead to the page itself.
 *
 * The fragment (`#plans`) is the same page, and so is any query the link does not name. A query it does name must be
 * the one shown: `/?window=6h` and `/?window=24h` are one path, and with the path alone every window's link was the
 * current one. Undefined while no address is known — nothing is current then.
 */
export const ariaCurrent = (
  path: string,
  location: string | undefined,
  current: NonNullable<LinkProps['current']>
): 'page' | 'true' | undefined => {
  if (!location || !path.startsWith('/')) {
    return undefined;
  }

  try {
    const shown = shownOf(location);
    const linked = linkedOf(path, location);
    const namedQuery = [...linked.query].every(([name, value]) => shown.query.getAll(name).includes(value));
    if (!namedQuery || !holds(linked.path, shown.path, current)) {
      return undefined;
    }

    return shown.path === linked.path ? 'page' : 'true';
  } catch {
    return undefined;
  }
};
