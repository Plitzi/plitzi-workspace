import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, memo } from 'react';

import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import { Page } from '@plitzi/sdk-elements/elements';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';
import OverQuotaNotice from '../components/OverQuotaNotice';

import type { RenderMode } from '@plitzi/sdk-shared';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

export type RawModeProps = {
  renderMode?: RenderMode;
  pageId?: string;
  style?: string;
  branding?: boolean;
  plitziContextValue: PlitziServiceContextValue;
};

const RawMode = ({
  pageId = '',
  style = '',
  branding = true,
  plitziContextValue,
  renderMode = 'raw'
}: RawModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  const [flat] = useSdkStore('schema.flat');

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
        {/* No key on the page: a key here remounts the WHOLE tree on every navigation, and the layout shell
            (header, sidebar) is rendered inside the page — so two pages naming the same `layoutContainer` tore it
            down and rebuilt it anyway, losing its element state and its scroll position for nothing. Reconciling
            by position keeps the shell mounted across a navigation and swaps only the body: the page's own items
            are keyed by element id and pages never share one, so nothing from the old page survives. */}
        {pageId && renderMode !== 'widget' && <Page internalProps={pageValueMemo} />}
        {pageId && renderMode === 'widget' && <PluginManager key={pageId} type={type} internalProps={pageValueMemo} />}
      </PlitziServiceProvider>
      {branding && <MadeInPlitzi pageId={pageId} />}
      <OverQuotaNotice />
    </SpaceContainer>
  );
};

export default memo(RawMode);
