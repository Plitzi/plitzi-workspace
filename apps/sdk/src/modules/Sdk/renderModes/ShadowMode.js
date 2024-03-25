/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';
import Page from '../../../SdkComponents/internal/Page/Page';
import SpaceContainer from '../../Space/SpaceContainer';

const ShadowMode = props => {
  const { pageId = '', style = '', plitziContextValue, assets = emptyObject } = props;
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);
  const assetsMemo = useMemo(() => Object.values(assets), [assets]);

  return (
    <ContainerShadow>
      {assetsMemo.map((item, i) => (
        <ContainerShadow.Link key={i} href={item?.params?.href} />
      ))}
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

ShadowMode.propTypes = {
  plitziContextValue: PropTypes.object,
  pageId: PropTypes.string,
  assets: PropTypes.object,
  style: PropTypes.string
};

export default ShadowMode;
