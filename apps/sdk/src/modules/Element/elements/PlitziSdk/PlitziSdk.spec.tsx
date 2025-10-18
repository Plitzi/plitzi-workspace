import { expect, describe, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';

import { PlitziSdk } from './PlitziSdk';

import type { ReactNode } from 'react';

jest.mock('plitziSdkFederation/usePlitziServiceContext');

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const { baseElement } = render((<PlitziSdk />) as ReactNode);

    expect(baseElement).toBeTruthy();
  });
});
