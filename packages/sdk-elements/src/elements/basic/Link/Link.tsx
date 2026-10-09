/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useMemo } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import { ariaCurrent } from './ariaCurrent';
import ElementWords from '../../../Element/ElementWords';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { IconPlacement } from '../../../Element/ElementWords';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LinkProps = {
  ref?: RefObject<HTMLElement>;
  children?: ReactNode;
  className?: string;
  href?: string;
  target?: 'self' | 'blank' | 'parent' | 'top';
  mode?: 'page' | 'internal' | 'external';
  /**
   * A section of the page it goes to: the `anchor` of an element there, without the `#`. `/pricing` and `hash: 'plans'`
   * land on `/pricing#plans`, scrolled to that element. Read in `page` and `internal` modes.
   */
  hash?: string;
  /**
   * What a screen reader announces instead of the link's contents.
   *
   * Worth setting on a link that wraps a whole card: with nothing here, the announced name is every word inside
   * it — the topic, the headline, the standfirst, the byline and the button — read out as one link.
   */
  label?: string;
  /**
   * The link's own words — `Pricing` — drawn without a text element inside it, so a link that says something is one
   * element rather than two. Beside its children when it has any, where `contentPlacement` says.
   */
  content?: string;
  contentPlacement?: 'before' | 'after';
  /**
   * An icon beside the words, as Font Awesome classes — `'fa-solid fa-arrow-right'` — instead of a `fontAwesome`
   * element inside. Decoration: the words (or `title`/`label`) name it. Its `icon` slot styles it.
   */
  icon?: string;
  /** Which side of the words the icon sits on. */
  iconPlacement?: IconPlacement;
  /**
   * Where the link is current. `page` (the default): on the page it leads to and nowhere else. `section`: on that page
   * and every page under its path — `/automations/runs` stays lit on `/automations/runs/42`, a journal's link on its
   * articles — announced there as the current entry (`aria-current="true"`) rather than the current page.
   */
  current?: 'page' | 'section';
};

const Link = ({
  ref,
  children,
  className = '',
  href = '#',
  target = 'self',
  mode = 'page',
  hash = '',
  label = '',
  content = '',
  contentPlacement = 'after',
  icon = '',
  iconPlacement = 'before',
  current = 'page'
}: LinkProps) => {
  const {
    style,
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const [[pageDefinitions, pageFolders, routeParams, queryParams, navigate, location]] = useSdkStore([
    'pageDefinitions',
    'schema.pageFolders',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.navigate',
    'navigation.href'
  ]);

  const path = useMemo(() => {
    if (mode === 'external') {
      return href;
    }

    if (mode === 'internal') {
      const urlAux = `/${href}`.replaceAll(/[/]+/gim, '/');
      try {
        const result = processTwig(urlAux, { ...queryParams, ...routeParams }, true);
        if (typeof result !== 'string') {
          return urlAux;
        }

        return result;
      } catch {
        // nothing to do
      }

      return urlAux;
    }

    return getPageFullPath(pageDefinitions, pageFolders, href, true);
  }, [mode, href, pageDefinitions, pageFolders, queryParams, routeParams]);
  const url = mode !== 'external' && hash ? `${path}#${hash}` : path;
  // The page being shown, said by the link that leads to it — or by its section's: what a screen reader announces, and
  // what the `current` style state selects. From the address the server rendered, so the first paint already marks it.
  const currentAs = mode === 'external' ? undefined : ariaCurrent(path, location, current);

  const handleClick = (e: MouseEvent) => {
    if (!previewMode) {
      return;
    }

    e.stopPropagation();
    // A page of the site is navigated to in place — unless the link, or the person, asked for somewhere else: a
    // `target` of its own, or a click held with ⌘, Ctrl or Shift, or not the main button. The browser opens those.
    const elsewhere = target !== 'self' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    if ((mode === 'page' || mode === 'internal') && !elsewhere) {
      e.preventDefault();
      navigate(url);
    }
  };

  const propsMemo = useMemo(() => {
    const propsToReturn = {
      ref,
      style,
      target: `_${target}`,
      // Another tab is another page: it gets no handle back on this one, nor its address.
      ...(target === 'blank' ? { rel: 'noopener noreferrer' } : {}),
      // Empty means "let the contents name it", which is right for an ordinary link and only wrong for a card.
      'aria-label': label ? label : undefined,
      'aria-current': currentAs,
      className: clsx('plitzi-component__link', className)
    };
    if (!previewMode) {
      return { ...propsToReturn, 'href-disabled': url };
    }

    return { ...propsToReturn, href: url };
  }, [ref, style, target, label, currentAs, className, previewMode, url]);

  return (
    <RootElement tag="a" {...propsMemo} onClick={handleClick}>
      <ElementWords
        content={content}
        icon={icon}
        iconPlacement={iconPlacement}
        iconClassName={styleSelectors.icon}
        contentPlacement={contentPlacement}
      >
        {children}
      </ElementWords>
    </RootElement>
  );
};

export default withElement(Link);

export { Link };
