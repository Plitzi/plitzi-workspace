import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { useMemo } from 'react';

import MadeInPlitzi from '@components/MadeInPlitzi';
import { Page } from '@plitzi/sdk-elements/components';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import SpaceContainer from '../../Space/SpaceContainer';

import type { Asset } from '@plitzi/plitzi-ui/ContainerFrame';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { RefObject } from 'react';

export type IframeModeProps = {
  pageId?: string;
  style?: string;
  plitziContextValue: PlitziServiceContextValue;
  assets: Record<string, Asset>;
  ref: RefObject<HTMLIFrameElement | null>;
};

const IframeMode = ({ pageId = '', style = '', plitziContextValue, assets = emptyObject, ref }: IframeModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);

  return (
    <ContainerFrame ref={ref} id="i-sdk" css={style} assets={assets} className="w-full grow">
      <SpaceContainer>
        <PlitziServiceProvider value={plitziContextValue}>
          {pageId && <Page key={pageId} internalProps={pageValueMemo} />}
        </PlitziServiceProvider>
        <MadeInPlitzi pageId={pageId} />
      </SpaceContainer>
    </ContainerFrame>
  );
};

export default IframeMode;
