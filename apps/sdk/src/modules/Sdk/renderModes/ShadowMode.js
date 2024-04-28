/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';
import Page from '../../../SdkComponents/internal/Page/Page';
import SpaceContainer from '../../Space/SpaceContainer';

/**
 * @param {{
 *   pageId?: string;
 *   style?: string;
 *   plitziContextValue: object;
 *   assets: object;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default ShadowMode;
