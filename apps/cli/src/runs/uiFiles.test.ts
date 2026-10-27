import { describe, expect, it } from 'vitest';

import { isUiFile } from './uiFiles';

describe('what a visitor sees', () => {
  it('is the space’s document and what a plugin draws, never a plugin’s other modules nor a test', () => {
    expect(isUiFile('src/space/pages/room.ts')).toBe(true);
    expect(isUiFile('src/plugins/Player/Player.tsx')).toBe(true);
    expect(isUiFile('src/plugins/Player/Player.css')).toBe(true);
    // A card that only made the player's loader retry was asked for a designer.
    expect(isUiFile('src/plugins/Player/youtube.ts')).toBe(false);
    expect(isUiFile('src/plugins/Player/declaration.ts')).toBe(false);
    expect(isUiFile('src/plugins/Player/Player.test.tsx')).toBe(false);
    expect(isUiFile('src/space/data/shows.json')).toBe(false);
    expect(isUiFile('src/functions/shows.ts')).toBe(false);
  });
});
