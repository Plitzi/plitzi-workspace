/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';

// Monorepo
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
 * }} props
 * @returns {React.ReactElement}
 */
const RawMode = props => {
  const { pageId = '', style = '', plitziContextValue } = props;
  const pageValueMemo = useMemo(() => ({ id: pageId, rootId: pageId }), [pageId]);

  return (
    <SpaceContainer>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <PlitziServiceProvider value={plitziContextValue}>
        {pageId && <Page key={pageId} internalProps={pageValueMemo} />}
      </PlitziServiceProvider>
      <MadeInPlitzi pageId={pageId} />
    </SpaceContainer>
  );
};

export default RawMode;
