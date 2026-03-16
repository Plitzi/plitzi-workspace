import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use, memo } from 'react';

import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import { Page } from '@plitzi/sdk-elements/elements';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';

import type { RenderMode, Schema } from '@plitzi/sdk-shared';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

export type RawModeProps = {
  renderMode?: RenderMode;
  pageId?: string;
  style?: string;
  plitziContextValue: PlitziServiceContextValue;
};

const RawMode = ({ pageId = '', style = '', plitziContextValue, renderMode = 'raw' }: RawModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  let schema: Schema | undefined;
  if (renderMode === 'widget') {
    ({ schema } = use(SchemaContext));
  }

  const type = useMemo(() => {
    if (schema && pageId) {
      return get(schema, `flat.${pageId}.definition.type`, 'page');
    }

    return 'page';
  }, [pageId, schema]);

  return (
    <SpaceContainer>
      <style type="text/css" rel="stylesheet" data-id="plitzi-runtime-style">
        {style}
      </style>
      <PlitziServiceProvider value={plitziContextValue}>
        {pageId && renderMode !== 'widget' && <Page key={pageId} internalProps={pageValueMemo} />}
        {pageId && renderMode === 'widget' && <PluginManager key={pageId} type={type} internalProps={pageValueMemo} />}
      </PlitziServiceProvider>
      <MadeInPlitzi pageId={pageId} />
    </SpaceContainer>
  );
};

export default memo(RawMode);
