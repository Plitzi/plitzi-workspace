/* eslint-disable react-refresh/only-export-components */

import { get } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useApi from './hooks/useApi';
import useProviderWrite from './hooks/useProviderWrite';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useRscData from '../../../Element/hooks/useRscData';
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
  /** Client-side bearer token. Meant to arrive through a binding (e.g. the signed-in user's token), which resolves
   *  at runtime and never enters the schema. A static value typed here is persisted and therefore public — use a
   *  server connector (`runtime: 'server'`) for anything secret. */
  accessToken?: string;
  when?: RuleGroup;
  headers?: Record<string, string>;
  mockData?: Record<string, unknown> | string;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
  credentials?: RequestCredentials;
  /** Identifier of the server-side connector that feeds this provider. Only meaningful with `runtime: 'server'`. */
  connector?: string;
  /** Content type / collection read through the connector. */
  resource?: string;
  singleRecord?: boolean;
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
    idRef,
    definition: { label = 'Api Container', runtime }
  } = useElement();
  // A server-driven provider gets its data through the RSC payload: the request — and the credential behind it —
  // stays on the server, so neither the token nor the backend URL is ever part of what ships to the browser.
  const serverMode = runtime === 'server';
  const { elementData, refresh } = useRscData<Record<string, unknown>>();
  const sourceName = getSourceName('apiContainer', { idRef });
  const {
    settings: { previewMode, debugMode },
    contexts: { NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
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
    if (serverMode) {
      return false;
    }

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
  }, [serverMode, previewMode, queryCompiled, when, routeParams, queryParams, mockData]);

  const {
    isLoading: isApiLoading,
    data: apiData,
    refetch: apiRefetch,
    isSuccess,
    isError
  } = useApi({
    url: queryCompiled,
    method,
    credentials,
    mock: !previewMode ? mockData : undefined,
    customHeaders,
    enabled: apiEnabled
  });

  // In the builder there is no `/_rsc` for the live space, so a server provider keeps rendering from its mock data.
  const data = useMemo<Record<string, unknown>>(() => {
    if (!serverMode) {
      return apiData ?? emptyObject;
    }

    if (elementData) {
      return elementData;
    }

    if (typeof mockData !== 'string') {
      return mockData;
    }

    try {
      return JSON.parse(mockData || '{}') as Record<string, unknown>;
    } catch {
      return emptyObject;
    }
  }, [serverMode, apiData, elementData, mockData]);

  const isLoading = serverMode ? false : isApiLoading;

  const refetch = useCallback(async () => {
    if (!serverMode) {
      apiRefetch();

      return;
    }

    await refresh?.([id]);
  }, [serverMode, apiRefetch, refresh, id]);

  useEffect(() => {
    if (isLoading || !idRef) {
      return undefined;
    }

    if (isSuccess) {
      void interactionsManager.interactionTrigger(idRef, 'onApiSuccess', { url: queryCompiled, method, ...data });
    } else if (isError) {
      void interactionsManager.interactionTrigger(idRef, 'onApiError', { url: queryCompiled, method, ...data });
    }

    return undefined;
  }, [data, idRef, interactionsManager, isError, isLoading, isSuccess, method, queryCompiled]);

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

  useRegisterSource({ id, source: sourceName, name: label ? label : `API - ${id}`, fields: sourceFields });

  const { createRecord, updateRecord, removeRecord } = useProviderWrite({
    elementId: id,
    enabled: serverMode,
    onDone: refetch
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    const callbacks: Record<string, InteractionCallback> = {
      performQuery: {
        action: 'performQuery',
        title: `Perform Query ${label}`,
        type: 'callback',
        callback: refetch,
        preview: {},
        params: {}
      }
    };

    // Writes exist only for a server-driven provider: they go through the server, which owns the credential and
    // decides whether the connector allows the action at all.
    if (serverMode) {
      callbacks.createRecord = {
        action: 'createRecord',
        title: `Create Record ${label}`,
        type: 'callback',
        callback: createRecord,
        preview: {},
        params: {}
      };
      callbacks.updateRecord = {
        action: 'updateRecord',
        title: `Update Record ${label}`,
        type: 'callback',
        callback: updateRecord,
        preview: {},
        params: {}
      };
      callbacks.removeRecord = {
        action: 'removeRecord',
        title: `Remove Record ${label}`,
        type: 'callback',
        callback: removeRecord,
        preview: {},
        params: {}
      };
    }

    return callbacks;
  }, [label, refetch, serverMode, createRecord, updateRecord, removeRecord]);

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

  const storeContext = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: data } } } : emptyObject),
    [data, sourceName]
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__api-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      <StoreProvider inherit="live" name={`Api:${id}`} value={storeContext}>
        {!isLoading && children}
      </StoreProvider>
    </RootElement>
  );
};

export default withElement(ApiContainer);

export { ApiContainer };
