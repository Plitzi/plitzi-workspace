/**
 * What no class can say: the document itself, the custom properties the plugins read, and the inside of widgets
 * whose markup is not the space's.
 *
 * Every other rule is a `styles()` declaration beside the element it dresses.
 */
export const customCss = `
html, body { margin: 0; background: var(--paper); overscroll-behavior: none; }
body { font-family: var(--ui); color: var(--ink); -webkit-font-smoothing: antialiased; }

/* ── The canvas's palette ──────────────────────────────────────────────────────────────────────────────────────────
   The board ships no colours: it paints with these, pointed here at the space's tokens. A theme switch changes the
   tokens, the canvas reads them again, and every drawing recolours with the page. */
.boardCanvas, .thumbCanvas {
  --board-paper: var(--paper);
  --board-dots: var(--dots);
  --board-accent: var(--accent);
  --board-ink: var(--ink);
  --board-red: var(--red);
  --board-orange: var(--orange);
  --board-green: var(--green);
  --board-blue: var(--blue);
  --board-violet: var(--violet);
  --board-fill-red: var(--fill-red);
  --board-fill-orange: var(--fill-orange);
  --board-fill-yellow: var(--fill-yellow);
  --board-fill-green: var(--fill-green);
  --board-fill-blue: var(--fill-blue);
  --board-fill-violet: var(--fill-violet);
  --board-sticky-yellow: var(--sticky-yellow);
  --board-sticky-red: var(--sticky-red);
  --board-sticky-orange: var(--sticky-orange);
  --board-sticky-green: var(--sticky-green);
  --board-sticky-blue: var(--sticky-blue);
  --board-sticky-violet: var(--sticky-violet);
  --board-font: var(--hand);
  --board-ui-font: var(--ui);
}

/* The share card's QR code stays dark on light in both schemes: a code is read by contrast. */
.shareCard {
  --share-accent: var(--accent);
  --share-on-accent: var(--on-accent);
  --share-field: var(--surface-2);
  --share-ink: #16161c;
  --share-paper: #ffffff;
}

/* ── Fields ────────────────────────────────────────────────────────────────────────────────────────────────────────
   The box is the form control's \`input\` slot (\`titleInput\`, \`nameInput\`); the \`<input>\` inside it is not a selector a
   class reaches, and only has to take the box's type and get out of its way. */
.titleInput input, .nameInput input {
  width: 100%; min-width: 0; padding: 0; border: 0; outline: none; background: transparent;
  color: var(--ink); font: inherit; font-size: 14px; text-overflow: ellipsis;
}
.titleInput input::placeholder, .nameInput input::placeholder { color: var(--muted); }

/* The theme switch: the icon alone, in the ink colour. */
.themeSwitch svg, .galleryTheme svg { width: 18px; height: 18px; }

/* ── Toasts ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
.Toastify__toast { font-family: var(--ui); font-size: 13px; border: 1px solid var(--edge); box-shadow: 0 12px 30px -12px var(--shadow); }
`;
