/**
 * A frame loads what its `src` names in this page's origin when that is a `javascript:` URL, so only a web address
 * or a path of the site is loaded.
 */
export const embeddableSrc = (src: string): string | undefined =>
  /^(https?:)?\/\//i.test(src) || (src.startsWith('/') && !src.startsWith('//')) ? src : undefined;
