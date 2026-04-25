import { omit } from '@plitzi/plitzi-ui';
import clsx from 'clsx';
import { useEffect, useState, useCallback, useMemo } from 'react';

import useElement from '@plitzi/sdk-shared/elements/hooks/useElement';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ComponentPluginWithHOC } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type BlockJsxProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  props?: string;
  contentCache?: string;
};

const BlockJsx = ({
  ref,
  className = '',
  props: componentProps = '{}',
  contentCache = '',
  ...otherProps
}: BlockJsxProps) => {
  const { id, rootId, plitziElementLayout } = useElement();
  const [JsxModule, setJsxModule] = useState<{ default: ComponentPluginWithHOC<typeof otherProps> }>();
  const [renderError, setRenderError] = useState<string>();
  const internalPropsTruncated = useMemo(
    () => ({ id, rootId, plitziElementLayout }),
    [id, plitziElementLayout, rootId]
  );
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
        jsxModule = (await import(/* @vite-ignore */ /* webpackIgnore: true */ data)) as {
          default?: ComponentPluginWithHOC;
        };
      } catch (e: unknown) {
        if (e instanceof Error) {
          error = e.message;
        }
      } finally {
        setRenderError(error);
        if (jsxModule && jsxModule.default) {
          setJsxModule(jsxModule as { default: ComponentPluginWithHOC<typeof otherProps> });
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
  }, [contentCache, generateJSX]);

  return (
    <RootElement
      ref={ref}
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

// eslint-disable-next-line react-refresh/only-export-components
export default withElement(BlockJsx);

export { BlockJsx };
