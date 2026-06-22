import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import { memo, useMemo } from 'react';

import { PlitziServiceProvider } from '@plitzi/sdk-elements/Element/PlitziServiceProvider';
import { Page } from '@plitzi/sdk-elements/elements';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';

import type { Asset } from '@plitzi/plitzi-ui/ContainerFrame';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

export type ShadowModeProps = {
  pageId?: string;
  sdkStylePath?: string;
  style?: string;
  plitziContextValue: PlitziServiceContextValue;
  assets: Record<string, Asset>;
};

const ShadowMode = ({ pageId = '', sdkStylePath = '', style = '', plitziContextValue, assets }: ShadowModeProps) => {
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
            {pageId && <Page key={pageId} internalProps={pageValueMemo} />}
          </PlitziServiceProvider>
          <MadeInPlitzi pageId={pageId} />
        </SpaceContainer>
      </ContainerShadow.Content>
    </ContainerShadow>
  );
};

export default memo(ShadowMode);
