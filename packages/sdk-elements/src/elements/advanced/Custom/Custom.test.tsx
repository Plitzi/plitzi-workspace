import { render } from '@testing-library/react';
import { createContext } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { ComponentContext } from '@plitzi/sdk-shared';

import { Custom } from './Custom';
import ElementContext from '../../../Element/ElementContext';

import type { ComponentContextValue } from '@plitzi/sdk-shared';

vi.mock('../../../Element/PluginRemote', () => ({ default: () => {} }));

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: { PluginsContext: createContext({}) }
  })
}));

describe('Custom Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ComponentContext value={{ components: { current: {} } } as ComponentContextValue}>
        <ElementContext value={{ id: '', rootId: '', plitziJsxSkipHOC: true }}>
          <Custom />
        </ElementContext>
      </ComponentContext>
    );

    expect(baseElement).toBeTruthy();
  });
});
