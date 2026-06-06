import { toggleTheme } from '../../useTheme';

// Both icons are always rendered; CSS (`html.light`) reveals only the one for the *other* theme, so the button
// shows what you'll switch to — no JSX branching needed.
const ThemeToggle = () => (
  <button
    type="button"
    onClick={toggleTheme}
    aria-label="Toggle color theme"
    title="Toggle light / dark"
    className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:bg-ink-700 flex h-9 w-9 items-center justify-center rounded-lg border text-zinc-400 transition hover:text-white"
  >
    <svg className="theme-icon-moon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <svg className="theme-icon-sun h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

export default ThemeToggle;
