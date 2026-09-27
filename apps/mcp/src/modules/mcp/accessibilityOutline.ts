/**
 * A page's accessibility tree as text an agent can read: the roles and names a screen reader announces, and the ones a
 * browser agent (Claude in Chrome) finds the page's controls by.
 *
 * Two browsers answer it in two shapes. Playwright writes this outline itself (`locator.ariaSnapshot()`); Puppeteer —
 * what the cluster's screenshot service runs — hands back a tree of nodes, which `outlineOfTree` writes in the same
 * form. Whatever reads an outline (`unnamedControls`) reads either.
 */

/** The slice of Puppeteer's `SerializedAXNode` an outline is written from. */
export type AccessibilityNode = {
  role?: string;
  name?: string;
  value?: string | number;
  level?: number;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  invalid?: string;
  children?: AccessibilityNode[];
};

/** Past this an outline is cut, and says so: a page is read to find something in it, not to be held whole. */
export const OUTLINE_LIMIT = 24_000;

/** Nodes that are only structure: their children are written in their place. */
const TRANSPARENT = new Set([
  'generic',
  'none',
  'presentation',
  'RootWebArea',
  'WebArea',
  'LineBreak',
  'InlineTextBox',
  'LabelText'
]);

/** Nodes left out with everything under them: a list's bullets and numbers are the list's look, not its words. */
const DROPPED = new Set(['ListMarker']);

const TEXT_ROLES = new Set(['StaticText', 'text']);

const quote = (text: string): string => JSON.stringify(text.replace(/\s+/g, ' ').trim());

const statesOf = (node: AccessibilityNode): string => {
  const states = [
    node.level !== undefined ? `level=${node.level}` : '',
    node.checked === 'mixed' ? 'checked=mixed' : node.checked ? 'checked' : '',
    node.pressed === 'mixed' ? 'pressed=mixed' : node.pressed ? 'pressed' : '',
    node.expanded === undefined ? '' : `expanded=${String(node.expanded)}`,
    node.selected ? 'selected' : '',
    node.disabled ? 'disabled' : '',
    node.invalid && node.invalid !== 'false' ? 'invalid' : ''
  ].filter(Boolean);

  return states.map(state => ` [${state}]`).join('');
};

const linesOf = (node: AccessibilityNode, depth: number): string[] => {
  const role = node.role ?? '';
  const name = node.name?.trim() ?? '';
  const children = node.children ?? [];
  if (DROPPED.has(role)) {
    return [];
  }

  if (TEXT_ROLES.has(role)) {
    return name ? [`${'  '.repeat(depth)}- text: ${quote(name)}`] : [];
  }

  if (TRANSPARENT.has(role) && !name) {
    return children.flatMap(child => linesOf(child, depth));
  }

  const value = node.value === undefined || node.value === '' ? '' : `: ${quote(String(node.value))}`;
  const own = `${'  '.repeat(depth)}- ${role}${name ? ` ${quote(name)}` : ''}${statesOf(node)}${value}`;
  // A control's own words are its name already; writing them again underneath only doubles the outline.
  const nested = children
    .flatMap(child => linesOf(child, depth + 1))
    .filter(line => line.trim() !== `- text: ${quote(name)}`);

  return [own, ...nested];
};

const limited = (outline: string): string =>
  outline.length > OUTLINE_LIMIT
    ? `${outline.slice(0, OUTLINE_LIMIT)}\n… cut at ${OUTLINE_LIMIT} characters of ${outline.length}: capture one page at a time, or read the part you need.`
    : outline;

/** Puppeteer's tree, written as the outline Playwright writes. */
export const outlineOfTree = (root: AccessibilityNode | null | undefined): string =>
  root ? limited(linesOf(root, 0).join('\n')) : '';

/** Playwright's own outline, held to the same limit. */
export const outlineOfSnapshot = (snapshot: string): string => limited(snapshot.trim());

/** Roles a person acts on — the ones that are useless without a name. */
const CONTROL_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'img',
  'image'
];

const UNNAMED = new RegExp(`^\\s*- (${CONTROL_ROLES.join('|')})(?=\\s*(?:\\[|:|$))`);

export type UnnamedControl = { role: string; line: number };

/**
 * The controls and pictures in an outline that have no name: what a screen reader announces as "button" and nothing
 * else, and what a browser agent cannot tell apart. Each by its role and its line in the outline, so the place it sits
 * in is there to read around it.
 */
export const unnamedControls = (outline: string): UnnamedControl[] =>
  outline.split('\n').flatMap((text, index) => {
    const match = UNNAMED.exec(text);

    return match ? [{ role: match[1] === 'image' ? 'img' : match[1], line: index + 1 }] : [];
  });
