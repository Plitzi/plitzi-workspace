export type PathPattern = {
  path: string;
  caseSensitive?: boolean;
  end?: boolean;
};

export type PathMatch = {
  params: Record<string, string | undefined>;
  pathname: string;
  pathnameBase: string;
  pattern: Required<PathPattern>;
};

type CompiledParam = { paramName: string; isOptional: boolean };

// Mirrors react-router's `compilePath` / `matchPath` so the SDK (client routing) and the server (SSR/RSC route
// resolution) resolve the same URL to the same page and params. Reimplemented rather than imported to keep this
// module dependency-free: it runs on the request path, where pulling react-router — and with it the client
// router — would cost boot weight and rule out non-Node runtimes. Parity is pinned by a test in sdk-navigation,
// which still has react-router available; that test is what catches an upstream semantics change.
const compilePath = (path: string, caseSensitive: boolean, end: boolean): [RegExp, CompiledParam[]] => {
  const params: CompiledParam[] = [];
  let regexpSource = `^${path
    .replace(/\/*\*?$/, '')
    .replace(/^\/*/, '/')
    .replace(/[\\.*+^${}|()[\]]/g, '\\$&')
    .replace(
      /\/:([\w-]+)(\?)?/g,
      (match: string, paramName: string, isOptional: string | undefined, index: number, source: string) => {
        params.push({ paramName, isOptional: isOptional !== undefined });
        if (isOptional === undefined) {
          return '/([^\\/]+)';
        }

        // An optional param followed by a suffix (`:id?.html`) still owns its slash; only a trailing one — or one
        // followed by another segment — may drop it entirely.
        const nextChar = source.charAt(index + match.length);
        if (nextChar && nextChar !== '/') {
          return '/([^\\/]*)';
        }

        return '(?:/([^\\/]*))?';
      }
    )
    .replace(/\/([\w-]+)\?(\/|$)/g, '(/$1)?$2')}`;

  if (path.endsWith('*')) {
    params.push({ paramName: '*', isOptional: false });
    regexpSource += path === '*' || path === '/*' ? '(.*)$' : '(?:\\/(.+)|\\/*)$';
  } else if (end) {
    regexpSource += '\\/*$';
  } else if (path !== '' && path !== '/') {
    regexpSource += '(?:(?=\\/|$))';
  }

  return [new RegExp(regexpSource, caseSensitive ? undefined : 'i'), params];
};

export const matchPath = (pattern: PathPattern | string, pathname: string): PathMatch | null => {
  const resolved: Required<PathPattern> =
    typeof pattern === 'string'
      ? { path: pattern, caseSensitive: false, end: true }
      : { path: pattern.path, caseSensitive: pattern.caseSensitive ?? false, end: pattern.end ?? true };
  const [matcher, compiledParams] = compilePath(resolved.path, resolved.caseSensitive, resolved.end);
  const match = pathname.match(matcher);
  if (!match) {
    return null;
  }

  const matchedPathname = match[0];
  const captureGroups = match.slice(1);
  let pathnameBase = matchedPathname.replace(/(.)\/+$/, '$1');
  const params = compiledParams.reduce<Record<string, string | undefined>>((acum, { paramName, isOptional }, index) => {
    const value = captureGroups[index] as string | undefined;
    if (paramName === '*') {
      const splatValue = value ?? '';
      pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, '$1');
    }

    if (isOptional && !value) {
      acum[paramName] = undefined;

      return acum;
    }

    // Values stay percent-encoded, matching react-router: only an encoded separator is normalised, so a param
    // can never be mistaken for two path segments.
    acum[paramName] = (value ?? '').replace(/%2F/g, '/');

    return acum;
  }, {});

  return { params, pathname: matchedPathname, pathnameBase, pattern: resolved };
};
