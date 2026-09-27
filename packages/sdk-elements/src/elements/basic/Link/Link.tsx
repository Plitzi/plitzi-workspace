/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useMemo } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LinkProps = {
  ref?: RefObject<HTMLElement>;
  children?: ReactNode;
  className?: string;
  href?: string;
  target?: 'self' | 'blank' | 'parent' | 'top';
  mode?: 'page' | 'internal' | 'external';
  /**
   * What a screen reader announces instead of the link's contents.
   *
   * Worth setting on a link that wraps a whole card: with nothing here, the announced name is every word inside
   * it — the topic, the headline, the standfirst, the byline and the button — read out as one link.
   */
  label?: string;
};

const Link = ({ ref, children, className = '', href = '#', target = 'self', mode = 'page', label = '' }: LinkProps) => {
  const { style } = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const [[pageDefinitions, pageFolders, routeParams, queryParams, navigate]] = useSdkStore([
    'pageDefinitions',
    'schema.pageFolders',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.navigate'
  ]);

  const url = useMemo(() => {
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
      // Empty means "let the contents name it", which is right for an ordinary link and only wrong for a card.
      'aria-label': label ? label : undefined,
      className: clsx('plitzi-component__link', className)
    };
    if (!previewMode) {
      return { ...propsToReturn, 'href-disabled': url };
    }

    return { ...propsToReturn, href: url };
  }, [ref, style, target, label, className, previewMode, url]);

  return (
    <RootElement tag="a" {...propsMemo} onClick={handleClick}>
      {children}
    </RootElement>
  );
};

export default withElement(Link);

export { Link };
