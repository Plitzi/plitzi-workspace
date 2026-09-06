import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import { memo, useMemo } from 'react';

import { Page } from '@plitzi/sdk-elements/elements';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';
import OverQuotaNotice from '../components/OverQuotaNotice';

import type { Asset } from '@plitzi/plitzi-ui/ContainerFrame';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

export type ShadowModeProps = {
  pageId?: string;
  sdkStylePath?: string;
  style?: string;
  branding?: boolean;
  plitziContextValue: PlitziServiceContextValue;
  assets: Record<string, Asset>;
};

const ShadowMode = ({
  pageId = '',
  sdkStylePath = '',
  style = '',
  branding = true,
  plitziContextValue,
  assets
}: ShadowModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  const assetsMemo = useMemo(() => Object.values(assets), [assets]);

  return (
    <ContainerShadow>
      {assetsMemo.map((item, i) => (
        <ContainerShadow.Link key={i} href={item.params.href} />
      ))}
      <ContainerShadow.Link href={sdkStylePath} />
      <ContainerShadow.Content>
        <SpaceContainer>
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <PlitziServiceProvider value={plitziContextValue}>
            {/* No key on the page: a key here remounts the WHOLE tree on every navigation, and the layout shell
                (header, sidebar) is rendered inside the page — so two pages naming the same `layoutContainer` tore it
                down and rebuilt it anyway, losing its element state and its scroll position for nothing. Reconciling
                by position keeps the shell mounted across a navigation and swaps only the body: the page's own items
                are keyed by element id and pages never share one, so nothing from the old page survives. */}
            {pageId && <Page internalProps={pageValueMemo} />}
          </PlitziServiceProvider>
          {branding && <MadeInPlitzi pageId={pageId} />}
          <OverQuotaNotice />
        </SpaceContainer>
      </ContainerShadow.Content>
    </ContainerShadow>
  );
};

export default memo(ShadowMode);
