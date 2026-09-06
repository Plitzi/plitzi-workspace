import { useMemo } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';
import { availableFonts } from '@plitzi/sdk-shared/style';

import type { SpaceFont } from '@plitzi/sdk-shared';

/** Module-level, so a space that declares nothing keeps one reference across every render. */
const NO_FONTS: SpaceFont[] = [];

/**
 * What this space can name: the families it declared, over the system stacks that are always available.
 *
 * Read from the store rather than passed down, because the picker is four components below whoever holds the style
 * document — the prop that was meant to carry them existed for years and no call site ever filled it, so every
 * space was offered the same hard-coded eighteen names whatever it had actually installed.
 */
const useSpaceFonts = (): SpaceFont[] => {
  const [fonts = NO_FONTS] = useCommonStore('style.fonts');

  return useMemo(() => availableFonts(fonts), [fonts]);
};

export default useSpaceFonts;
