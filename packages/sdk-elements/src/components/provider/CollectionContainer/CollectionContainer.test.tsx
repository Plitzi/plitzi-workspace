// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

import CollectionContainer from './CollectionContainer';

describe('CollectionContainer Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      // <PlitziServiceProvider>
      <CollectionContainer />
      // </PlitziServiceProvider>
    );

    expect(baseElement).toBeTruthy();
  });
});
