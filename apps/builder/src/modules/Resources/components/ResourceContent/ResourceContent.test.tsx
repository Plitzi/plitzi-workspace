import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ResourceContent from './ResourceContent';

import type { PluginManifest } from '@plitzi/sdk-shared';

const manifest = {
  version: 'v1.2.0',
  definition: { name: 'Weather', icon: 'icon.svg', backgroundColor: '#123456' },
  pluginSchema: { weatherCard: {}, forecast: {} }
} as unknown as PluginManifest;

// One preview for a resource wherever it is shown: on its way up, in the list, and in its details.
describe('ResourceContent', () => {
  it('shows a plugin by its manifest, and the size only while it is still being uploaded', () => {
    const uploading = render(<ResourceContent type="plugin" metadata={manifest} size={2048} />);

    expect(uploading.getByText('Weather')).toBeTruthy();
    expect(uploading.getByText('weatherCard, forecast')).toBeTruthy();
    expect(uploading.getByText('2 KB')).toBeTruthy();
    uploading.unmount();

    const uploaded = render(<ResourceContent type="plugin" metadata={manifest} size={2048} isUploaded />);

    expect(uploaded.queryByText('2 KB')).toBeNull();
  });

  it('shows an image as the image, and anything it cannot preview as a file', () => {
    const { container, rerender } = render(<ResourceContent type="image" src="/cat.png" title="Cat" />);

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Cat');

    rerender(<ResourceContent type="template" src="/t.json" />);

    expect(container.querySelector('.fa-file')).not.toBeNull();
  });
});
