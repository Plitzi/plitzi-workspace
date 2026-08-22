/* eslint-disable react-refresh/only-export-components */

import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { currentRscLocation } from '@plitzi/sdk-shared/server/rsc/refreshRsc';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import useApi from './hooks/useApi';
import useProviderPagination from './hooks/useProviderPagination';
import useProviderWrite from './hooks/useProviderWrite';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useRscData from '../../../Element/hooks/useRscData';
import RootElement from '../../../Element/RootElement';

import type { ProviderPagination } from './hooks/useProviderPagination';
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
  /**
   * Identifier of the server ACTION that feeds this provider instead of a connector, for the read a manifest
   * cannot express — two calls joined, a computed field, a shape that depends on who is looking.
   *
   * An element names one producer: the server resolves a connector when the element declares one and looks at
   * this only otherwise, so the panel clears whichever the author did not pick. The action is fed this page's
   * route and query params, and answers whatever its output step returns.
   */
  action?: string;
  /** Which of the connector's read endpoints to execute. Defaults to `list`. */
  endpoint?: string;
  /** Content type / collection read through the connector. */
  resource?: string;
  /** Records per window. Read server-side; a single-record provider is capped at one regardless. */
  limit?: string;
  /** Feeds a detail page: publishes `record` instead of `records`, filtered down to one entry. */
  singleRecord?: boolean;
  /** Field / operator / value rows applied to the connector query. Values are templates resolved server-side, so
   *  `{{routeParams.slug}}` is what turns a page into a detail page. */
  filters?: { field: string; operator: string; value: string }[];
  /** `url` pages through the address bar and stays indexable; `append` accumulates in the browser for a "load
   *  more" list. Append needs a server-driven provider — a client-side query has no window to ask the server for. */
  pagination?: ProviderPagination;
  pageParam?: string;
  /** Renders children while the first client-side request is still in flight, so a loading state can be bound. */
  renderWhileLoading?: boolean;
};

