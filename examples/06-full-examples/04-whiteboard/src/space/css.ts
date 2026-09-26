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
.boardCanvas, .thumbCanvas, .sandboxBoard {
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
  --board-laser: var(--laser);
  --board-font: var(--hand);
  --board-ui-font: var(--ui);
}

/* The sticky pads: the same paper the notes are drawn on. */
.stickyStack {
  --stack-yellow: var(--sticky-yellow);
  --stack-red: var(--sticky-red);
  --stack-orange: var(--sticky-orange);
  --stack-green: var(--sticky-green);
  --stack-blue: var(--sticky-blue);
  --stack-violet: var(--sticky-violet);
  --stack-focus: var(--accent);
}

/* The timer's pill says nothing while no timer runs, and so is not there at all; its last ten seconds pulse. */
.timerPill[data-state='idle'] { display: none; }
.timerPill[data-state='ending'] { color: var(--danger); animation: timer-pulse 1s ease-in-out infinite; }
@keyframes timer-pulse { 50% { transform: translateX(-50%) scale(1.08); } }

/* ── The front page's motion ───────────────────────────────────────────────────────────────────────────────────────
   The marker under the headline, and the scenes of "Better together" (\`home/together.ts\`). Still for a visitor who
   asked for less motion: every animated class there is named \`motion…\`. */
@keyframes wb-marker { from { background-size: 0% 100%; } to { background-size: 100% 100%; } }
@keyframes wb-note {
  0%, 25% { transform: translate(0, 0) rotate(-2deg); }
  50%, 60% { transform: translate(80px, 22px) rotate(3deg); }
  85%, 100% { transform: translate(0, 0) rotate(-2deg); }
}
@keyframes wb-hand {
  0% { transform: translate(-80px, 16px); }
  25% { transform: translate(0, 0); }
  50%, 60% { transform: translate(80px, 22px); }
  85% { transform: translate(0, 0); }
  100% { transform: translate(-80px, 16px); }
}
@keyframes wb-wander {
  0%, 100% { transform: translate(0, 0); }
  30% { transform: translate(-50px, 36px); }
  60% { transform: translate(-16px, -18px); }
}
@keyframes wb-peel {
  0%, 15% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  45%, 76% { transform: translate(104px, -12px) rotate(7deg); opacity: 1; }
  84% { transform: translate(104px, -12px) rotate(7deg); opacity: 0; }
  85% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  95%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
}
@keyframes wb-rise {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  15% { transform: translateY(-12px) scale(1); opacity: 1; }
  100% { transform: translateY(-104px) scale(1.1); opacity: 0; }
}
@keyframes wb-bubble {
  0%, 8% { transform: scale(0); opacity: 0; }
  16%, 70% { transform: scale(1); opacity: 1; }
  80%, 100% { transform: scale(0.9); opacity: 0; }
}
@keyframes wb-orbit { from { transform: rotate(0deg) translateX(48px); } to { transform: rotate(360deg) translateX(48px); } }
@media (prefers-reduced-motion: reduce) {
  [class*='motion'], .heroHighlight { animation: none !important; opacity: 1 !important; }
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
   The box is the form control's \`input\` slot (\`titleInput\`, \`nameInput\`, \`joinBox\`, …); the \`<input>\` inside it is
   not a selector a class reaches, and only has to take the box's type and get out of its way — with a border of its
   own it would draw a second box inside the first. */
.titleInput input, .nameInput input, .joinBox input, .searchBox input, .passwordBox input {
  width: 100%; min-width: 0; padding: 0; border: 0; outline: none; background: transparent; box-shadow: none;
  color: var(--ink); font: inherit; font-size: 14px; text-overflow: ellipsis;
}
.titleInput input::placeholder, .nameInput input::placeholder, .joinBox input::placeholder,
.searchBox input::placeholder, .passwordBox input::placeholder { color: var(--muted); }

/* The theme switch: the icon alone, in the ink colour. */
.themeSwitch svg, .galleryTheme svg { width: 18px; height: 18px; }

/* ── Toasts ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
.Toastify__toast { font-family: var(--ui); font-size: 13px; border: 1px solid var(--edge); box-shadow: 0 12px 30px -12px var(--shadow); }
`;
