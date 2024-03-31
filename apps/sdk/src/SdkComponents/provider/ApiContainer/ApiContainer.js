// Packages
import React, { forwardRef, useCallback, useContext, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Handlebars from 'handlebars';
import get from 'lodash/get';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import useApi from './hooks/useApi';

const ApiContainer = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    children,
    query = '',
    method = 'get',
    accessToken = '',
    when = emptyObject,
    mockData = '{}',
    subType = 'div'
  } = props;
  const { id } = internalProps;
  const {
    settings: { previewMode, debugMode },
    contexts: { DataSourceContext, NavigationContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = useContext(InteractionsContext);
  const { useDataSource } = useContext(DataSourceContext);
  const { routeParams, queryParams } = useContext(NavigationContext);
  const queryCompiled = useMemo(() => {
    if (!query) {
      return '';
    }

    try {
      const handleBarsParams = { ...queryParams, ...routeParams };
      // Check if Tokens required are defined first, if not skip fetch
      if (debugMode) {
        [...query.matchAll(/{{([ ]+|)(?<token>[a-zA-Z0-9-_:*/]+)([ ]+|)}}/gim)].forEach(({ groups }) => {
          const token = groups.token.trim();
          if (!get(handleBarsParams, token)) {
            console.log(`Token ${token} is required`);
          }
        });
      }

      const template = Handlebars.compile(query);

      return template(handleBarsParams);
    } catch (e) {
      console.error(e.message);
    }

    return '';
  }, [routeParams, queryParams, query]);

  const { isLoading, data, refetch, error, isSuccess, isError } = useApi({
    url: queryCompiled,
    method,
    mock: !previewMode ? mockData : undefined,
    customHeaders: { Authorization: `Bearer ${accessToken}` },
    enabled:
      !previewMode || !when || when === emptyObject || QueryBuilderEvaluator(when, { ...routeParams, ...queryParams })
  });

  useEffect(() => {
    if (isLoading) {
      return undefined;
    }

    if (isSuccess) {
      interactionsManager.interactionTrigger(id, 'onApiSuccess', { url: queryCompiled, method, data, status: 200 });
    } else if (isError) {
      interactionsManager.interactionTrigger(id, 'onApiError', {
        url: queryCompiled,
        method,
        data: error,
        status: 500
      });
    }

    return undefined;
  }, [isLoading]);

  const sourceFields = useCallback(
    async () =>
      getPathsFromObeject(data).reduce((acum, path) => {
        const name = path.split('.');
        if (name.length > 1) {
          return [...acum, { path, name: name.slice(name.length - 2).join(' ') }];
        }

        return [...acum, { path, name: name[name.length - 1] }];
      }, []),
    [fetch, queryCompiled, method, data]
  );

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `Api - ${id}`),
    [id, internalProps?.definition?.label]
  );

  useDataSource({ id, source: `apiContainer-${id}`, name: sourceName, value: data, fields: sourceFields });

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Api Container');

    return { performQuery: { title: `Perform Query ${label}`, callback: refetch, preview: {}, params: {} } };
  }, [refetch, internalProps?.definition?.label]);

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
      {!isLoading && (!isError || !previewMode) && children}
      {!isLoading && isError && previewMode && <div className="plitzi-component__api-container-error">{error}</div>}
    </RootElement>
  );
});

ApiContainer.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  query: PropTypes.string,
  method: PropTypes.oneOf(['get', 'post']),
  accessToken: PropTypes.string,
  when: PropTypes.object,
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
