import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useEffect, useMemo, useRef } from 'react';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import { evaluateComputed, resolveVariables } from '@plitzi/sdk-shared/dataSource';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { flagValues, undeclaredFlagOverrides } from '@plitzi/sdk-shared/flags';
import useFlagResolution from '@plitzi/sdk-shared/flags/useFlagResolution';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import useStableValue from '@plitzi/sdk-shared/hooks/useStableValue';
import { useCommonStore, useCommonStoreSync, useRenderSettings } from '@plitzi/sdk-shared/store';
import useTheme, { SPACE_THEME_AREA } from '@plitzi/sdk-shared/theme/useTheme';

import type { AuthContextValue, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type GlobalSourcesProps = {
  children: ReactNode;
};

// Mounts the global data sources at the right tree depth (under the Navigation/Auth/RuntimeState providers).
const GlobalSources = ({ children }: GlobalSourcesProps) => {
  const { environment } = useRenderSettings();

  // --- variables ---
  const [[variables, routeParams, queryParams, hostname, origin, href, currentPageId, pendingLocation = '']] =
    useCommonStore([
      'schema.variables',
      'navigation.routeParams',
      'navigation.queryParams',
      'navigation.hostname',
      'navigation.origin',
      'navigation.href',
      'navigation.currentPageId',
      'navigation.pendingLocation'
    ]);
  // Shared with the router, which needs the same answer BEFORE this provider exists: a page that redirects an
  // unauthenticated visitor off-site decides not to render, so nothing below here ever runs to publish them.
  // Resolved again whenever a route param changes, which is most navigations; most variables do not depend on one.
  const variablesValue = useStableValue(
    useMemo<Record<string, unknown>>(
      () => resolveVariables(variables, { routeParams, queryParams, hostname, environment }),
      [environment, hostname, queryParams, routeParams, variables]
    )
  );
  const variablesFields = useCallback(
    () => getPathsFromObeject(variablesValue).map(path => ({ path, name: `variables.${path}` })),
    [variablesValue]
  );
  useRegisterSource({ id: 'global', source: 'variables', name: 'Variables', fields: variablesFields });
  useCommonStoreSync('runtime.sources.variables', variablesValue);

  // --- navigation ---
  const [pageDefinitions = {}] = useCommonStore('pageDefinitions');
  const pages = useMemo(
    () =>
      Object.values(pageDefinitions).map(page => ({ value: page.id, label: get(page, 'attributes.name', page.id) })),
    [pageDefinitions]
  );
  /**
   * `origin` is here and `hostname` is not, and the split is deliberate: `hostname` is what a variable's `when` rule
   * matches on, while `origin` is what a LINK needs — scheme and port included — to name this page absolutely.
   * Without it the only way to write "send me back where I am" was a per-environment variable naming each host.
   * `href` is the page itself, whole: the link that shares it. `pending` is a navigation on its way: a link to a page
   * resolved on the server waits for that page's data before it goes, and `pendingLocation` is where it is going.
   */
  const navigationValue = useMemo(
    () => ({ routeParams, queryParams, origin, href, currentPageId, pending: pendingLocation !== '', pendingLocation }),
    [routeParams, queryParams, origin, href, currentPageId, pendingLocation]
  );
  const navigationFields = useCallback(() => {
    const fields = getPathsFromObeject({ routeParams, queryParams }).map(path => ({
      path,
      name: `navigation.${path}`
    })) as SourceField[];
    const originField = { path: 'origin', name: 'Origin' } as SourceField;
    const hrefField = { path: 'href', name: 'This page’s address' } as SourceField;
    const pendingFields = [
      { path: 'pending', name: 'A navigation is on its way' },
      { path: 'pendingLocation', name: 'Where a navigation is going' }
    ] as SourceField[];
    const currentPageField =
      pages.length > 0
        ? ({ path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages } as SourceField)
        : ({ path: 'currentPageId', name: 'Current Page' } as SourceField);

    return [...fields, originField, hrefField, ...pendingFields, currentPageField];
  }, [routeParams, queryParams, pages]);
  useRegisterSource({ id: 'global', source: 'navigation', name: 'Navigation', fields: navigationFields });
  useCommonStoreSync('runtime.sources.navigation', navigationValue);

  // --- auth ---
  // Read as partial: with no provider mounted the context is its default `{}`, whatever its type promises.
  const auth: Partial<AuthContextValue> = use(AuthContext);
  const { user, authenticated, state: status } = auth;
  const [userProvider = 'basic'] = useCommonStore('schema.settings.userProvider');
  // Keyed on whether the space authenticates at all, never on which provider it picked: the context is the same
  // shape whoever filled it, so a space on a registered provider binds `user.*` exactly like one on `basic`.
  // Reading the name here is what used to leave every non-Plitzi space with an empty auth source while signed in.
  const authValue = useMemo<Record<string, unknown>>(() => {
    if (userProvider === '') {
      return {};
    }

    return {
      isAuthenticated: authenticated,
      // Where auth is in finding out who this is (`init` … `authenticated` | `guest`). Left out with no provider at
      // all. What a page shows while it resolves, and what the kept state waits for before it restores anything.
      ...(status === undefined ? {} : { status }),
      accessToken: user?.accessToken ?? '',
      details: {
        username: '',
        email: '',
        roles: '',
        permissions: '',
        verified: '',
        ...(user?.details ?? {})
      }
    };
  }, [userProvider, user, authenticated, status]);
  const authFields = useCallback(
    () => getPathsFromObeject(authValue).map(path => ({ path, name: `user.${path}` })),
    [authValue]
  );
  useRegisterSource({ id: 'global', source: 'auth', name: 'Auth State', fields: authFields });
  useCommonStoreSync('runtime.sources.auth', authValue);

  /**
   * --- flags
   *
   * The space's feature flags, each as the layers above the space left it: `{{ flags.newCheckout }}` in a binding, a
   * `when`, a computed value. The resolution — which layer decided, which rule matched — goes beside it for the dev
   * tools; the source carries the answers alone. Published before `computed`, which may read them.
   */
  const flagResolution = useFlagResolution(auth);
  const flagsValue = useMemo(() => flagValues(flagResolution), [flagResolution]);
  const flagsFields = useCallback(
    () =>
      Object.keys(flagsValue).map((name): SourceField => ({
        path: name,
        name: `flags.${name}`,
        inputType: 'checkbox'
      })),
    [flagsValue]
  );
  useRegisterSource({ id: 'global', source: 'flags', name: 'Feature Flags', fields: flagsFields });
  useCommonStoreSync('runtime.sources.flags', flagsValue);
  useCommonStoreSync('flags.resolved', flagResolution);
  const [declaredFlags, flagOverrides] = useCommonStore(['schema.flags', 'flags.overrides'])[0];
  // An override only ever answers for a flag the space declares. One that names another is a typo or a flag the
  // space has since removed — either way whoever set it believes something that is not happening, so they are told.
  // Once per change in WHAT is ignored: the overrides object is rebuilt whenever a layer is written again.
  const ignoredOverrides = useStableValue(undeclaredFlagOverrides(declaredFlags, flagOverrides ?? {}));
  useEffect(() => {
    ignoredOverrides.forEach(({ layer, name }) =>
      console.warn(
        `[plitzi] The ${layer} sets the feature flag "${name}", which this space does not declare: the override is ignored. Declare the flag in the space, or remove the override.`
      )
    );
  }, [ignoredOverrides]);

  // --- state (canonical runtime/application state) ---
  const [state] = useCommonStore('runtime.state');
  const stateFields = useCallback(
    () => getPathsFromObeject(state).map(path => ({ path, name: `state.${path}` })),
    [state]
  );
  useRegisterSource({ id: 'global', source: 'state', name: 'State', fields: stateFields });
  useCommonStoreSync('runtime.sources.state', state);

  /**
   * --- host (whatever the application AROUND this space handed it)
   *
   * The counterpart of the `hostAction` step, and the half without which that step is a one-way shout: a shell
   * cannot list the host's screens unless the host can give it the list. Written into the store by whoever mounts
   * the SDK, published here beside every other source so a binding names it the same way.
   *
   * Empty for a space that IS the page — nobody is embedding it, so nobody has anything to hand it.
   */
  const [host] = useCommonStore('runtime.host');
  const hostFields = useCallback(() => getPathsFromObeject(host).map(path => ({ path, name: `host.${path}` })), [host]);
  useRegisterSource({ id: 'global', source: 'host', name: 'Host', fields: hostFields });
  useCommonStoreSync('runtime.sources.host', host);

  /**
   * --- theme
   *
   * For the area the SPACE paints in, not the surface around it: in the builder that is the canvas, which an author
   * switches without switching the editor, and on a published page there is no area and it is the page's own theme.
   * `resolved` is the one anything building a URL or comparing a colour wants — `system` is not a colour.
   */
  const { theme, resolvedTheme } = useTheme(SPACE_THEME_AREA);
  const themeValue = useMemo(() => ({ mode: theme, resolved: resolvedTheme }), [theme, resolvedTheme]);
  const themeFields = useCallback(
    () => getPathsFromObeject(themeValue).map(path => ({ path, name: `theme.${path}` })),
    [themeValue]
  );
  useRegisterSource({ id: 'global', source: 'theme', name: 'Theme', fields: themeFields });
  useCommonStoreSync('runtime.sources.theme', themeValue);

  /**
   * --- computed
   *
   * The values a space declares once and reads by name (`{{ computed.xp }}`) instead of repeating one expression in
   * every binding that shows it. Evaluated here, over the globals above, so they change when what they read changes.
   */
  const [definitions] = useCommonStore('schema.settings.computed');
  // The evaluation before this one, so what did not change keeps its object: written during render, like
  // `useStableValue`, and only with what the render produced.
  const previousComputed = useRef<Record<string, unknown> | undefined>(undefined);
  const computedValue = useMemo(
    () =>
      evaluateComputed(
        definitions ?? {},
        {
          variables: variablesValue,
          navigation: navigationValue,
          auth: authValue,
          state: state ?? {},
          host: host ?? {},
          theme: themeValue,
          flags: flagsValue
        },
        previousComputed.current
      ),
    [definitions, variablesValue, navigationValue, authValue, state, host, themeValue, flagsValue]
  );
  previousComputed.current = computedValue;
  const computedFields = useCallback(
    () => getPathsFromObeject(computedValue).map(path => ({ path, name: `computed.${path}` })),
    [computedValue]
  );
  useRegisterSource({ id: 'global', source: 'computed', name: 'Computed', fields: computedFields });
  useCommonStoreSync('runtime.sources.computed', computedValue);

  return children;
};

export default GlobalSources;
