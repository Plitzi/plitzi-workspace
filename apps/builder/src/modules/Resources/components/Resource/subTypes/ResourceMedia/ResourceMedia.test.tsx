import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceMedia from './ResourceMedia';

import type { ResourceMediaProps } from './ResourceMedia';

const onDragStart = vi.fn();

vi.mock('@pmodules/Elements/hooks/useDragElement', () => ({ default: () => ({ onDragStart }) }));

const renderMedia = (props: Pick<ResourceMediaProps, 'type' | 'src'>) => {
  const setDraggingFile = vi.fn();
  const view = render(
    <ResourcesListContext value={{ isFileMoving: false, setDraggingFile, setIsFileMoving: vi.fn() }}>
      <ResourceMedia id="res-1" title="Clip" directoryName="media" onRemove={vi.fn()} {...props} />
    </ResourcesListContext>
  );

  return { ...view, setDraggingFile };
};

describe('ResourceMedia', () => {
  it('shows an image as an image and a video as a video', () => {
    const image = renderMedia({ type: 'image', src: '/cat.png' });

    expect(image.container.querySelector('img')?.getAttribute('src')).toBe('/cat.png');
    expect(image.container.querySelector('video')).toBeNull();
    image.unmount();

    const video = renderMedia({ type: 'video', src: '/clip.mp4' });

    expect(video.container.querySelector('video')?.getAttribute('src')).toBe('/clip.mp4');
    expect(video.container.querySelector('img')).toBeNull();
  });

  // The video used to be dragged as an image, and kept its remove button under the cursor while dragged.
  it.each(['image', 'video'] as const)('drags a %s as what it is, without its remove button', type => {
    const { container, queryByTitle, setDraggingFile } = renderMedia({ type, src: '/media' });
    const card = container.firstElementChild;

    if (!card) {
      throw new Error('ResourceMedia rendered nothing');
    }

    expect(queryByTitle('Remove')).not.toBeNull();

    fireEvent.dragStart(card);

    expect(onDragStart).toHaveBeenCalled();
    expect(setDraggingFile).toHaveBeenCalledWith({ id: 'res-1', type, directoryName: 'media' });
    expect(queryByTitle('Remove')).toBeNull();

    fireEvent.dragEnd(card);

    expect(queryByTitle('Remove')).not.toBeNull();
  });
});
