import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ModelSelector from './ModelSelector';

import type { AiModelInfo } from '@pmodules/AI/types';

const models: AiModelInfo[] = [
  { id: 'anthropic/claude-sonnet', name: 'Sonnet' },
  { id: 'anthropic/claude-opus', name: 'Opus' },
  { id: 'openai/gpt-mini', name: 'GPT mini' }
];

const openSelector = () => {
  const onChange = vi.fn();
  const view = render(<ModelSelector models={models} currentModel="anthropic/claude-sonnet" onChange={onChange} />);
  fireEvent.click(view.getByTitle('Change model'));

  return { ...view, onChange };
};

// The footer promises ↑↓ to navigate and ↵ to select; both used to be swallowed without doing anything.
describe('ModelSelector', () => {
  // jsdom lays nothing out, so it has no scrolling to do.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('moves through the list with the arrows and selects with enter', () => {
    const { onChange } = openSelector();

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('anthropic/claude-opus');
  });

  it('starts over at the first match of a new search', () => {
    const { getByPlaceholderText, onChange } = openSelector();

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.change(getByPlaceholderText('Search models…'), { target: { value: 'gpt' } });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('openai/gpt-mini');
  });
});
