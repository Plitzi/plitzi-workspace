/**
 * The monitor's look: Plitzi's own colours — the website's brand tokens — for a dark terminal and a light one. One
 * accent, three tones of text, colour kept for what a state means; each agent a hue of its own, the same everywhere on
 * the panel, so one agent is followed down the activity by its colour alone.
 */

export type ThemeName = 'dark' | 'light';

export interface Theme {
  name: ThemeName;
  /** The panel's ground, a surface on it (the sidebar, the head), one raised over that (a dialog), and a selected row. */
  base: string;
  surface: string;
  elevated: string;
  selection: string;
  border: string;
  /** Text: what is read, what explains it, what only places it. */
  text: string;
  muted: string;
  subtle: string;
  primary: string;
  /** A task's id, a link: what a person opens. */
  link: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  successBg: string;
  warningBg: string;
  dangerBg: string;
  infoBg: string;
  /** The agents' hues, in the order the team lists them: the lead's first. */
  agents: readonly string[];
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    base: '#0b0b11',
    surface: '#12121a',
    elevated: '#1a1a25',
    selection: '#1e1a3a',
    border: '#262633',
    text: '#ededf3',
    muted: '#9a9aae',
    subtle: '#5f5f75',
    primary: '#7c62f8',
    link: '#b7a6ff',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#fb6a63',
    info: '#8ab0f7',
    successBg: '#0e2a1c',
    warningBg: '#2e2314',
    dangerBg: '#331618',
    infoBg: '#13203c',
    agents: ['#b7a6ff', '#67d8ef', '#f5c169', '#f994bc', '#64d6a6', '#8ab0f7', '#fda4af', '#a3e635']
  },
  light: {
    name: 'light',
    base: '#f5f5f8',
    surface: '#ffffff',
    elevated: '#ececf3',
    selection: '#efecfe',
    border: '#e2e2eb',
    text: '#0c0c14',
    muted: '#5c5c70',
    subtle: '#9a9aae',
    primary: '#5b3df5',
    link: '#4b31e0',
    success: '#12a150',
    warning: '#b45309',
    danger: '#dc2626',
    info: '#2159c4',
    successBg: '#e0f6ee',
    warningBg: '#fcf0dc',
    dangerBg: '#fde8e8',
    infoBg: '#e6edfc',
    agents: ['#5b3df5', '#0e7490', '#a45b00', '#c2255c', '#0f7b55', '#2159c4', '#be123c', '#4d7c0f']
  }
};

/** Each agent's hue, by its place in the team: stable while the panel is up, the lead's the accent's. */
export const agentHues = (theme: Theme, agents: readonly string[]): ReadonlyMap<string, string> =>
  new Map(agents.map((agent, index) => [agent, theme.agents[index % theme.agents.length] ?? theme.text] as const));

const channels = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16)
];

const hex = (rgb: readonly number[]): string =>
  `#${rgb
    .map(value =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;

/** The colours mixed so far: a theme has a few dozen, mixed again on every frame a dialog is open over them. */
const mixed = new Map<string, string>();

/** `a` moved toward `b` by `amount` (0 is `a`): a colour receding toward the ground under a dialog. */
export const mix = (a: string, b: string, amount: number): string => {
  const key = `${a}|${b}|${String(amount)}`;
  const known = mixed.get(key);
  if (known !== undefined) {
    return known;
  }

  const [x, y] = [channels(a), channels(b)];
  const result = hex(x.map((value, index) => value * (1 - amount) + (y[index] ?? 0) * amount));
  mixed.set(key, result);

  return result;
};

/** The theme a terminal's background asks for: light past the middle of its luminance (OSC 11's answer). */
export const themeOfBackground = (answer: string): ThemeName | undefined => {
  // `rgb:RRRR/GGGG/BBBB`, each channel of one to four hex digits.
  const match = /rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(answer);
  if (!match) {
    return undefined;
  }

  const [r, g, b] = [match[1], match[2], match[3]].map(part => Number.parseInt(part, 16) / (16 ** part.length - 1));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.5 ? 'light' : 'dark';
};

/** How many colours the terminal draws: 0 none (NO_COLOR), 1 the 16, 2 the 256, 3 every one (truecolor). */
export type ColorDepth = 0 | 1 | 2 | 3;

/** A colour as a 256-colour terminal draws it: the nearest of its cube or its greys. */
const to256 = (color: string): number => {
  const [r, g, b] = channels(color);
  const level = (value: number) => (value < 48 ? 0 : value < 115 ? 1 : Math.floor((value - 35) / 40));
  const cube = 16 + 36 * level(r) + 6 * level(g) + level(b);
  const grey = Math.round(((r + g + b) / 3 - 8) / 10);
  const isGrey = Math.max(r, g, b) - Math.min(r, g, b) < 12;

  return isGrey ? Math.min(255, Math.max(232, 232 + grey)) : cube;
};

/** The sixteen colours as most terminals draw them, by their index (30–37, 90–97). */
const BASIC: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255]
];

const to16 = (color: string): number => {
  const [r, g, b] = channels(color);
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  BASIC.forEach(([x, y, z], index) => {
    const each = (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2;
    if (each < distance) {
      best = index;
      distance = each;
    }
  });

  return best;
};

/** The SGR codes of a colour at the terminal's depth — `undefined` with none. */
export const colorCodes = (color: string, depth: ColorDepth, ground: boolean): string | undefined => {
  if (depth === 0) {
    return undefined;
  }

  if (depth === 3) {
    return `${ground ? 48 : 38};2;${channels(color).join(';')}`;
  }

  if (depth === 2) {
    return `${ground ? 48 : 38};5;${String(to256(color))}`;
  }

  const index = to16(color);

  return String((index < 8 ? (ground ? 40 : 30) : ground ? 100 : 90) + (index % 8));
};
