/* eslint-disable react-refresh/only-export-components */
import { Helmet } from '@dr.pogodin/react-helmet';
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useLayoutChain from '../../../Element/hooks/useLayoutChain';
import LayoutBody from '../../../Element/LayoutBody';
import RootElement from '../../../Element/RootElement';
import LayoutContainer from '../LayoutContainer';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { ElementLayout, InteractionCallback } from '@plitzi/sdk-shared';
import type { LayoutLink } from '@plitzi/sdk-shared/schema/layoutChain';
import type { ReactNode, RefObject } from 'react';

export type PageProps = {
  ref?: RefObject<HTMLElement>;
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
  className?: string;
  layout?: string;
  layoutContainer?: string;
  children?: ReactNode;
};

/** One shell of the chain, with what its elements carry: the same object for as long as the chain is the same. */
type ChainLink = LayoutLink & { plitziElementLayout: ElementLayout };

const toLinks = (chain: LayoutLink[]): ChainLink[] =>
  chain.map(link => ({ ...link, plitziElementLayout: { containerId: link.slot, rootId: link.slot, type: 'layout' } }));

/**
 * The page's body inside its shells, the outermost one at the top.
 *
 * Built from the OUTSIDE in, whatever depth each page has: the platform shell is the same element at the same position
 * for a page that sits in it directly and for one that sits in the analytics shell inside it, so navigating between
 * the two keeps it mounted and swaps only what is inside. Each shell is keyed by its slot, not by the page — two pages
 * naming the same shell keep it across a navigation, and a different shell remounts rather than re-pointing the same
 * node at another element id.
 *
 * The body reaches each slot through `LayoutBody`, never through the props every element of the shell receives: what
 * those carry is the link, which does not change with the page, so a navigation renders the slot and not the shell.
 */
const wrapInLayouts = (links: ChainLink[], pageId: string, children: ReactNode): ReactNode =>
  links.reduce<ReactNode>(
    (body, { layout, slot, plitziElementLayout }) => (
      <LayoutBody key={slot} body={body}>
        {/* Everything in a shell belongs to the page it is rendered for, which is what a binding resolves against. */}
        <LayoutContainer internalProps={{ id: layout, rootId: pageId, plitziElementLayout }} />
      </LayoutBody>
    ),
    children
  );

const Page = ({
  ref,
  seoEnabled = false,
  seoPageTitle = 'Title',
  seoPageDescription = 'Description',
  className = '',
  layout = '',
  layoutContainer = '',
  children
}: PageProps) => {
  const { id } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [[routeParams, queryParams]] = useSdkStore(['navigation.routeParams', 'navigation.queryParams']);

  const layoutChain = useLayoutChain(layout, layoutContainer);
  const links = useMemo(() => toLinks(layoutChain), [layoutChain]);
  const body = useMemo(() => wrapInLayouts(links, id, children), [links, id, children]);

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onPageLoad: {
        action: 'onPageLoad',
        title: 'On Page Load',
        type: 'trigger',
        params: {
          // pageId: { canBind: false, defaultValue: '', type: 'text', label: 'Page ID' },
          // routeParams: { canBind: false, defaultValue: '', type: 'text', label: 'Route Params' },
          // queryParams: { canBind: false, defaultValue: '', type: 'text', label: 'Query params' }
        },
        preview: { pageId: '', routeParams: '', queryParams: '' }
      }
    }),
    []
  );

  /**
   * Announced once the commit that mounted this page has finished, not in the middle of it.
   *
   * The global sources — `actions`, `state`, the rest — register what they can do from effects of their own, and
   * they sit ABOVE the page: React runs a parent's effect after its children's, so a page firing this synchronously
   * announces itself to a manager that has not been told `actions.runServerAction` exists yet. The flow then ran,
   * found nothing registered and did nothing, on the first load only — which is the load an `onPageLoad` flow is
   * written for. A microtask lands after the whole effect flush, and on a navigation nothing has changed for it.
   */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      void interactionsManager.interactionTrigger(id, 'onPageLoad', { pageId: id, routeParams, queryParams });
    });

    return () => {
      cancelled = true;
    };
  }, [id, interactionsManager, queryParams, routeParams]);

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__page', className)}
      interactionTriggers={interactionTriggers}
    >
      {seoEnabled && previewMode && (
        <Helmet>
          {!!seoPageTitle && <title>{seoPageTitle}</title>}
          {!!seoPageDescription && <meta name="description" content={seoPageDescription} />}
        </Helmet>
      )}
      {body}
    </RootElement>
  );
};

export default withElement(Page);

export { Page };
