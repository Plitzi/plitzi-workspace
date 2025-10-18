// Packages
import React, { useMemo, use } from 'react';
import get from 'lodash/get';

// Monorepo
import { Page } from '@plitzi/sdk-elements/components';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import SpaceContainer from '../../Space/SpaceContainer';

/**
 * @param {{
 *   renderMode?: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 *   pageId?: string;
 *   style?: string;
 *   plitziContextValue: object;
 * }} props
 * @returns {React.ReactElement}
 */
const RawMode = props => {
  const { pageId = '', style = '', plitziContextValue, renderMode = 'raw' } = props;
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  let schema;
  if (renderMode === 'widget') {
    ({ schema } = use(SchemaContext));
  }

  const type = useMemo(() => {
    if (schema && pageId) {
      return get(schema, `flat.${pageId}.definition.type`, 'page');
    }

    return 'page';
  }, [pageId]);

  return (
    <SpaceContainer renderMode={renderMode}>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <PlitziServiceProvider value={plitziContextValue}>
        {pageId && renderMode !== 'widget' && <Page key={pageId} internalProps={pageValueMemo} />}
        {pageId && renderMode === 'widget' && (
          <PluginManager key={pageId} type={type} internalProps={pageValueMemo} />
        )}
      </PlitziServiceProvider>
      <MadeInPlitzi pageId={pageId} />
    </SpaceContainer>
  );
};

export default RawMode;
