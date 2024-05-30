// Packages
import React from 'react';
import { render } from '@testing-library/react';

// Monorepo
import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

// Relatives
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
