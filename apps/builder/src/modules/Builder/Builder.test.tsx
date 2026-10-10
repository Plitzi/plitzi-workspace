import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import AppContext from '@pmodules/App/AppContext';

import Builder from './Builder';

import type { BuilderContextValue } from '@plitzi/sdk-shared';
import type { ComponentProps } from 'react';

const addPopup = vi.fn();
vi.mock('@plitzi/plitzi-ui/Popup', () => ({ usePopup: () => ({ existsPopup: () => false, addPopup }) }));
// The canvas itself is not what is checked here, and needs a whole space to draw.
vi.mock('./components/BuilderArea', () => ({ default: () => <div data-testid="canvas" /> }));
vi.mock('./components/BuilderElementTools/BuilderElementTools', () => ({ default: () => null }));

// Only what `Builder` reads of each context; the rest of their values is not its concern.
const builder = { multiPagesMode: false, mode: 'normal', hasMultiPages: false } as unknown as BuilderContextValue;
const app = { displayMode: 'desktop', previewMode: false } as unknown as ComponentProps<typeof AppContext>['value'];

const Builder$ = ({ pages }: { pages: string[] }) => (
  <AppContext value={app}>
    <BuilderContext value={builder}>
      <Builder pages={pages} />
    </BuilderContext>
  </AppContext>
);

/**
 * The empty state is drawn after every hook of the builder's — `rules-of-hooks` holds the file to it, no longer
 * disabled — and the Tools panel is offered only once there is a page to use it on.
 */
describe('Builder — from no page to the first and back', () => {
  it('draws the canvas once there is a page, the empty state once there is none, and Tools with the first page', () => {
    const { rerender } = render(<Builder$ pages={[]} />);
    expect(screen.getByText('Please add your first page')).toBeTruthy();
    expect(addPopup).not.toHaveBeenCalled();

    rerender(<Builder$ pages={['home']} />);
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(addPopup).toHaveBeenCalledWith(
      'element-tools',
      expect.anything(),
      expect.objectContaining({ title: 'Tools' })
    );

    rerender(<Builder$ pages={[]} />);
    expect(screen.getByText('Please add your first page')).toBeTruthy();
  });
});
