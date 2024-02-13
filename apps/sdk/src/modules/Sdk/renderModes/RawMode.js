/* eslint-disable react/no-danger */
// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Alias
import MadeInPlitzi from '@components/MadeInPlitzi';

// Relatives
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';
import Page from '../../../SdkComponents/internal/Page/Page';
import SpaceContainer from '../../Space/SpaceContainer';

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

RawMode.propTypes = {
  plitziContextValue: PropTypes.object,
  pageId: PropTypes.string,
  style: PropTypes.string
};

export default RawMode;
