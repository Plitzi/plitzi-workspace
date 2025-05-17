/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get';
import set from 'lodash/set';
import React, { useEffect, useState, use, useCallback, useMemo } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ComponentContext from '../../../Component/ComponentContext';
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
  allowEmptyRender = false
}: BlockJsxProps) => {
  const [JsxModule, setJsxModule] = useState<{ default: ComponentPluginJsx } | undefined>(undefined);
  const [renderError, setRenderError] = useState<string | undefined>(undefined);
  const { components } = use(ComponentContext);
  const internalPropsTruncated = useMemo<InternalPropsSTG1>(() => {
    const { id, rootId, plitziElementLayout } = internalProps;

    return { id, rootId, plitziElementLayout };
  }, [internalProps]);
  const componentPropsParsed = useMemo(() => {
    if (!componentProps) {
      return {};
    }

    if (typeof componentProps !== 'string') {
      return componentProps;
    }

    try {
      return JSON.parse(componentProps) as Record<string, unknown>;
    } catch (err) {
      console.log(err);
    }

    return {};
  }, [componentProps]);

  const generateJSX = useCallback(
    async (data: string) => {
      let jsxModule;
      let error: string | undefined = undefined;
      try {
        jsxModule = (await import(/*webpackIgnore:true*/ `data:text/javascript;base64,${data}`)) as {
          default?: ComponentPlugin;
        };
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

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__block-jsx', className, {
        'block-jsx--empty': contentCache === '' || !contentCache || !JsxModule
      })}
    >
      {!renderError && JsxModule && (
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
    </RootElement>
  );
};

export default withElement(BlockJsx);

export { BlockJsx };
