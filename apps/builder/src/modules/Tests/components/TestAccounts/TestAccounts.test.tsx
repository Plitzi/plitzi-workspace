// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TestAccounts from './TestAccounts';
import useMayTest from '../../hooks/useMayTest';
import useSaveSpaceTests from '../../hooks/useSaveSpaceTests';
import TestStudioContext from '../../studio/TestStudioContext';

import type { TestStudioValue } from '../../studio/TestStudioContext';
import type { SpaceTests } from '@plitzi/sdk-shared';

vi.mock('../../hooks/useMayTest', () => ({ default: vi.fn() }));
vi.mock('../../hooks/useSaveSpaceTests', () => ({ default: vi.fn() }));

const tests: SpaceTests = {
  unit: [],
  e2e: [{ id: 'edits', title: 'An editor edits a page', page: '/', as: 'editor', steps: [] }],
  accounts: [{ id: 'editor', roles: ['editor'] }]
};

const area = (load = vi.fn()) => {
  vi.mocked(useMayTest).mockReturnValue({ mayTest: true });
  const store = vi.fn(() => Promise.resolve({ ok: true as const }));
  vi.mocked(useSaveSpaceTests).mockReturnValue(store);
  // What the card reads of the studio: the tests saved, the flow chosen, whether it plays, and how a save is loaded.
  const studio = { tests, flow: undefined, mode: 'idle', load } as unknown as TestStudioValue;
  render(
    <TestStudioContext value={studio}>
      <TestAccounts />
    </TestStudioContext>
  );

  return { store, load };
};

describe('the test accounts card', () => {
  it('adds an account, saved with the rest of the tests', async () => {
    const { store, load } = area();
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'viewer' } });
    fireEvent.change(screen.getByLabelText('Roles'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(store).toHaveBeenCalledWith({
      ...tests,
      accounts: [
        { id: 'editor', roles: ['editor'] },
        { id: 'viewer', roles: ['viewer'] }
      ]
    });
  });

  it('keeps an account a journey plays as, and says which', () => {
    const { store } = area();
    fireEvent.click(screen.getByTitle('Remove editor'));

    expect(
      screen.getByText('An editor edits a page plays as editor: play it as a guest or another account first.')
    ).toBeTruthy();
    expect(store).not.toHaveBeenCalled();
  });
});
