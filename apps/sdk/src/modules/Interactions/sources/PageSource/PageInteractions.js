// Packages
import { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import pick from 'lodash/pick';

// Monorepo
import SchemaContext from '@repo/schema-shared/SchemaContext';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';
import InteractionsContext from '@modules/Interactions/InteractionsContext';
import NavigationContext from '@modules/Navigation/NavigationContext';
import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';

const PageInteractions = props => {
  const { children, previewMode = true } = props;
  const { schema } = useContext(SchemaContext);
  const { keepState, stateStorage } = useMemo(() => get(schema, 'settings', {}), [schema]);
  const { setStateByKey, clearCache } = useContext(StateManagerContext);
  const { useInteractions } = useContext(InteractionsContext);
  const { navigate } = useContext(NavigationContext);
  const { pages: pageIds, pageDefinitions } = useContext(SchemaPagesContext);

  const handleSetPageState = useCallback(
    params => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        value = value === 'true';
      } else if (type === 'number') {
        value = parseInt(value, 10);
      }

      if (keepState && stateStorage) {
        setStateByKey(key, value, stateStorage);

        return;
      }

      setStateByKey(key, value);
    },
    [setStateByKey, keepState, stateStorage]
  );

  const handleClearStatePage = useCallback(() => {
    if (keepState && stateStorage) {
      clearCache(stateStorage);
    }
  }, [clearCache]);

  const pageUrls = useMemo(() => {
    const pages = pick(pageDefinitions, pageIds);

    return Object.keys(pages).reduce((acum, pageId) => {
      const page = pages[pageId];
      const pageName = get(page, 'attributes.name', pageId);
      const defaultPage = get(page, 'attributes.default', false);

      return [...acum, { key: pageId, label: pageName, defaultPage }];
    }, []);
  }, [pageDefinitions, pageIds]);

  const handleNavigate = useCallback(
    params => {
      if (!navigate || !previewMode) {
        return;
      }

      const { url, urlType } = params;
      if (urlType === 'page' || urlType === 'internal') {
        navigate(url);
      } else {
        // external url
        navigate(url, true);
      }
    },
    [navigate]
  );

  const interactionCallbacks = useMemo(
    () => ({
      navigate: {
        title: 'Navigate To Page',
        type: 'globalCallback',
        callback: handleNavigate,
        preview: {},
        params: {
          urlType: {
            label: 'Url Type',
            defaultValue: undefined,
            type: 'select',
            options: [
              { value: 'page', label: 'Space Page' },
              { value: 'internal', label: 'Inside Space' },
              { value: 'external', label: 'Outside Space' }
            ]
          },
          url: {
            defaultValue: pageUrls.find(page => !!page.defaultPage)?.key ?? '',
            type: params => (params.urlType === 'page' ? 'select' : 'text'),
            when: params => !!params.urlType,
            options: pageUrls.map(page => ({ value: page.key, label: page.label }))
          }
        }
      },
      setPageState: {
        title: 'Set Page State',
        type: 'globalCallback',
        callback: handleSetPageState,
        preview: {},
        params: {
          key: '',
          type: {
            defaultValue: undefined,
            type: 'select',
            options: [
              { value: 'boolean', label: 'True / False' },
              { value: 'number', label: 'Numeric' },
              { value: 'text', label: 'Text' }
            ]
          },
          value: {
            defaultValue: undefined,
            type: params => (params.type === 'boolean' ? 'select' : 'text'),
            when: params => !!params.type,
            options: [
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' }
            ]
          }
        }
      },
      clearState: {
        title: 'Clear Page State',
        type: 'globalCallback',
        callback: handleClearStatePage,
        preview: {},
        params: {}
      }
    }),
    [handleSetPageState, handleClearStatePage, handleNavigate, pageUrls]
  );

  useInteractions({ id: 'page', callbacks: interactionCallbacks });

  return children;
};

PageInteractions.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool
};

export default PageInteractions;
