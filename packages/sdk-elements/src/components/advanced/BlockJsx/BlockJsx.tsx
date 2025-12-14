/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import get from 'lodash-es/get.js';
import omit from 'lodash-es/omit.js';
import set from 'lodash-es/set.js';
import React, { useEffect, useState, use, useCallback, useMemo } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import JsxManager from '../../../Element/JsxManager';
import RootElement from '../../../Element/RootElement';

import type { ComponentPlugin, InternalPropsSTG1, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BlockJsxProps = {
  ref?: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  className?: string;
  props?: string;
  contentCache?: string;
  allowEmptyRender?: boolean;
};

type ComponentPluginJsx = ComponentPlugin<{
  _jsx?: typeof _jsx;
  React?: unknown;
  getManager?: () => void;
  allowEmptyRender?: boolean;
  props?: Record<string, unknown>;
  utilities?: Record<string, unknown>;
  usePlitziServiceContext?: typeof usePlitziServiceContext;
}>;

const BlockJsx = ({
  ref,
  internalProps,
  className = '',
  props: componentProps = '{}',
  contentCache = '',
  allowEmptyRender = false,
  ...otherProps
}: BlockJsxProps) => {
  const [JsxModule, setJsxModule] = useState<{ default: ComponentPluginJsx }>();
  const [renderError, setRenderError] = useState<string>();
  const { components } = use(ComponentContext);
  const internalPropsTruncated = useMemo<InternalPropsSTG1>(() => {
    const { id, rootId, plitziElementLayout } = internalProps;

    return { id, rootId, plitziElementLayout };
  }, [internalProps]);
  const componentPropsParsed = useMemo(() => {
    const otherPropsFiltered = omit(otherProps, ['content']);
    if (!componentProps) {
      return otherPropsFiltered;
    }

    if (typeof componentProps === 'object') {
      return { ...(componentProps as object), ...otherPropsFiltered };
    }

    if (typeof componentProps !== 'string') {
      return otherPropsFiltered;
    }

    try {
      const propsParsed = JSON.parse(componentProps) as Record<string, unknown>;
      return { ...propsParsed, ...otherPropsFiltered };
    } catch (err) {
      console.log(err);
    }

    return undefined;
  }, [componentProps, otherProps]);

  const generateJSX = useCallback(
    async (data: string) => {
      let jsxModule;
      let error: string | undefined = undefined;
      try {
        data = `data:text/javascript;base64,${data}`;
        jsxModule = (await import(/* @vite-ignore */ /* webpackIgnore: true */ data)) as { default?: ComponentPlugin };
      } catch (e: unknown) {
        if (e instanceof Error) {
          error = e.message;
        }
      } finally {
        setRenderError(error);
        if (jsxModule && jsxModule.default) {
          setJsxModule(jsxModule as { default: ComponentPluginJsx });
        } else if (JsxModule) {
          setJsxModule(undefined);
          setRenderError('Component not found');
        }
      }
    },
    [JsxModule]
  );

  useEffect(() => {
    void generateJSX(contentCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentCache, components]);

  const getManager = useCallback((/* componentType */) => JsxManager, []);

  const utilities = useMemo(() => ({ lodash: { get, set } }), []);

  console.log(atob(contentCache));

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__block-jsx', className, {
        'block-jsx--empty': contentCache === '' || !contentCache || !JsxModule
      })}
    >
      {!renderError && componentPropsParsed && JsxModule && (
        <JsxModule.default
          _jsx={_jsx}
          React={React}
          internalProps={internalPropsTruncated}
          getManager={getManager}
          allowEmptyRender={allowEmptyRender}
          props={componentPropsParsed}
          utilities={utilities}
          usePlitziServiceContext={usePlitziServiceContext}
        />
      )}
      {renderError && <div>JSX Malformed {renderError}</div>}
      {!renderError && !componentPropsParsed && <div>Settings Malformed</div>}
    </RootElement>
  );
};

export default withElement(BlockJsx);

export { BlockJsx };