type ProviderSlice = {
  records?: unknown[];
  record?: unknown;
  pageInfo?: { page?: number };
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
  credentials = 'same-origin',
  singleRecord = false,
  pagination = 'none',
  pageParam = 'page',
  renderWhileLoading = false
}: ApiContainerProps) => {
  const {
    id,
    idRef,
    visible,
    definition: { label = 'Api Container', runtime }
  } = useElement();
  // A server-driven provider gets its data through the RSC payload: the request — and the credential behind it —
  // stays on the server, so neither the token nor the backend URL is ever part of what ships to the browser.
  const serverMode = runtime === 'server';
  const {
    loaded: rscResolved,
    stale: rscStale,
    location: rscLocation,
    elementData,
    refresh
  } = useRscData<Record<string, unknown>>();
  const sourceName = getSourceName('apiContainer', { idRef });
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [[routeParams, queryParams, navigate]] = useSdkStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.navigate'
  ]);

  const customHeaders = useMemo(() => {
    if (!accessToken) {
      return headers;
    }

    return { ...headers, Authorization: `Bearer ${accessToken}` };
  }, [headers, accessToken]);

  const apiEnabled = useMemo(() => {
    // `visible` is the whole ancestor chain, not just this provider's own state: a provider inside a hidden tab or
    // step is still mounted, and without this it kept requesting for a branch nobody is looking at.
    if (serverMode || !visible) {
      return false;
    }

    if (
      previewMode &&
      query &&
      (when === emptyObject || QueryBuilderEvaluator(when, { ...routeParams, ...queryParams }))
    ) {
      return true;
    }

    if (!previewMode && (query || (mockData && mockData !== '{}' && mockData !== emptyObject))) {
      return true;
    }

    return false;
  }, [serverMode, visible, previewMode, query, when, routeParams, queryParams, mockData]);

  const {
    isLoading: isApiLoading,
    data: apiData,
    refetch: apiRefetch,
    isSuccess,
    isError
  } = useApi({
    url: query,
    method,
    credentials,
    mock: !previewMode ? mockData : undefined,
    customHeaders,
    enabled: apiEnabled
  });

  /**
   * The payload in the store is for another page: this provider's own answer is still in flight.
   *
   * A route change in the browser renders the new page at once, and its data cannot possibly be there yet. Read
   * as "no slice for me", every binding under here resolves to nothing — and a binding with no value leaves its
   * element exactly as authored, which for a visibility binding means visible. That is a section drawn empty and
   * then corrected, and a link shown to somebody the server is about to say may not see it.
   *
   * `routeParams` and `queryParams` above are what re-render this on a navigation, so the comparison is made
   * against where the visitor is now.
   */
  const rscPending = serverMode && !!rscLocation && rscLocation !== currentRscLocation();

  // A server element whose key is missing from a payload that *did* arrive failed to resolve — its provider is
  // down, misconfigured or timed out. Falling back to mock data there would dress a production outage up as
  // content, so the two cases are kept apart: no payload at all means the builder, and that one does mock. A
  // payload for somewhere else is neither: nobody has answered for this element yet.
  const hasError = serverMode && rscResolved && !rscPending && elementData === null;

  // In the builder there is no `/_rsc` for the live space, so a server provider keeps rendering from its mock data.
  const data = useMemo<Record<string, unknown>>(() => {
    if (!serverMode) {
      return apiData ?? emptyObject;
    }

    if (elementData) {
      return elementData;
    }

    if (rscResolved) {
      return emptyObject;
    }

    if (typeof mockData !== 'string') {
      return mockData;
    }

    try {
      return JSON.parse(mockData || '{}') as Record<string, unknown>;
    } catch {
      return emptyObject;
    }
  }, [serverMode, apiData, elementData, rscResolved, mockData]);

  /**
   * A server provider is never "loading" in the client sense — it does not fetch — but between a route change and
   * the payload for the new page it has nothing to render with, and that is the same thing to a page: it renders
   * its children only when it can render them truthfully. `renderWhileLoading` is the opt-out, for a provider
   * whose children draw a skeleton from `isLoading`.
   */
  const isLoading = serverMode ? rscPending : isApiLoading;

  const refetch = useCallback(async () => {
    if (!serverMode) {
      apiRefetch();

      return;
    }

    await refresh([id]);
  }, [serverMode, apiRefetch, refresh, id]);

  const slice = data as ProviderSlice;
  const windowRecords = useMemo(() => (Array.isArray(slice.records) ? slice.records : []), [slice.records]);
  const { records, isLoadingMore, goToPage, loadMore } = useProviderPagination({
    elementId: id,
    mode: pagination,
    pageParam,
    records: windowRecords,
    page: slice.pageInfo?.page ?? 1,
    refresh,
    navigate
  });

  useEffect(() => {
    if (isLoading || !idRef) {
      return undefined;
    }

    if (isSuccess) {
      void interactionsManager.interactionTrigger(idRef, 'onApiSuccess', { url: query, method, ...data });
    } else if (isError) {
      void interactionsManager.interactionTrigger(idRef, 'onApiError', { url: query, method, ...data });
    }

    return undefined;
  }, [data, idRef, interactionsManager, isError, isLoading, isSuccess, method, query]);
  // The published slice, not the raw response: state travels with the data so an empty result, a failed provider
  // and an accumulated "load more" list are all readable through ordinary bindings, with no new slot mechanism.
  const publishedData = useMemo<Record<string, unknown>>(
    () => ({
      ...data,
      ...(Array.isArray(slice.records) ? { records } : emptyObject),
      isLoading: isLoading || isLoadingMore,
      isEmpty: singleRecord ? slice.record === undefined : records.length === 0,
      hasError,
      errorMessage: hasError ? 'The data provider could not be reached' : '',
      // A refresh that could not reach the server leaves what is on screen standing, which is the right thing to
      // do and a lie if nobody can say it: this is how a page tells its visitor the numbers are from before.
      isStale: serverMode && rscStale
    }),
    [data, slice.records, slice.record, records, isLoading, isLoadingMore, singleRecord, hasError, serverMode, rscStale]
  );

  const sourceFields = useCallback(
    () =>
      getPathsFromObeject(publishedData).reduce<SourceField[]>((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []),
    [publishedData]
  );

  useRegisterSource({ id, source: sourceName, name: label ? label : `API - ${id}`, fields: sourceFields });

  const { writeRecord } = useProviderWrite({
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
      },
      loadMore: {
        action: 'loadMore',
        title: `Load More ${label}`,
        type: 'callback',
        callback: loadMore,
        preview: {},
        params: {}
      },
      goToPage: {
        action: 'goToPage',
        title: `Go To Page ${label}`,
        type: 'callback',
        callback: ({ page }: { page?: string | number }) => goToPage(Number(page) || 1),
        preview: {},
        params: { page: { label: 'Page', defaultValue: '1', type: 'text' } }
      }
    };

    // Writes exist only for a server-driven provider: they go through the server, which owns the credential and
    // decides whether the connector allows the action at all.
    if (serverMode) {
      callbacks.writeRecord = {
        action: 'writeRecord',
        title: `Write Record ${label}`,
        type: 'callback',
        callback: writeRecord,
        preview: { action: 'create' },
        params: {
          action: { label: 'Endpoint', defaultValue: 'create', type: 'text' },
          recordId: { label: 'Record Id', defaultValue: '', type: 'text' }
        }
      };
    }

    return callbacks;
  }, [label, refetch, loadMore, goToPage, serverMode, writeRecord]);

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
    () => (sourceName ? { runtime: { sources: { [sourceName]: publishedData } } } : emptyObject),
    [publishedData, sourceName]
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__api-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      {(!isLoading || renderWhileLoading) && (
        <StoreProvider inherit="live" name={`Api:${id}`} value={storeContext}>
          {children}
        </StoreProvider>
      )}
    </RootElement>
  );
};

export default withElement(ApiContainer);

export { ApiContainer };
