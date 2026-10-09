import { afterEach, describe, expect, it, vi } from 'vitest';

import generateFacade from './generateFacade';

describe('generateFacade', () => {
  afterEach(() => {
    document.head.querySelectorAll('script[type="importmap"]').forEach(script => script.remove());
    Reflect.deleteProperty(window, 'TestFacade');
    vi.restoreAllMocks();
  });

  it('publishes each module on window by its name, and maps its import to a module that re-exports it', async () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
      if (blob instanceof Blob) {
        blobs.push(blob);
      }

      return `blob:${blobs.length}`;
    });
    const sdkShared = { isRecord: () => true, default: 'whole' };

    generateFacade({ '@plitzi/sdk-shared': sdkShared }, 'TestFacade');

    expect(Reflect.get(window, 'TestFacade')).toEqual({ PlitziSdkShared: sdkShared });
    const map = document.head.querySelector('script[type="importmap"]')?.textContent ?? '';
    expect(JSON.parse(map)).toEqual({ imports: { '@plitzi/sdk-shared': 'blob:1' } });
    expect(await blobs[0].text()).toBe(
      'export default window.TestFacade.PlitziSdkShared;export const isRecord = window.TestFacade.PlitziSdkShared.isRecord;'
    );
  });

  it('leaves a module an import map already maps to whoever mapped it', () => {
    const existing = document.createElement('script');
    existing.type = 'importmap';
    existing.textContent = JSON.stringify({ imports: { react: '/react.js' } });
    document.head.appendChild(existing);

    generateFacade({ react: {} }, 'TestFacade');

    expect(Reflect.get(window, 'TestFacade')).toBeUndefined();
    expect(document.head.querySelectorAll('script[type="importmap"]')).toHaveLength(1);
  });
});
