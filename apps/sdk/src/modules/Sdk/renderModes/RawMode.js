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
import { RENDER_MODE_RAW, RENDER_MODE_WIDGET } from '../Sdk';

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
  const { pageId = '', style = '', plitziContextValue, renderMode = RENDER_MODE_RAW } = props;
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  let schema;
  if (renderMode === RENDER_MODE_WIDGET) {
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
        {pageId && renderMode !== RENDER_MODE_WIDGET && <Page key={pageId} internalProps={pageValueMemo} />}
        {pageId && renderMode === RENDER_MODE_WIDGET && (
          <PluginManager key={pageId} type={type} internalProps={pageValueMemo} />
        )}
      </PlitziServiceProvider>
      <MadeInPlitzi pageId={pageId} />
    </SpaceContainer>
  );
};

export default RawMode;
