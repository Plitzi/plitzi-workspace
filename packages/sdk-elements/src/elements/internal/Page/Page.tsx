/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import { InteractionsContext } from '@plitzi/sdk-interactions';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useRenderSettings, useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useLayoutChain from '../../../Element/hooks/useLayoutChain';
import LayoutBody from '../../../Element/LayoutBody';
import RootElement from '../../../Element/RootElement';
import LayoutContainer from '../LayoutContainer';
import declaration from './declaration';
import PageHead from './PageHead';
import PageWithheld from './PageWithheld';

import type { DocumentScroll } from './declaration';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { ElementLayout } from '@plitzi/sdk-shared';
import type { LayoutLink, OgType, PageAccess, PageWithheld as WithheldReason } from '@plitzi/sdk-shared/schema';
import type { ReactNode, RefObject } from 'react';

export type PageProps = {
  ref?: RefObject<HTMLElement>;
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
  /** For search engines: `noindex`, `noindex, nofollow`. */
  seoRobots?: string;
  /** The page's JSON-LD, each object as it is written into the head. */
  seoStructuredData?: Record<string, unknown>[];
  /**
   * The picture a link to the page shows — a chat's preview card, a post (`og:image`): a file of the site (`/og.png`)
   * or an address, about 1200×630. A template over the page's server providers too: a room's page shows its cover.
   * Left out, the space's `shareImage`.
   */
  seoImage?: string;
  /** What the picture shows, for whoever cannot see it (`og:image:alt`). */
  seoImageAlt?: string;
  /** What the page is, in Open Graph's words: `website` (the default), `article`, `profile`, `music.playlist`… */
  seoType?: OgType;
  /**
   * A template over the page's server providers and `navigation` that says this address shows nothing — a record that
   * is not there: the page server sends it with status 404, rendered as written. Read there only (`serverTemplates`).
   */
  notFound?: string;
  /**
   * How the document this page is drawn in moves. Unset, it scrolls as any page does. `noBounce` keeps the scroll and
   * takes away what a finger pulls past either end — iOS's rubber band, the browser's pull-to-refresh. `locked` holds the
   * document still: a dashboard, a board, a screen that fills the window and scrolls only inside the panels that say so
   * (`overflow: auto` on their own) — on a tablet a finger dragged anywhere else otherwise pulled the whole page.
   *
   * Written onto the document only when the document is the page's own — never onto the one a widget or a space drawn
   * inside another space is embedded in, nor the builder's.
   */
  documentScroll?: DocumentScroll | '';
  /**
   * The permissions a visitor must hold to see this page — read by the server, which withholds the page from anybody
   * without them. Nothing for the page itself to do with.
   */
  access?: PageAccess;
  /**
   * Set by the server on a page it withheld from this visitor (`access` they do not meet): the content was not sent,
   * and the page says why instead. Never authored.
   */
  withheld?: WithheldReason;
  className?: string;
  layout?: string;
  layoutContainer?: string;
  children?: ReactNode;
};

/** One shell of the chain, with what its elements carry: the same object for as long as the chain is the same. */
type ChainLink = LayoutLink & { plitziElementLayout: ElementLayout };

/**
 * Each `documentScroll` as the rule it is. Unlayered on purpose: the space's own stylesheet is in a layer, so a
 * `html, body` rule written there for every page gives way to what one page declares for itself.
 */
const DOCUMENT_SCROLL_CSS: Record<DocumentScroll, string> = {
  locked: 'html,body{height:100%;overflow:hidden;overscroll-behavior:none}',
  noBounce: 'html,body{overscroll-behavior:none}'
};

const toLinks = (chain: LayoutLink[]): ChainLink[] =>
  chain.map(link => ({ ...link, plitziElementLayout: { slots: [link.slot], rootId: link.slot, type: 'layout' } }));

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
      <LayoutBody key={slot} bodies={{ [slot]: body }}>
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
  seoRobots,
  seoStructuredData,
  seoImage,
  seoImageAlt,
  seoType,
  documentScroll = '',
  withheld,
  className = '',
  layout = '',
  layoutContainer = '',
  children
}: PageProps) => {
  const { id } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  // Written only into a head that is the page's own — never the builder's, around the canvas this page is drawn in.
  const { ownsHead, renderMode } = useRenderSettings();
  /**
   * A widget is drawn inside a page that is not the space's, and a space inside another space (or the builder's canvas)
   * does not own the head either: rules on `html` there would hold the host's document still.
   */
  const ownsDocument = ownsHead && renderMode !== 'widget';
  const [[routeParams, queryParams]] = useSdkStore(['navigation.routeParams', 'navigation.queryParams']);

  const layoutChain = useLayoutChain(layout, layoutContainer);
  const links = useMemo(() => toLinks(layoutChain), [layoutChain]);
  const body = useMemo(
    () => wrapInLayouts(links, id, withheld ? <PageWithheld reason={withheld} /> : children),
    [links, id, children, withheld]
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
      interactionTriggers={declaration.triggers}
    >
      {seoEnabled && previewMode && ownsHead && (
        <PageHead
          pageId={id}
          title={seoPageTitle}
          description={seoPageDescription}
          {...(seoRobots ? { robots: seoRobots } : {})}
          {...(seoStructuredData ? { structuredData: seoStructuredData } : {})}
          {...(seoImage ? { image: seoImage } : {})}
          {...(seoImageAlt ? { imageAlt: seoImageAlt } : {})}
          {...(seoType ? { type: seoType } : {})}
        />
      )}
      {/* Rendered with the page, not hoisted: it is in the HTML the server sends, and it leaves with the page. */}
      {documentScroll && ownsDocument && <style>{DOCUMENT_SCROLL_CSS[documentScroll]}</style>}
      {body}
    </RootElement>
  );
};

export default withElement(Page);

export { Page };
