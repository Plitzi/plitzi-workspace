import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSdkStore } from '@plitzi/sdk-shared/store';

import ThemedRoot from './ThemedRoot';

vi.mock('@plitzi/sdk-shared', () => ({ useTheme: () => ({ theme: 'system' }) }));
vi.mock('@plitzi/sdk-shared/store', () => ({ useSdkStore: vi.fn() }));

const rootWith = (hydrated: boolean) => {
  vi.mocked(useSdkStore).mockReturnValue([[hydrated]] as unknown as ReturnType<typeof useSdkStore>);

  return render(<ThemedRoot className="plitzi-sdk">page</ThemedRoot>).container.firstElementChild;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ThemedRoot', () => {
  it('says the page is interactive only once it has been hydrated', () => {
    expect(rootWith(false)?.hasAttribute('data-hydrated')).toBe(false);
    expect(rootWith(true)?.getAttribute('data-hydrated')).toBe('');
  });

  // jsdom cannot tell what is on screen, so every arrival waiting to be seen is shown at once — what is checked here
  // is that the root watches its tree (`revealOnView` has its own tests).
  it('plays the arrivals that wait to be seen', () => {
    vi.mocked(useSdkStore).mockReturnValue([[true]] as unknown as ReturnType<typeof useSdkStore>);
    const { container } = render(
      <ThemedRoot>
        <div data-motion-on="view" data-motion-enter="fade-up" />
      </ThemedRoot>
    );

    expect(container.querySelector('[data-motion-on="view"]')?.hasAttribute('data-motion-seen')).toBe(true);
  });
});
