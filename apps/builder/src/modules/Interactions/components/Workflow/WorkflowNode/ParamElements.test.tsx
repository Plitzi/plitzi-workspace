import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ParamElements from './ParamElements';
import WorkflowContext from '../WorkflowContext';

import type { WorkflowContextValue } from '../WorkflowContext';
import type { ElementInteraction } from '@plitzi/sdk-shared';

// A param key is typed as a node key throughout the editor — `NodeBody` casts the same way — though it names a param.
const paramId = 'elements' as keyof ElementInteraction;

const context = {
  direction: 'vertical',
  elements: [
    { id: 'members', type: 'apiContainer', label: 'Members' },
    { id: 'orders', type: 'apiContainer', label: 'Orders' },
    { id: 'title', type: 'heading', label: 'Heading' }
  ]
} as WorkflowContextValue;

const renderPicker = (value: unknown, onChange = vi.fn()) => {
  render(
    <WorkflowContext value={context}>
      <ParamElements id={paramId} label="Containers" value={value} elementType="apiContainer" onChange={onChange} />
    </WorkflowContext>
  );

  return onChange;
};

describe('ParamElements', () => {
  it('shows what is picked, including an id nothing answers to any more', () => {
    renderPicker(['orders', 'gone']);

    expect(screen.getByText('orders · Orders')).toBeTruthy();
    expect(screen.getByTitle('No element has this id any more')).toBeTruthy();
  });

  it('removes one id and keeps the rest', () => {
    const onChange = renderPicker(['orders', 'members']);

    fireEvent.click(screen.getAllByTitle('Remove')[0]);

    expect(onChange).toHaveBeenCalledWith(paramId, ['members']);
  });
});
