/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import buildPageWindow from './buildPageWindow';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type PaginationPageInfo = {
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  page?: number;
  pageCount?: number;
  total?: number;
};

export type PaginationProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /** Bound from a provider: `{{apiContainer_posts.pageInfo}}`. Everything rendered here comes out of it. */
  pageInfo?: PaginationPageInfo;
  /** `pages` renders a numbered pager; `loadMore` renders a single button for an accumulating list. */
  mode?: 'pages' | 'loadMore';
  /** Query-string key to write in URL mode. Must match the provider's own page parameter. */
  pageParam?: string;
  /** With `url`, the pager navigates on its own. With `interaction`, it only fires `onPageChange` and the author
   *  wires it to the provider's `loadMore` / `goToPage` callback. */
  target?: 'url' | 'interaction';
  /** How many numbered pages to show around the current one. */
  windowSize?: number;
  previousLabel?: string;
  nextLabel?: string;
  loadMoreLabel?: string;
};

const buildPageUrl = (pageParam: string, page: number) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete(pageParam);
  } else {
    url.searchParams.set(pageParam, String(page));
  }

  return `${url.pathname}${url.search}`;
};

/**
 * Renders a pager over any `pageInfo`-shaped source.
 *
 * It never talks to a provider directly, which is what keeps it reusable: in URL mode it only navigates, and in
 * interaction mode it only announces the page the visitor asked for. A plugin that publishes the same shape gets a
 * working pager for free.
 */
const Pagination = ({
  ref,
  className = '',
  children,
  pageInfo = emptyObject,
  mode = 'pages',
  pageParam = 'page',
  target = 'url',
  windowSize = 5,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  loadMoreLabel = 'Load more'
}: PaginationProps) => {
  const { id } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [navigate] = useSdkStore('navigation.navigate');

  const page = pageInfo.page ?? 1;
  const pageCount = pageInfo.pageCount ?? 0;
  const hasPrevPage = pageInfo.hasPrevPage ?? page > 1;
  const hasNextPage = pageInfo.hasNextPage ?? false;

  const pages = useMemo(() => buildPageWindow(page, pageCount, windowSize), [page, pageCount, windowSize]);

  const goToPage = useCallback(
    (target_: number) => {
      const next = Math.max(target_, 1);
      if (id) {
        void interactionsManager.interactionTrigger(id, 'onPageChange', { page: next });
      }

      if (target === 'url') {
        navigate(buildPageUrl(pageParam, next));
      }
    },
    [id, interactionsManager, target, navigate, pageParam]
  );

  const handleClickPage = useCallback(
    (target_: number) => (e: MouseEvent) => {
      e.preventDefault();
      goToPage(target_);
    },
    [goToPage]
  );

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onPageChange: {
        action: 'onPageChange',
        title: 'On Page Change',
        type: 'trigger',
        params: {},
        preview: { page: '1' }
      }
    }),
    []
  );

  // In the builder there is no data behind the pager, so it renders its controls disabled rather than collapsing
  // to nothing — an element that disappears when deselected cannot be styled.
  const isIdle = pageCount === 0 && !hasNextPage && !hasPrevPage;

  return (
    <RootElement
      ref={ref}
      tag="nav"
      className={clsx('plitzi-component__pagination', className)}
      interactionTriggers={interactionTriggers}
    >
      {mode === 'loadMore' && (
        <button
          type="button"
          className="plitzi-component__pagination-more"
          disabled={!hasNextPage && previewMode}
          onClick={handleClickPage(page + 1)}
        >
          {loadMoreLabel}
        </button>
      )}
      {mode === 'pages' && (
        <>
          <button
            type="button"
            className="plitzi-component__pagination-prev"
            disabled={!hasPrevPage && previewMode}
            onClick={handleClickPage(page - 1)}
          >
            {previousLabel}
          </button>
          {pages.map(item => (
            <button
              type="button"
              key={item}
              className={clsx('plitzi-component__pagination-page', {
                'plitzi-component__pagination-page--current': item === page
              })}
              onClick={handleClickPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="plitzi-component__pagination-next"
            disabled={!hasNextPage && previewMode}
            onClick={handleClickPage(page + 1)}
          >
            {nextLabel}
          </button>
        </>
      )}
      {!previewMode && isIdle && <span className="plitzi-component__pagination-hint">Bind pageInfo</span>}
      {children}
    </RootElement>
  );
};

export default withElement(Pagination);

export { Pagination };
