import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { memo, useMemo } from 'react';

import { Page } from '@plitzi/sdk-elements/elements';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';

import type { Asset } from '@plitzi/plitzi-ui/ContainerFrame';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { RefObject } from 'react';

export type IframeModeProps = {
  pageId?: string;
  style?: string;
  branding?: boolean;
  plitziContextValue: PlitziServiceContextValue;
  assets: Record<string, Asset>;
  ref: RefObject<HTMLIFrameElement | null>;
};

const IframeMode = ({
  pageId = '',
  style = '',
  branding = true,
  plitziContextValue,
  assets = emptyObject,
  ref
}: IframeModeProps) => {
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);

  return (
    <ContainerFrame ref={ref} id="i-sdk" css={style} assets={assets} className="w-full grow">
      <SpaceContainer>
        <PlitziServiceProvider value={plitziContextValue}>
          {pageId && <Page key={pageId} internalProps={pageValueMemo} />}
        </PlitziServiceProvider>
        {branding && <MadeInPlitzi pageId={pageId} />}
      </SpaceContainer>
    </ContainerFrame>
  );
};

export default memo(IframeMode);
