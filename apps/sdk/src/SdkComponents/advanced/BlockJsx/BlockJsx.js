// Packages
import React, { forwardRef, useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';
import set from 'lodash/set';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import JsxManager from '@modules/Element/JsxManager';
import RootElement from '@modules/Element/RootElement';

// Relatives
import ComponentContext from '../../../modules/Component/ComponentContext';
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const BlockJsx = forwardRef((props, ref) => {
  const {
    internalProps = emptyObject,
    className = '',
    props: componentProps = '{}',
    contentCache = '',
    allowEmptyRender = false
  } = props;
  const [JsxModule, setJsxModule] = useState(undefined);
  const [renderError, setRenderError] = useState(undefined);
  const { components } = useContext(ComponentContext);
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
});

BlockJsx.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  content: PropTypes.string,
  props: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  contentCache: PropTypes.string,
  allowEmptyRender: PropTypes.bool
};

export default withElement(BlockJsx);

export { BlockJsx };
