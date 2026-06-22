import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { memo, useMemo } from 'react';

import { PlitziElementsProvider } from '@plitzi/sdk-elements/Element/PlitziElementsProvider';
import { Page } from '@plitzi/sdk-elements/elements';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';

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
        <PlitziElementsProvider value={plitziContextValue}>
          {pageId && <Page key={pageId} internalProps={pageValueMemo} />}
        </PlitziElementsProvider>
        <MadeInPlitzi pageId={pageId} />
      </SpaceContainer>
    </ContainerFrame>
  );
};

export default memo(IframeMode);
