import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { memo, useMemo } from 'react';

import { Page } from '@plitzi/sdk-elements/elements';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import SpaceContainer from '../../Space/SpaceContainer';
import MadeInPlitzi from '../components/MadeInPlitzi';
import OverQuotaNotice from '../components/OverQuotaNotice';

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
    </ContainerFrame>
  );
};

export default memo(IframeMode);
