/**
 * What no class can say: keyframes, pseudo-elements, a rule across the document, the inside of a widget.
 *
 * Every other rule of the display is a `styles()` declaration beside the element it dresses. What is left here is
 * the handful that cannot be: the colours the map asks for (custom properties are not in the style vocabulary), the
 * scanlines and the frame (pseudo-elements), the boot sequence (keyframes), and the toasts (a library's markup).
 */
export const customCss = `
/* The document itself: a full-screen instrument has no margin and nothing to scroll. */
html, body { background: var(--void); margin: 0; overscroll-behavior: none; }
body { font-family: var(--mono); color: var(--ink); -webkit-font-smoothing: antialiased; }

/* ── The map's palette ─────────────────────────────────────────────────────────────────────────────────────────────
   The globe ships no colours: it paints with these, and this is the one place they are pointed at the space's tokens.
   A theme switch changes the tokens, the element re-reads them, and the world recolours with everything else. */
.mapCanvas {
  --seismic-ocean: var(--ocean);
  --seismic-land: var(--land);
  --seismic-coast: var(--coast);
  --seismic-border: var(--border);
  --seismic-graticule: var(--graticule);
  --seismic-plate: var(--plate);
  --seismic-shallow: var(--shallow);
  --seismic-intermediate: var(--intermediate);
  --seismic-deep: var(--deep);
  --seismic-accent: var(--trace);
  --seismic-halo: var(--halo);
  --seismic-panel: var(--panel-strong);
  --seismic-ink: var(--ink);
  --seismic-readout-top: 90px;
  background: radial-gradient(ellipse at 50% 46%, color-mix(in srgb, var(--trace) 7%, var(--void)) 0%, var(--void) 62%);
}

/* ── The display ───────────────────────────────────────────────────────────────────────────────────────────────────
   Scanlines and one slow sweep, at an opacity where you see them only once you look for them. They are the only things
   on screen that are not data, and they say the instrument is powered. Above the map, under the panels. */
.screen::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background:
    repeating-linear-gradient(to bottom, var(--scanline) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse at center, transparent 55%, color-mix(in srgb, var(--void) 70%, transparent) 100%);
}
.screen::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--trace) 5%, transparent), transparent);
  animation: tremor-sweep 16s linear infinite;
}

/* The frame: four corner marks on the display's own edge, drawn once here rather than as four elements. */
.hud::before, .hud::after {
  content: ''; position: absolute; width: 22px; height: 22px; pointer-events: none;
  border: 1px solid var(--trace); opacity: 0.5;
}
.hud::before { top: 8px; left: 8px; border-right: 0; border-bottom: 0; }
.hud::after { bottom: 8px; right: 8px; border-left: 0; border-top: 0; }

/* Corner brackets on every panel, so the furniture reads as one instrument. */
.commandBar::before, .livePopup::before, .navPanel::before, .boardPanel::before, .activityPanel::before, .logPanel::before, .legendPanel::before,
.controlPanel::before, .dossier::before, .strongestPanel::before {
  content: ''; position: absolute; top: -1px; left: -1px; width: 9px; height: 9px; pointer-events: none;
  border-top: 1px solid var(--trace); border-left: 1px solid var(--trace);
}
.commandBar::after, .livePopup::after, .navPanel::after, .boardPanel::after, .activityPanel::after, .logPanel::after, .legendPanel::after,
.controlPanel::after, .dossier::after, .strongestPanel::after {
  content: ''; position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; pointer-events: none;
  border-bottom: 1px solid var(--trace); border-right: 1px solid var(--trace);
}

/* The theme switch is a widget of the SDK's: its chosen option says so with an attribute, not a class. */
.themeSwitch [data-active='true'] { color: var(--void); background-color: var(--trace); border-color: var(--trace); font-weight: 700; }

/* The log's search box. A form control's inner input is not a selector a class reaches, so it is dressed here. */
.logSearch label { display: none; }
.logSearch .plitzi__formControl-input { padding: 0; border: 0; background: none; }
.logSearch input {
  width: 100%; height: 30px; padding: 0 10px; border-radius: 0; border: 1px solid var(--edge);
  background: var(--cell); color: var(--ink); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  outline: none;
}
.logSearch input::placeholder { color: var(--dim); }
.logSearch input:focus-visible { border-color: var(--trace); box-shadow: 0 0 0 1px var(--trace); }

/* The gear: an outline drawn as a mask, so it is whatever colour the button is — and it turns as the panel opens. */
.gearIcon {
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'/%3E%3Cpath d='M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1Z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'/%3E%3Cpath d='M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1Z'/%3E%3C/svg%3E") center / contain no-repeat;
  transition: transform 420ms cubic-bezier(0.2, 0.9, 0.2, 1);
}
.gearButton:hover .gearIcon { transform: rotate(45deg); }
.gearButton--open .gearIcon { transform: rotate(120deg); }

/* The settings panel arrives from the gear. */
.controlPanel { animation: tremor-unfold 320ms cubic-bezier(0.2, 0.9, 0.2, 1) both; transform-origin: bottom right; }

/* The live dot breathes while the page is listening, and stops when it is paused. */
.liveDot.liveDot--paused { animation: none; }

/* The live dot breathes; the lock mark blinks while it is new. */
.liveDot { animation: tremor-live 1.6s ease-in-out infinite; }
.lockMark { animation: tremor-blink 1s steps(2, jump-none) 3; }

/* A dossier arrives like a readout being written: it unfolds from its top edge. */
.dossier { animation: tremor-unfold 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both; transform-origin: top center; }

/* The contact log's own scrollbar, in the trace. */
.rows { scrollbar-width: thin; scrollbar-color: var(--edge) transparent; }

/* ── Boot ──────────────────────────────────────────────────────────────────────────────────────────────────────────
   The globe takes a moment to build its first frame. The display covers that moment instead of showing a black
   rectangle — and then gets out of the way for good. It claims nothing about the data: it only says what this is. */
.boot { animation: tremor-boot 1.9s ease-in forwards; }
.bootBar::after {
  content: ''; position: absolute; inset: 0; background: var(--trace); transform-origin: left center;
  animation: tremor-load 1.3s cubic-bezier(0.6, 0, 0.2, 1) forwards;
}

/* A cursor readout is a mouse's instrument, and on a screen this narrow the filters wrap over where it would sit. */
@media (max-width: 64rem) {
  .mapCanvas { --seismic-readout-top: 130px; }
  .mapCanvas .seismic__cursor { display: none; }
}

/* ── Walls and TVs ─────────────────────────────────────────────────────────────────────────────────────────────────
   A TV is read from across a room, a monitor from arm's length — and the two can be exactly as many pixels wide, so
   the screen's size says nothing about how big the display should be. The reader says it instead (SIZE, in the
   Display panel), and the heads-up display scales as ONE piece: it keeps its proportions instead of leaving small
   panels in the corners of a vast globe. zoom is not in the style vocabulary, so it is set here, per variant. */
.hud.hud--wall { zoom: 1.3; }
.hud.hud--tv { zoom: 1.7; }
/* The globe's own readouts sit under the bar, which a larger display makes taller. */
.screen:has(.hud--wall) .mapCanvas { --seismic-readout-top: 112px; }
.screen:has(.hud--tv) .mapCanvas { --seismic-readout-top: 140px; }

/* ── Toasts ────────────────────────────────────────────────────────────────────────────────────────────────────── */
.Toastify__toast {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
  border: 1px solid var(--edge); box-shadow: 0 0 40px -16px var(--trace-glow); backdrop-filter: blur(10px);
}
.Toastify__toast--error { border-color: var(--shallow); box-shadow: 0 0 40px -12px var(--shallow); }

/* ── Motion ────────────────────────────────────────────────────────────────────────────────────────────────────── */
@keyframes tremor-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes tremor-live { 50% { opacity: 0.35; box-shadow: 0 0 2px var(--shallow); } }
@keyframes tremor-blink { 50% { opacity: 0.25; } }
@keyframes tremor-unfold {
  from { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(8px); }
  to { opacity: 1; clip-path: inset(0 0 0 0); transform: none; }
}
@keyframes tremor-boot { 0%, 72% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
@keyframes tremor-load { from { transform: scaleX(0); } to { transform: scaleX(1); } }

@media (prefers-reduced-motion: reduce) {
  .screen::before, .liveDot, .lockMark, .dossier, .controlPanel { animation: none; }
  .gearIcon { transition: none; }
  .boot { display: none; }
}
`;
