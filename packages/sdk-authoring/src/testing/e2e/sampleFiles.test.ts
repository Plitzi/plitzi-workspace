// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { pickFile, sampleFile } from './sampleFiles';

/**
 * A journey on a page with a file field had no way to fill it: a `type` step wrote the name into it as text, which a
 * file field does not take. It picks a small file of the kind the name says, real enough that a server reading the
 * first bytes keeps or refuses it for the reason a visitor's upload would be.
 */

const bytesOf = (base64: string): number[] => Array.from(Uint8Array.from(atob(base64), char => char.charCodeAt(0)));

describe('the file a step names', () => {
  it('is a real file of that kind, from its first bytes', () => {
    const signatures: Record<string, number[]> = {
      'me.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      'me.JPEG': [0xff, 0xd8, 0xff],
      'me.gif': [0x47, 0x49, 0x46, 0x38],
      'me.webp': [0x52, 0x49, 0x46, 0x46],
      'cv.pdf': [0x25, 0x50, 0x44, 0x46]
    };

    for (const [name, signature] of Object.entries(signatures)) {
      const file = sampleFile(name);
      if ('problem' in file) {
        throw new Error(file.problem);
      }

      expect(bytesOf(file.base64).slice(0, signature.length), name).toEqual(signature);
      expect(file.name).toBe(name);
    }

    expect(sampleFile('rows.csv')).toMatchObject({ name: 'rows.csv', type: 'text/csv' });
  });

  it('is refused, with the kinds there are, when its name ends in none of them', () => {
    expect(sampleFile('photo')).toEqual({ problem: expect.stringContaining('ending in png, jpg') as string });
    expect(sampleFile('song.mp3')).toEqual({ problem: expect.stringContaining('"song.mp3" is no file') as string });
  });
});

describe('a file picked in the page', () => {
  it('is in the field’s files, and the field says it changed', () => {
    document.body.innerHTML = '<input type="file" id="photo"><input type="text" id="name">';
    const field = document.getElementById('photo') as HTMLInputElement;
    // jsdom has no DataTransfer and takes only its own FileList; a browser has both.
    vi.stubGlobal(
      'DataTransfer',
      class {
        list: File[] = [];
        items = { add: (file: File) => this.list.push(file) };
        get files() {
          return this.list;
        }
      }
    );
    let held: File[] = [];
    Object.defineProperty(field, 'files', {
      get: () => held,
      set: (files: File[]) => {
        held = files;
      }
    });
    const changed = vi.fn();
    field.addEventListener('change', changed);
    const file = sampleFile('me.png');
    if ('problem' in file) {
      throw new Error(file.problem);
    }

    expect(pickFile(field, file)).toBe(true);
    expect(field.files?.[0]?.name).toBe('me.png');
    expect(field.files?.[0]?.type).toBe('image/png');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(pickFile(document.getElementById('name') as HTMLInputElement, file)).toBe(false);
    vi.unstubAllGlobals();
  });
});
