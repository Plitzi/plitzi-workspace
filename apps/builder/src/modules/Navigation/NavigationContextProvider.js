// Packages
import React, { useMemo, use, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import get from 'lodash/get';

// Monorepo
import UserContext from '@plitzi/sdk-auth/UserContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import useNavigation from '@plitzi/sdk-navigation/useNavigation';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const NavigationContextProvider = props => {
  const { previewMode = false, children } = props;
  const { pages, pageDefinitions, pageFolders } = use(SchemaMainContext);
  const { authenticated } = use(UserContext);
  const { queryParams, hostname, location } = useNavigation();
  const navigate = useNavigate();
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;

  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, previewMode),
    [pages, pageFolders, authenticated, previewMode]
  );

  const matchResult = useMemo(
    () => matchRoutePath(paths, location.pathname, authenticated),
    [paths, location.pathname, authenticated]
  );

  const { action, pageId: currentPageId, pathMatch } = matchResult;
  const routeParams = useMemo(() => {
    const path = paths.find(path => path.pageId === currentPageId && !path.isRaw);
    if (!path) {
      return get(pathMatch, 'params', {});
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...get(pathMatch, 'params', {})
    };
  }, [paths, pathMatch]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const handleNavigate = useCallback(
    (url, isExternal) => {
      if (isExternal && typeof window !== 'undefined') {
        window.location.href = url;

        return;
      }

      const page = get(pageDefinitionsRef, `current.${url}`);
      if (!page) {
        navigate(url);

        return;
      }

      const slug = get(page, 'attributes.slug');
      if (slug || slug === '') {
        navigate(slug);

        return;
      }

      const isHome = get(page, 'attributes.default');
      if (isHome) {
        navigate('/');

        return;
      }

      navigate(`/${url}`);
    },
    [navigate]
  );

  const navigationValue = useMemo(
    () => ({ navigate: handleNavigate, urlSearchParams, routeParams, queryParams, hostname, currentPageId }),
    [handleNavigate, urlSearchParams, routeParams, queryParams, currentPageId, location]
  );

  if (action.type === 'redirect') {
    return <Navigate to={action.path} replace />;
  }

  if (action.type === 'notFound') {
    // @todo: In the future this should navigate to page 404
    // return <Navigate to="/not-found" replace />;
    return 'Not Found';
  }

  if (action.type === 'accessDenied') {
    // @todo: In the future this should navigate to page 403
    // return <Navigate to="/unauthorized" replace />;
    return 'Access Denied';
  }

  if (!currentPageId) {
    // Rare scenario where pages are incorrectly configured and no default page is found
    return 'Page Not Found';
  }

  return <NavigationContext value={navigationValue}>{children}</NavigationContext>;
};

export default NavigationContextProvider;
