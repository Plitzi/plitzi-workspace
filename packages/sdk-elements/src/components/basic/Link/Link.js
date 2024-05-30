// Packages
import React, { useMemo, use } from 'react';
import classNames from 'classnames';
import Handlebars from 'handlebars';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';
import { getPageFullPath } from '@plitzi/sdk-navigation/NavigationHelper';

// Relatives
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   children: React.ReactNode;
 *   className: string;
 *   href: string;
 *   target: 'self' | 'blank' | 'parent' | 'top';
 *   mode: 'page' | 'internal' | 'external';
 * }} props
 * @returns {React.ReactElement}
 */
const Link = props => {
  const {
    ref,
    internalProps = emptyObject,
    children,
    className = '',
    href = '#',
    target = 'self',
    mode = 'page'
  } = props;
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
        const handleBarsParams = { ...queryParams, ...routeParams };

        return template(handleBarsParams);
      } catch (e) {
        // nothing to do
      }

      return urlAux;
    }

    return getPageFullPath(flat, pageFolders, href, true);
  }, [href, flat, mode, queryParams, routeParams]);

  const handleClick = e => {
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
  }, [ref, style, target, url, className]);

  return (
    <RootElement tag="a" {...propsMemo} internalProps={internalProps} onClick={handleClick}>
      {children}
    </RootElement>
  );
};

export default withElement(Link);

export { Link };
