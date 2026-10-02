import { renderHook } from '@testing-library/react';
import { createContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useSaveAsSnippet from './useSaveAsSnippet';

import type { Element } from '@plitzi/sdk-shared';

type FormAnswer = { name: string; description?: string; cdnIdentifier: string; bucketIdentifier: string };

const form = vi.hoisted((): { answer?: FormAnswer } => ({}));
const toast = vi.hoisted(() => vi.fn<(content: unknown, options: { appeareance?: string }) => void>());
const save = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/plitzi-ui/Modal', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Modal')>()),
  useModal: () => ({ showModal: () => Promise.resolve(form.answer) })
}));
vi.mock('@plitzi/plitzi-ui/Toast', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Toast')>()),
  useToast: () => ({ addToast: toast })
}));
vi.mock('@plitzi/sdk-shared/builder/contexts/BuilderContext', () => ({
  default: createContext({ elementAsSnippet: save })
}));

const card: Element = {
  id: 'card',
  attributes: {},
  definition: { label: 'Card', type: 'container', rootId: 'home', parentId: 'home', styleSelectors: { base: '' } }
};

const appearanceOfLastToast = () => toast.mock.lastCall?.[1].appeareance;

describe('useSaveAsSnippet', () => {
  beforeEach(() => {
    toast.mockReset();
    save.mockReset();
    form.answer = { name: 'Pricing', cdnIdentifier: 'cdn', bucketIdentifier: 'public' };
  });

  it('uploads what the form answered and says so once the upload did', async () => {
    save.mockResolvedValue({ saved: true });
    const { result } = renderHook(() => useSaveAsSnippet());

    await expect(result.current(card)).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith(
      { cdnIdentifier: 'cdn', bucketIdentifier: 'public' },
      { name: 'Pricing', description: '' },
      card
    );
    expect(appearanceOfLastToast()).toBe('success');
  });

  it('never announces a snippet the upload refused', async () => {
    save.mockResolvedValue({ saved: false, reason: 'The bucket is private.' });
    const { result } = renderHook(() => useSaveAsSnippet());

    await expect(result.current(card)).resolves.toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(appearanceOfLastToast()).toBe('error');
  });

  it('does nothing when the form is closed', async () => {
    form.answer = undefined;
    const { result } = renderHook(() => useSaveAsSnippet());

    await expect(result.current(card)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
