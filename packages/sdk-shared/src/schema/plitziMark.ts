/**
 * Plitzi's mark — the stacked layers, the home's, which the spaces draw as Font Awesome's `layer-group` glyph
 * — as a picture: white layers on the brand's violet, in a rounded square that reads at a tab's 16 px. The one drawing
 * every surface shows where it cannot draw the glyph: a tab that names no icon, the builder's bar, a static deploy, a
 * mail (rasterized). The layers are Font Awesome Free's glyph, CC BY 4.0, its attribution kept in the drawing.
 */
export const PLITZI_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><!-- The layers: Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0) Copyright 2026 Fonticons, Inc. --><rect width="512" height="512" rx="112" fill="#5b3df5"/><path fill="#ffffff" transform="translate(102 102) scale(0.6)" d="M232.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L13.9 149.8C5.4 145.8 0 137.3 0 128s5.4-17.9 13.9-21.8L232.5 5.2zM48.1 218.4l164.3 75.9c27.7 12.8 59.6 12.8 87.3 0l164.3-75.9 34.1 15.8c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L13.9 277.8C5.4 273.8 0 265.3 0 256s5.4-17.9 13.9-21.8l34.1-15.8zM13.9 362.2l34.1-15.8 164.3 75.9c27.7 12.8 59.6 12.8 87.3 0l164.3-75.9 34.1 15.8c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L13.9 405.8C5.4 401.8 0 393.3 0 384s5.4-17.9 13.9-21.8z"/></svg>`;

/** The mark as an address a page can draw it from without asking any site for it: `<img src>`, a link's icon. */
export const PLITZI_MARK_DATA_URL = `data:image/svg+xml,${encodeURIComponent(PLITZI_MARK_SVG)}`;
