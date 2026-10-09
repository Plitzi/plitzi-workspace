/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import buildPageWindow from './buildPageWindow';
import declaration from './declaration';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
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
  /**
   * The pager's name, in the site's language: a page often has more than one navigation, and a screen reader or a
   * browser agent lists them by name.
   */
  label?: string;
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
  loadMoreLabel = 'Load more',
  label = 'Pagination'
}: PaginationProps) => {
  const {
    id,
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
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

  // In the builder there is no data behind the pager, so it renders its controls disabled rather than collapsing
  // to nothing — an element that disappears when deselected cannot be styled.
  const isIdle = pageCount === 0 && !hasNextPage && !hasPrevPage;

  return (
    <RootElement
      ref={ref}
      tag="nav"
      aria-label={label || undefined}
      className={clsx('plitzi-component__pagination', className)}
      interactionTriggers={declaration.triggers}
    >
      {mode === 'loadMore' && (
        <button
          type="button"
          className={clsx('plitzi-component__pagination-more', styleSelectors.loadMore)}
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
            className={clsx('plitzi-component__pagination-prev', styleSelectors.previous)}
            disabled={!hasPrevPage && previewMode}
            onClick={handleClickPage(page - 1)}
          >
            {previousLabel}
          </button>
          {pages.map(item => (
            <button
              type="button"
              key={item}
              className={clsx(
                'plitzi-component__pagination-page',
                { 'plitzi-component__pagination-page--current': item === page },
                styleSelectors.page
              )}
              aria-current={item === page ? 'page' : undefined}
              onClick={handleClickPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className={clsx('plitzi-component__pagination-next', styleSelectors.next)}
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
