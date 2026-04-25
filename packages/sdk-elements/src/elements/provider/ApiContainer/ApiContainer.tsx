/* eslint-disable react-refresh/only-export-components */

import { get } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo } from 'react';

import useElement from '@plitzi/sdk-shared/elements/hooks/useElement';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useApi from './hooks/useApi';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { SourceField, InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ApiContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  query?: string;
  method?: 'get' | 'post' | 'put' | 'delete' | 'patch';
  accessToken?: string;
  when?: RuleGroup;
  headers?: Record<string, string>;
  mockData?: Record<string, unknown> | string;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  credentials?: RequestCredentials;
};

const ApiContainer = ({
  ref,
  className = '',
  children,
  query = '',
  method = 'get',
  accessToken = '',
  when = emptyObject as RuleGroup,
  headers = emptyObject,
  mockData = '{}',
  subType = 'div',
  credentials = 'same-origin'
}: ApiContainerProps) => {
  const {
    id,
    definition: { label = 'Api Container' }
  } = useElement();
  const {
    settings: { previewMode, debugMode },
    contexts: { DataSourceContext, NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const { useDataSource } = use(DataSourceContext);
  const { routeParams, queryParams } = use(NavigationContext);
  const queryCompiled = useMemo(() => {
    if (!query) {
      return '';
    }

    try {
      const params = { ...queryParams, ...routeParams };
      // Check if Tokens required are defined first, if not skip fetch
      if (debugMode) {
        [...query.matchAll(/{{([ ]+|)(?<token>[a-zA-Z0-9-_:*/]+)([ ]+|)}}/gim)].forEach(({ groups }) => {
          const token = groups?.token.trim();
          if (!token || !get(params, token)) {
            console.log(`Token ${token} is required`);
          }
        });
      }

      const result = processTwig(query, params, true);
      if (typeof result !== 'string') {
        return query;
      }

      return result;
    } catch (e) {
      console.error((e as Error).message);
    }

    return '';
  }, [query, queryParams, routeParams, debugMode]);

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
      (when === emptyObject || QueryBuilderEvaluator(when, { ...routeParams, ...queryParams }))
    ) {
      return true;
    }

    if (!previewMode && (queryCompiled || (mockData && mockData !== '{}' && mockData !== emptyObject))) {
      return true;
    }

    return false;
  }, [previewMode, queryCompiled, when, routeParams, queryParams, mockData]);

  const { isLoading, data, refetch, isSuccess, isError } = useApi({
    url: queryCompiled,
    method,
    credentials,
    mock: !previewMode ? mockData : undefined,
    customHeaders,
    enabled: apiEnabled
  });

  useEffect(() => {
    if (isLoading) {
      return undefined;
    }

    if (isSuccess) {
      void interactionsManager.interactionTrigger(id, 'onApiSuccess', { url: queryCompiled, method, ...data });
    } else if (isError) {
      void interactionsManager.interactionTrigger(id, 'onApiError', { url: queryCompiled, method, ...data });
    }

    return undefined;
  }, [data, id, interactionsManager, isError, isLoading, isSuccess, method, queryCompiled]);

  const sourceFields = useCallback(
    () =>
      getPathsFromObeject(data).reduce<SourceField[]>((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []),
    [data]
  );

  const [ApiContainerContext] = useDataSource({
    id,
    source: `apiContainer_${id}`,
    mode: 'write',
    name: label ? label : `API - ${id}`,
    fields: sourceFields
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    return {
      performQuery: {
        action: 'performQuery',
        title: `Perform Query ${label}`,
        type: 'callback',
        callback: refetch,
        preview: {},
        params: {}
      }
    };
  }, [label, refetch]);

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onApiError: {
        action: 'onApiError',
        title: 'On Api Error',
        type: 'trigger',
        params: {},
        preview: { url: '', method: '', status: '', data: '' }
      },
      onApiSuccess: {
        action: 'onApiSuccess',
        title: 'On Api Success',
        type: 'trigger',
        params: {},
        preview: { url: '', method: '', status: '', data: '' }
      }
    }),
    []
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__api-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <ApiContainerContext value={data}>{!isLoading && children}</ApiContainerContext>
    </RootElement>
  );
};

export default withElement(ApiContainer);

export { ApiContainer };
