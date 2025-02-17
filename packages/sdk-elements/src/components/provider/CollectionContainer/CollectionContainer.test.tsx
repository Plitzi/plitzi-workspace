import React from 'react';
import { render } from '@testing-library/react';

import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

import CollectionContainer from './CollectionContainer';

describe('CollectionContainer', () => {
  it('should render successfully', () => {
    const BaseElement = render(
      <PlitziServiceProvider value={{ DataSourceContext: { _currentValue: {} } }}>
        <CollectionContainer internalProps={{}} />
      </PlitziServiceProvider>
    );

    expect(BaseElement).toBeTruthy();
  });
});
