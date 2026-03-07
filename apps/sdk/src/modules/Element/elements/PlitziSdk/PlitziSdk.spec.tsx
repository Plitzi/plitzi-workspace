import { expect, describe, it } from '@jest/globals';
import { render } from '@testing-library/react';

import { PlitziSdk } from './PlitziSdk';

import type { ReactNode } from 'react';

describe('PlitziSdk', () => {
  it('should render successfully', () => {
    const { baseElement } = render((<PlitziSdk />) as ReactNode);

    expect(baseElement).toBeTruthy();
  });
});
