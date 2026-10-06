/* eslint-disable react-refresh/only-export-components */

import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useServerQuery } from '@plitzi/sdk-shared/queries';
import { currentRscLocation } from '@plitzi/sdk-shared/server/rsc/refreshRsc';
import { useCommonStore, useSdkStore } from '@plitzi/sdk-shared/store';

import declaration from './declaration';
import { isEmptyAnswer } from './helpers/isEmptyAnswer';
import { childrenWhile } from './helpers/loadingSlot';
import providerOutcome from './helpers/providerOutcome';
import { queryInputOf } from './helpers/queryInput';
import { serverMock } from './helpers/serverMock';
import useApi, { DEFAULT_GC_TIME, DEFAULT_STALE_TIME } from './hooks/useApi';
import useAutoRefresh from './hooks/useAutoRefresh';
import useInputRefresh from './hooks/useInputRefresh';
import useProviderPagination from './hooks/useProviderPagination';
import useProviderWrite from './hooks/useProviderWrite';
import pathFields from '../../../dataSource/pathFields';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useRscData from '../../../Element/hooks/useRscData';
import RootElement from '../../../Element/RootElement';

import type { ProviderPagination } from './hooks/useProviderPagination';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
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
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure' | '';
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
  /**
   * What a server provider asks its action with, on top of the page's own route and query params — a search, a filter.
   *
   * Saved, it is what the page server resolves the first paint with. Bound — to a state the visitor changes — every
   * change asks again with the new value, the way a bound `query` does for a browser provider; `reloadApi` with an
   * input asks once.
   */
  input?: Record<string, unknown> | string;
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
  /**
   * The id of a child shown in place of the others until the first answer arrives — a skeleton of what is coming — and
   * gone after it. In the builder every child shows, so the slot can be edited beside what it stands for.
   */
  loadingSlot?: string;
  /**
   * Keep a browser request's answer in the page's query cache, shared with every provider asking the same thing.
   * Off by default: an author opts in knowing the page may show an answer up to `staleTime` old.
   */
  cache?: boolean;
  /**
   * With `cache`: seconds an answer is served without asking again. A stale answer is still shown while the new one
   * is fetched; `0` asks on every mount. A text field in the builder, hence the string.
   */
  staleTime?: number | string;
  /** With `cache`: seconds an answer nobody renders is kept, so coming back within it paints at once. */
  gcTime?: number | string;
  /**
   * Asks again on its own every this many seconds — for a page showing something that keeps moving: a queue, a
   * feed, a status board. Off (`0`) by default.
   *
   * The same refresh `performQuery` runs, for either runtime: a browser request is re-sent, a server provider
   * asks the server for its own slice again. Skipped while the tab is hidden and never stacked on one still in
   * flight. A text field in the builder, hence the string.
   */
  refreshSeconds?: number | string;
};

