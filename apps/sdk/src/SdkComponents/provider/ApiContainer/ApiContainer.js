// Packages
import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Handlebars from 'handlebars';
import Axios from 'axios';
import get from 'lodash/get';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import { emptyObject, getPathsFromObeject } from '../../../helpers/utils';

const ApiContainer = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    children,
    query = '',
    method = 'get',
    accessToken = '',
    mockData = '{}',
    subType = 'div'
  } = props;
  const { id } = internalProps;
  const [state, setState] = useState({ statusCode: 0, data: undefined });
  const {
    settings: { previewMode },
    contexts: { DataSourceContext, NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionTrigger } = useContext(InteractionsContext);
  const [loading, setLoading] = useState(previewMode);
  const [error, setError] = useState(undefined);
  const { useDataSource } = useContext(DataSourceContext);
  const { routeParams, queryParams } = useContext(NavigationContext);

  // needs to find new user cases
  const queryCompiled = useMemo(() => {
    if (!query) {
      return '';
    }

    try {
      const template = Handlebars.compile(query);
      const handleBarsParams = { ...queryParams, ...routeParams };

      return template(handleBarsParams);
    } catch (e) {
      // nothing to do
    }

    return '';
  }, [routeParams, queryParams, query]);

  const fetch = useCallback(
    async (url, method = 'get') => {
      if (!url || !Axios[method] || typeof Axios[method] !== 'function') {
        return undefined;
      }

      try {
        const headers = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        return await Axios[method](url, { headers });
      } catch (err) {
        console.log(err);

        return err.message;
      }
    },
    [accessToken]
  );

  const processFetch = useCallback(
    async (url, method) => {
      let statusCode = 0;
      let result;
      if (!previewMode && mockData && mockData !== '{}') {
        if (typeof mockData === 'string') {
          try {
            result = JSON.parse(mockData);
            statusCode = 200;
          } catch (e) {
            result = e.message;
            statusCode = 500;
          }
        } else {
          result = mockData;
          statusCode = 200;
        }
      } else if (url && method) {
        try {
          result = await fetch(url, method);
          const { status, data } = result;
          result = data;
          if (!result || typeof result === 'string') {
            statusCode = 0;
          } else {
            statusCode = status;
          }
        } catch (e) {
          result = e.message;
          statusCode = e.statusCode;
        }
      }

      setState({ statusCode, data: result });
      setLoading(false);
      if (statusCode > 0 && statusCode <= 399) {
        setError(undefined);
        interactionTrigger(id, 'onApiSuccess', { url, method, data: result, status: statusCode });
      } else {
        setError(result);
        interactionTrigger(id, 'onApiError', { url, method, data: result, status: statusCode });
      }
    },
    [fetch, id, interactionTrigger, previewMode, mockData]
  );

  const sourceFields = useCallback(
    async (refetch = false) => {
      let data = state;
      if (refetch) {
        const response = await fetch(queryCompiled, method);
        if (response && typeof response === 'object') {
          const { status, data: responseData } = response;
          data = { statusCode: status, data: responseData };
        }
      }

      return getPathsFromObeject(data).reduce((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []);
    },
    [fetch, queryCompiled, method, state]
  );

  useEffect(() => {
    processFetch(queryCompiled, method);
  }, [processFetch, queryCompiled, method, previewMode]);

  useDataSource({
    id,
    source: `apiContainer-${id}`,
    name: `Api Container ${id}`,
    value: state,
    fields: sourceFields
  });

  const handlePerformQuery = useCallback(
    () => processFetch(queryCompiled, method),
    [processFetch, queryCompiled, method]
  );

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Api Container');

    return { performQuery: { title: `Perform Query ${label}`, callback: handlePerformQuery, preview: {}, params: {} } };
  }, [handlePerformQuery, internalProps?.definition?.label]);

  const interactionTriggers = useMemo(
    () => ({
      onApiError: {
        title: 'On Api Error',
        params: {},
        preview: { url: '', method: '', status: '', data: '' }
      },
      onApiSuccess: {
        title: 'On Api Success',
        params: {},
        preview: { url: '', method: '', status: '', data: '' }
      }
    }),
    []
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__api-container', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
    >
      {!loading && (!error || !previewMode) && children}
      {!loading && error && previewMode && <div className="plitzi-component__api-container-error">{error}</div>}
    </RootElement>
  );
});

ApiContainer.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  query: PropTypes.string,
  method: PropTypes.oneOf(['get', 'post']),
  accessToken: PropTypes.string,
  mockData: PropTypes.string,
  subType: PropTypes.oneOf([
    'div',
    'header',
    'footer',
    'nav',
    'main',
    'section',
    'article',
    'aside',
    'address',
    'figure'
  ]),
  className: PropTypes.string
};

export default withElement(ApiContainer);

export { ApiContainer };
