/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import Handlebars from 'handlebars';
import { useMemo, use } from 'react';

import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '../../../types/ElementTypes';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LinkProps = {
  ref: RefObject<HTMLElement>;
  internalProps: InternalProps;
  children?: ReactNode;
  className: string;
  href: string;
  target: 'self' | 'blank' | 'parent' | 'top';
  mode: 'page' | 'internal' | 'external';
};

const Link = ({
  ref,
  internalProps = emptyObject as InternalProps,
  children,
  className = '',
  href = '#',
  target = 'self',
  mode = 'page'
}: LinkProps) => {
  const {
    settings: { previewMode },
    contexts: { NavigationContext, SchemaContext }
  } = usePlitziServiceContext();
  const { navigate, routeParams, queryParams } = use(NavigationContext);
  const {
    schema: { flat, pageFolders }
  } = use(SchemaContext);
  const { style } = internalProps;

  const url = useMemo(() => {
    if (mode === 'external') {
      return href;
    }

    const urlAux = `/${href}`.replaceAll(/[/]+/gim, '/');
    if (mode === 'internal') {
      try {
        const template = Handlebars.compile(urlAux);
        const handleBarsParams = { ...queryParams, ...routeParams } as Record<string, string>;

        return template(handleBarsParams);
      } catch {
        // nothing to do
      }

      return urlAux;
    }

    return getPageFullPath(flat, pageFolders, href, true) as string;
  }, [mode, href, flat, pageFolders, queryParams, routeParams]);

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
      className: classNames('plitzi-component__link', className)
    };
    if (!previewMode) {
      return { ...propsToReturn, 'href-disabled': url };
    }

    return { ...propsToReturn, href: url };
  }, [ref, style, target, className, previewMode, url]);

  return (
    <RootElement tag="a" {...propsMemo} internalProps={internalProps} onClick={handleClick}>
      {children}
    </RootElement>
  );
};

export default withElement(Link);

export { Link };
