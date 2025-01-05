// Packages
import React, { useCallback, use, useEffect, useMemo } from 'react';
import classNames from 'classnames';
import Handlebars from 'handlebars';
import get from 'lodash/get.js';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui/QueryBuilder/helpers/QueryBuilderEvaluator.es';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement.js';
import withElement from '../../../Element/hocs/withElement.js';
import useApi from './hooks/useApi.js';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 *   query: string;
 *   method: 'get' | 'post' | 'put' | 'delete' | 'patch';
 *   accessToken: string;
 *   when: object;
 *   headers: object;
 *   mockData: object;
 *   subType: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
 * }} props
 * @returns {React.ReactElement}
 */
const ApiContainer = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
    children,
    query = '',
    method = 'get',
    accessToken = '',
    when = emptyObject,
    headers = emptyObject,
    mockData = '{}',
    subType = 'div'
  } = props;
  const { id } = internalProps;
  const {
    settings: { previewMode, debugMode },
    contexts: { DataSourceContext, NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const { useDataSource } = use(DataSourceContext);
  const { routeParams, queryParams } = use(NavigationContext);
  const queryCompiled = useMemo(() => {
    if (!query) {
      return '';
    }

    try {
      const handleBarsParams = { ...queryParams, ...routeParams };
      // Check if Tokens required are defined first, if not skip fetch
      if (debugMode) {
        [...query.matchAll(/{{([ ]+|)(?<token>[a-zA-Z0-9-_:*/]+)([ ]+|)}}/gim)].forEach(({ groups }) => {
          const token = groups.token.trim();
          if (!get(handleBarsParams, token)) {
            console.log(`Token ${token} is required`);
          }
        });
      }

      const template = Handlebars.compile(query);

      return template(handleBarsParams);
    } catch (e) {
      console.error(e.message);
    }

    return '';
  }, [routeParams, queryParams, query]);

  const customHeaders = useMemo(() => {
    if (!accessToken) {
      return headers;
    }

    return { ...headers, Authorization: `Bearer ${accessToken}` };
  }, [headers, accessToken]);

  const apiEnabled = useMemo(() => {
    if (
      previewMode &&
      queryCompiled &&
      (!when || when === emptyObject || QueryBuilderEvaluator(when, { ...routeParams, ...queryParams }))
    ) {
      return true;
    }

    if (!previewMode && (queryCompiled || (mockData && mockData !== '{}' && mockData !== emptyObject))) {
      return true;
    }

    return false;
  }, [previewMode, when, routeParams, queryParams, queryCompiled]);

  const { isLoading, data, refetch, isSuccess, isError } = useApi({
    url: queryCompiled,
    method,
    mock: !previewMode ? mockData : undefined,
    customHeaders,
    enabled: apiEnabled
  });

  useEffect(() => {
    if (isLoading) {
      return undefined;
    }

    if (isSuccess) {
      interactionsManager.interactionTrigger(id, 'onApiSuccess', { url: queryCompiled, method, ...data });
    } else if (isError) {
      interactionsManager.interactionTrigger(id, 'onApiError', { url: queryCompiled, method, ...data });
    }

    return undefined;
  }, [isLoading]);

  const sourceFields = useCallback(
    async () =>
      getPathsFromObeject(data).reduce((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []),
    [fetch, queryCompiled, method, data]
  );

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `Api - ${id}`),
    [id, internalProps?.definition?.label]
  );

  const [ApiContainerContext] = useDataSource({
    id,
    source: `apiContainer_${id}`,
    name: sourceName,
    fields: sourceFields
  });

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Api Container');

    return { performQuery: { title: `Perform Query ${label}`, callback: refetch, preview: {}, params: {} } };
  }, [refetch, internalProps?.definition?.label]);

  const interactionTriggers = useMemo(
    () => ({
      onApiError: { title: 'On Api Error', params: {}, preview: { url: '', method: '', status: '', data: '' } },
      onApiSuccess: { title: 'On Api Success', params: {}, preview: { url: '', method: '', status: '', data: '' } }
    }),
    []
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__api-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <ApiContainerContext value={data}>{!isLoading && children}</ApiContainerContext>
      {/* {!isLoading && isError && previewMode && (
        <div className="plitzi-component__api-container-error">{JSON.stringify(data?.data ?? '')}</div>
      )} */}
    </RootElement>
  );
};

export default withElement(ApiContainer);

export { ApiContainer };
