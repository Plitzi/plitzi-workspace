// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import ContainerFrame from '@plitzi/plitzi-ui-components/ContainerFrame';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';
import Page from '../../../SdkComponents/internal/Page/Page';
import SpaceContainer from '../../Space/SpaceContainer';

const IframeMode = forwardRef((props, ref) => {
  const { pageId = '', style = '', plitziContextValue, assets = emptyObject } = props;
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
});

IframeMode.propTypes = {
  plitziContextValue: PropTypes.object,
  assets: PropTypes.object,
  pageId: PropTypes.string,
  style: PropTypes.string
};

export default IframeMode;
