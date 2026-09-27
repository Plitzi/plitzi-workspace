/**
 * Pizarra's mark: a board in the accent, a sticky note on it, a stroke drawn by hand, and a collaborator's cursor —
 * what the tool is, in one square. One SVG, served by the example (`/brand/pizarra.svg`) and shown wherever the name is.
 */
export const BRAND_PATH = '/brand/pizarra.svg';

export const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="board" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d5dfc"/>
      <stop offset="1" stop-color="#9b4dea"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#board)"/>
  <g transform="rotate(-8 24 25)">
    <rect x="11" y="12" width="25" height="25" rx="3" fill="#ffe27a"/>
    <path d="M16 21h14M16 27h9" stroke="#8a6d10" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <path d="M12 49c7-7 13 2 20-4s10-9 17-6" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <path d="M41 19l12 7-5.4 1.6L46 33z" fill="#ff7a59" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
