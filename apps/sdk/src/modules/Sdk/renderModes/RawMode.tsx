import { createStoreHook } from '@plitzi/nexus/createStore';
import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, memo } from 'react';

import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import { Page } from '@plitzi/sdk-elements/elements';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';

import type { RenderMode, SdkState } from '@plitzi/sdk-shared';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

export type RawModeProps = {
  renderMode?: RenderMode;
  pageId?: string;
  style?: string;
  plitziContextValue: PlitziServiceContextValue;
};

const RawMode = ({ pageId = '', style = '', plitziContextValue, renderMode = 'raw' }: RawModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  const { useStore } = createStoreHook<SdkState>();
  const [flat] = useStore('schema.flat');

  const type = useMemo(() => {
    if (pageId && renderMode === 'widget') {
      return get(flat, `${pageId}.definition.type`, 'page');
    }

    return 'page';
  }, [pageId, renderMode, flat]);

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
