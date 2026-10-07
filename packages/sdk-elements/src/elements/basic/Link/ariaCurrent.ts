import type { LinkProps } from './Link';

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** Whether `shown` is `linked` or, for a section, a page under it — at a segment boundary: `/runs` holds `/runs/7`, not `/runsx`. */
const holds = (linked: string, shown: string, current: NonNullable<LinkProps['current']>): boolean =>
  shown === linked || (current === 'section' && shown.startsWith(linked === '/' ? '/' : `${linked}/`));

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
    const shown = new URL(location);
    const linked = new URL(path, location);
    const shownPath = withoutTrailingSlash(decodeURI(shown.pathname));
    const linkedPath = withoutTrailingSlash(decodeURI(linked.pathname));
    const namedQuery = [...linked.searchParams].every(([name, value]) =>
      shown.searchParams.getAll(name).includes(value)
    );
    if (!namedQuery || !holds(linkedPath, shownPath, current)) {
      return undefined;
    }

    return shownPath === linkedPath ? 'page' : 'true';
  } catch {
    return undefined;
  }
};
