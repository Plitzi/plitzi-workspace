import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NodeBodyParam from './NodeBodyParam';

// The editor itself does not run under jsdom; what is under test is what is said beside it.
vi.mock('@plitzi/plitzi-ui/CodeMirror', () => ({ default: () => null }));

const renderParam = (value: string, type: 'codemirror-text' | 'text' = 'codemirror-text') =>
  render(<NodeBodyParam id="params" type={type} canBind={false} value={value} fields={{}} />);

describe('NodeBodyParam', () => {
  it('says what the runtime would read past while the template is being written', () => {
    const { getByText } = renderParam('{{ state.name matches "^A" }}');

    expect(getByText(/This template cannot be read as written/)).toBeTruthy();
  });

  it('says it in a plain text param too', () => {
    const { getByText } = renderParam('{{ state.name|nofilter }}', 'text');

    expect(getByText(/nofilter/)).toBeTruthy();
  });

  it('says nothing about a template the runtime reads', () => {
    const { queryByText } = renderParam('{{ state.name|upper }}');

    expect(queryByText(/cannot be read as written/)).toBeNull();
  });
});
