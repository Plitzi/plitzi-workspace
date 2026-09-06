import { use, useMemo } from 'react';

import { useFontHead } from '@plitzi/sdk-shared/hooks';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { fontsToHead, fontUrlResolver, googleTextSubsetUrl } from '@plitzi/sdk-shared/style';

import { fontsBaseUrl } from '../fontsBaseUrl';

import type { FontHead, SpaceFont } from '@plitzi/sdk-shared';

/** Module-level, so a space that declares nothing keeps one reference across every render. */
const NO_FONTS: SpaceFont[] = [];

/**
 * Loads the space's families into the EDITOR's document, so a font can be chosen by looking at it.
 *
 * The canvas is an iframe with a document of its own: everything it loads is invisible to the panels around it,
 * which is why the picker used to draw every family name in the same interface font. It was given a fixed Google
 * stylesheet for exactly this, subsetted to the glyphs of eighteen hard-coded names — except the ampersand in that
 * URL was HTML-escaped, so the subsetting was silently ignored and the browser fetched the families whole.
 *
 * Two different requests, because the two kinds of font are worth loading to different depths:
 *
 * - Google families are fetched for the LETTERS OF THEIR OWN NAMES (`text=`), a few hundred bytes for the whole
 *   list. Enough to draw an option; deliberately useless for anything else.
 * - What the space hosts or points at is loaded properly. There is no subsetting endpoint in front of somebody
 *   else's CDN, and these are the space's own files.
 */
const FontPreviews = () => {
  const [fonts = NO_FONTS] = useBuilderStore('style.fonts');
  const { server } = use(NetworkContext);

  const head = useMemo<FontHead>(() => {
    const googleFamilies = fonts.filter(font => font.source === 'google').map(font => font.family);
    const rest = fonts.filter(font => font.source === 'remote' || font.source === 'hosted');
    const resolved = fontsToHead(rest, fontUrlResolver(fontsBaseUrl(server)));

    if (googleFamilies.length === 0) {
      return resolved;
    }

    return {
      ...resolved,
      links: [
        ...resolved.links,
        { href: googleTextSubsetUrl(googleFamilies, googleFamilies.join('')), rel: 'stylesheet' as const }
      ]
    };
  }, [fonts, server]);

  useFontHead(head);

  return null;
};

export default FontPreviews;
