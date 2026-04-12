/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useMemo, use } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { CommonState } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LinkProps = {
  ref?: RefObject<HTMLElement>;
  children?: ReactNode;
  className?: string;
  href?: string;
  target?: 'self' | 'blank' | 'parent' | 'top';
  mode?: 'page' | 'internal' | 'external';
};

const Link = ({ ref, children, className = '', href = '#', target = 'self', mode = 'page' }: LinkProps) => {
  const { style } = useElement();
  const {
    settings: { previewMode },
    contexts: { NavigationContext }
  } = usePlitziServiceContext();
  const { navigate, routeParams, queryParams } = use(NavigationContext);
  const { useStore } = createStoreHook<CommonState>();
  const [[pageDefinitions, pageFolders]] = useStore(['pageDefinitions', 'schema.pageFolders']);

  const url = useMemo(() => {
    if (mode === 'external') {
      return href;
    }

    const urlAux = `/${href}`.replaceAll(/[/]+/gim, '/');
    if (mode === 'internal') {
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
    if (mode === 'page' || mode === 'internal') {
      e.preventDefault();
      navigate(url);
    }
  };

  const propsMemo = useMemo(() => {
    const propsToReturn = {
      ref,
      style,
      target: `_${target}`,
      className: clsx('plitzi-component__link', className)
    };
    if (!previewMode) {
      return { ...propsToReturn, 'href-disabled': url };
    }

    return { ...propsToReturn, href: url };
  }, [ref, style, target, className, previewMode, url]);

  return (
    <RootElement tag="a" {...propsMemo} onClick={handleClick}>
      {children}
    </RootElement>
  );
};

export default withElement(Link);

export { Link };
