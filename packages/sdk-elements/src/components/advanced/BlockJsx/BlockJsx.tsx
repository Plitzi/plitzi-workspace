/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import omit from 'lodash-es/omit.js';
import { useEffect, useState, use, useCallback, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ComponentPlugin, InternalPropsSTG1, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BlockJsxProps = {
  ref?: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  className?: string;
  props?: string;
  contentCache?: string;
};

const BlockJsx = ({
  ref,
  internalProps,
  className = '',
  props: componentProps = '{}',
  contentCache = '',
  ...otherProps
}: BlockJsxProps) => {
  const [JsxModule, setJsxModule] = useState<{ default: ComponentPlugin<typeof otherProps> }>();
  const [renderError, setRenderError] = useState<string>();
  const { components } = use(ComponentContext);
  const internalPropsTruncated = useMemo<InternalPropsSTG1>(() => {
    const { id, rootId, plitziElementLayout } = internalProps;

    return { id, rootId, plitziElementLayout };
  }, [internalProps]);
  const componentPropsParsed = useMemo(() => {
    const otherPropsFiltered = omit(otherProps, ['content', 'children']);
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
          setJsxModule(jsxModule as { default: ComponentPlugin<typeof otherProps> });
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

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__block-jsx', className, {
        'block-jsx--empty': contentCache === '' || !contentCache || !JsxModule
      })}
    >
      {!renderError && componentPropsParsed && JsxModule && (
        <JsxModule.default internalProps={internalPropsTruncated} {...componentPropsParsed} />
      )}
      {renderError && <div>JSX Malformed {renderError}</div>}
      {!renderError && !componentPropsParsed && <div>Settings Malformed</div>}
    </RootElement>
  );
};

export default withElement(BlockJsx);

export { BlockJsx };
