// jest.mock('plitziSdkFederation/usePlitziServiceContext');

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import Paragraph from './Paragraph';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

describe('Paragraph Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(<Paragraph internalProps={defaultInternalProps} />);

    expect(baseElement).toBeTruthy();
  });
});
