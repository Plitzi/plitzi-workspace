// Packages
import React, { useMemo } from 'react';
import ContainerFrame from '@plitzi/plitzi-ui-components/ContainerFrame';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';
import { Page } from '@plitzi/sdk-elements/components';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import SpaceContainer from '../../Space/SpaceContainer';

/**
 * @param {{
 *   pageId?: string;
 *   style?: string;
 *   plitziContextValue: object;
 *   assets: object;
 *   ref: React.RefObject<HTMLElement>;
 * }} props
 * @returns {React.ReactElement}
 */
const IframeMode = props => {
  const { pageId = '', style = '', plitziContextValue, assets = emptyObject, ref } = props;
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);

  return (
    <ContainerFrame ref={ref} id="i-sdk" css={style} assets={assets} className="grow">
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