type ProviderSlice = {
  records?: unknown[];
  record?: unknown;
  data?: unknown;
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
  subType = '',
  credentials = 'same-origin',
  singleRecord = false,
  pagination = 'none',
  pageParam = 'page',
  renderWhileLoading = false,
  loadingSlot = '',
  cache = false,
  staleTime = DEFAULT_STALE_TIME,
  gcTime = DEFAULT_GC_TIME,
  refreshSeconds = 0,
  connector = '',
  action = '',
  input
}: ApiContainerProps) => {
  const {
    id,
    visible,
    definition: { label = 'Api Container', runtime, items }
  } = useElement();
  // A server-driven provider gets its data through the RSC payload: the request — and the credential behind it —
  // stays on the server, so neither the token nor the backend URL is ever part of what ships to the browser.
  const serverMode = runtime === 'server';
  const {
    loaded: rscResolved,
    stale: rscStale,
    location: rscLocation,
    elementData,
    refreshing: rscRefreshing,
    refresh,
    cancel: cancelRsc
  } = useRscData<Record<string, unknown>>();
  const sourceName = getSourceName(declaration.sourceType, id);
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

  // An api container is named by its id: a flow invalidating "these providers" names them the way it names anything.
  const queryTags = useMemo(() => [id], [id]);
  const {
    isLoading: isApiInitialLoad,
    isFetching: isApiFetching,
    data: apiData,
    refetch: apiRefetch,
    cancel: apiCancel,
    isSuccess,
    isError
  } = useApi({
    url: query,
    method,
    credentials,
    mock: !previewMode ? mockData : undefined,
    customHeaders,
    enabled: apiEnabled,
    cache,
    staleTime,
    gcTime,
    tags: queryTags
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

  // A server provider that only has a `query` is answered as a browser request is: `{ status, data }` (`serverMock`).
  const queryShaped = serverMode && !connector && !action;

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

    return serverMock(mockData, queryShaped);
  }, [serverMode, apiData, elementData, rscResolved, mockData, queryShaped]);

  /**
   * A server provider is never "loading" in the client sense — it does not fetch — but between a route change and
   * the payload for the new page it has nothing to render with, and that is the same thing to a page: it renders
   * its children only when it can render them truthfully. `renderWhileLoading` is the opt-out, for a provider
   * whose children draw a skeleton from `isLoading`.
   */
  const isLoading = serverMode ? rscPending || rscRefreshing : isApiFetching;

  /**
   * Nothing to render with YET — as opposed to a refresh of something already on screen.
   *
   * Only this gates the children. A `performQuery` used to unmount them for the length of the request: the
   * provider's subtree collapsed to zero height, the browser clamped the scroll to the top of the shortened
   * page, and everything came back a frame later. `isLoading` stays "a request is in flight" because that is
   * what a bound spinner means, and it is still what a route change reports for a server provider — there the
   * payload really is for another page, and rendering children would draw the previous visitor's content.
   */
  const isInitialLoad = serverMode ? rscPending : isApiInitialLoad;

  /**
   * What the last query asked a server provider for — a search, a filter — and asks again with every page after it:
   * "load more" of a search is more of the search, not more of everything.
   */
  const queryInput = useRef<Record<string, string>>({});
  const refreshWithInput = useCallback(
    (ids?: string[], params?: Record<string, string>) => refresh(ids, { ...queryInput.current, ...params }),
    [refresh]
  );

  const askAgain = useCallback(
    async (fresh: boolean) => {
      if (!serverMode) {
        apiRefetch();

        return;
      }

      await refresh([id], queryInput.current, { fresh });
    },
    [serverMode, apiRefetch, refresh, id]
  );

  /**
   * Asks again — a server provider around every cache on the way, since whoever asks for a refresh (a reload, a
   * write) wants what the server holds now, not the answer the browser or the page server kept for a while.
   */
  const refetch = useCallback(() => askAgain(true), [askAgain]);

  /**
   * A timer's refresh goes through the caches: their lifetime is how stale a deployment lets an answer be, and a page
   * polling around them would turn every visitor's timer into a resolution on the server.
   */
  const poll = useCallback(() => askAgain(false), [askAgain]);

  useServerQuery({
    id,
    url: queryShaped && query ? query : undefined,
    enabled: serverMode && rscResolved,
    active: visible,
    refresh: refetch
  });

  /** A query asked for with `input`: kept, then asked — from its first page. */
  const performQuery = useCallback(
    async ({ input: asked }: { input?: unknown } = {}) => {
      const given = queryInputOf(asked);
      if (given) {
        queryInput.current = given;
      }

      await refetch();
    },
    [refetch]
  );

  /** The visitor stopped waiting: the request in flight is dropped — on the server too — and what is shown stays. */
  const cancelQuery = useCallback(() => {
    if (serverMode) {
      cancelRsc();

      return;
    }

    apiCancel();
  }, [serverMode, cancelRsc, apiCancel]);

  const [savedInput] = useCommonStore(`schema.flat.${id}.attributes.input`, { mode: 'mount' });
  useInputRefresh({ enabled: serverMode && rscResolved, input, savedInput, performQuery });

  /**
   * Only a provider that can already fetch: a server one once a live payload has answered for this page (the
   * builder has no `/_rsc` to ask), a browser one when its own request is enabled.
   */
  useAutoRefresh({
    seconds: refreshSeconds,
    enabled: visible && (serverMode ? rscResolved && !rscPending : apiEnabled),
    refresh: poll
  });

  const slice = data as ProviderSlice;
  const windowRecords = useMemo(() => (Array.isArray(slice.records) ? slice.records : []), [slice.records]);
  const { records, isLoadingMore, goToPage, loadMore } = useProviderPagination({
    elementId: id,
    mode: pagination,
    pageParam,
    records: windowRecords,
    page: slice.pageInfo?.page ?? 1,
    refresh: refreshWithInput,
    navigate
  });

  const outcome = providerOutcome({ serverMode, isSuccess, isError, rscResolved, rscPending, elementData });

  /**
   * Fired per answer, for either runtime — `data` is a new object each time one lands, so a refresh (a flow's
   * `performQuery`, or `refreshSeconds`) fires the trigger again, the same as a browser refetch does.
   *
   * Once per answer and no more: a request cancelled, or one whose loading flag came and went with nothing new,
   * leaves the same answer standing, and firing for it again would run its flow a second time.
   */
  const announced = useRef<{ data: unknown; outcome: string } | undefined>(undefined);
  useEffect(() => {
    if (isLoading || !id || !outcome) {
      return undefined;
    }

    if (announced.current?.data === data && announced.current.outcome === outcome) {
      return undefined;
    }

    announced.current = { data, outcome };
    void interactionsManager.interactionTrigger(id, outcome === 'success' ? 'onApiSuccess' : 'onApiError', {
      url: query,
      method,
      ...data
    });

    return undefined;
  }, [data, id, interactionsManager, isLoading, method, outcome, query]);
  // The published slice, not the raw response: state travels with the data so an empty result, a failed provider
  // and an accumulated "load more" list are all readable through ordinary bindings, with no new slot mechanism.
  const publishedData = useMemo<Record<string, unknown>>(
    () => ({
      ...data,
      ...(Array.isArray(slice.records) ? { records } : emptyObject),
      isLoading: isLoading || isLoadingMore,
      isEmpty: isEmptyAnswer(slice, records, singleRecord),
      hasError,
      errorMessage: hasError ? 'The data provider could not be reached' : '',
      // A refresh that could not reach the server leaves what is on screen standing, which is the right thing to
      // do and a lie if nobody can say it: this is how a page tells its visitor the numbers are from before.
      isStale: serverMode && rscStale
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, slice.records, slice.record, records, isLoading, isLoadingMore, singleRecord, hasError, serverMode, rscStale]
  );

  const sourceFields = useCallback(() => pathFields(publishedData), [publishedData]);

  useRegisterSource({ id, source: sourceName, name: label ? label : `API - ${id}`, fields: sourceFields });

  const { writeRecord } = useProviderWrite({
    elementId: id,
    enabled: serverMode,
    onDone: refetch
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    const callbacks: Record<string, InteractionCallback> = {
      performQuery: { ...declaration.callbacks.performQuery, title: `Perform Query ${label}`, callback: performQuery },
      cancelQuery: { ...declaration.callbacks.cancelQuery, title: `Cancel Query ${label}`, callback: cancelQuery },
      loadMore: { ...declaration.callbacks.loadMore, title: `Load More ${label}`, callback: loadMore },
      goToPage: {
        ...declaration.callbacks.goToPage,
        title: `Go To Page ${label}`,
        callback: ({ page }: { page?: string | number }) => goToPage(Number(page) || 1)
      }
    };

    // Writes exist only for a server-driven provider: they go through the server, which owns the credential and
    // decides whether the connector allows the action at all.
    if (serverMode) {
      callbacks.writeRecord = {
        ...declaration.callbacks.writeRecord,
        title: `Write Record ${label}`,
        callback: writeRecord
      };
    }

    return callbacks;
  }, [label, performQuery, cancelQuery, loadMore, goToPage, serverMode, writeRecord]);

  const shown = useMemo(
    () => (loadingSlot && previewMode ? childrenWhile(children, loadingSlot, isInitialLoad) : children),
    [children, isInitialLoad, loadingSlot, previewMode]
  );

  const storeContext = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: publishedData } } } : emptyObject),
    [publishedData, sourceName]
  );

  return (
    <RootElement
      ref={ref}
      tag={!previewMode && !items?.length ? 'div' : subType}
      className={clsx('plitzi-component__api-container', className)}
      interactionTriggers={declaration.triggers}
      interactionCallbacks={interactionCallbacks}
    >
      {(!isInitialLoad || renderWhileLoading || loadingSlot) && (
        <StoreProvider inherit="live" name={`Api:${id}`} value={storeContext}>
          {shown}
        </StoreProvider>
      )}
    </RootElement>
  );
};

export default withElement(ApiContainer);

export { ApiContainer };
