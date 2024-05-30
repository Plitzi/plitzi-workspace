// Packages
import React, { useEffect, useState, use, useCallback, useMemo } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';
import classNames from 'classnames';
import get from 'lodash/get';
import set from 'lodash/set';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';
import JsxManager from '../../../Element/JsxManager';
import ComponentContext from '../../../Component/ComponentContext';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   props: string;
 *   contentCache: string;
 *   allowEmptyRender: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const BlockJsx = props => {
  const {
    ref,
    internalProps = emptyObject,
    className = '',
    props: componentProps = '{}',
    contentCache = '',
    allowEmptyRender = false
  } = props;
  const [JsxModule, setJsxModule] = useState(undefined);
  const [renderError, setRenderError] = useState(undefined);
  const { components } = use(ComponentContext);
  const componentPropsParsed = useMemo(() => {
    if (!componentProps) {
      return {};
    }

    if (typeof componentProps !== 'string') {
      return componentProps;
    }

    try {
      return JSON.parse(componentProps);
    } catch (err) {
      console.log(err);
    }

    return {};
  }, [componentProps]);

  const generateJSX = useCallback(async data => {
    let jsxModule;
    let error;
    try {
      jsxModule = await import(/*webpackIgnore:true*/ `data:text/javascript;base64,${data}`); // eslint-disable-line
    } catch (e) {
      console.log(e);
      error = e.message;
    } finally {
      setRenderError(error);
      if (jsxModule && jsxModule.default) {
        setJsxModule(jsxModule);
      } else if (JsxModule) {
        setJsxModule(undefined);
      }
    }
  }, []);

  useEffect(() => {
    generateJSX(contentCache);
  }, [contentCache, components]);

  const getManager = useCallback((/* componentType */) => JsxManager, []);

  const utilities = useMemo(() => ({ lodash: { get, set } }), [get, set]);

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
