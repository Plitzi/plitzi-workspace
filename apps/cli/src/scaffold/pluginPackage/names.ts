/**
 * Everything a plugin is called, from the one name somebody gives it.
 *
 * A plugin is named four ways and they must agree: npm knows the package, a space knows the `type` (the `renderType`
 * of the `custom` element that hosts it, and the manifest's `root`), the code knows the component, and the builder's
 * catalogue shows a title. Asking for four names is asking for four spellings of one; they are derived instead.
 */

export interface PluginNames {
  /** As npm knows it: `plitzi-plugin-seat-picker`, `@acme/plitzi-plugin-seat-picker`. */
  packageName: string;
  /** The part that names the plugin itself, with the scope and the `plitzi-plugin-` prefix off: `seat-picker`. */
  base: string;
  /** What a space names it by: `seatPicker`. */
  type: string;
  /** The component: `SeatPicker`. */
  component: string;
  /** What the builder's catalogue shows: `Seat Picker`. */
  title: string;
}

const PREFIX = 'plitzi-plugin-';

/** npm's own rule for a package name, scope included. */
const PACKAGE_NAME = /^(@[a-z0-9][a-z0-9-._~]*\/)?[a-z0-9][a-z0-9-._~]*$/;

/** What the name has to leave once the scope and prefix are off: words of letters and digits, starting with a letter. */
const BASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const baseOf = (packageName: string): string => {
  const unscoped = packageName.replace(/^@[^/]+\//, '');

  return unscoped.startsWith(PREFIX) ? unscoped.slice(PREFIX.length) : unscoped;
};

/** What is wrong with a name as a plugin's, in words that say how to fix it — or `undefined` when nothing is. */
export const pluginNameProblem = (packageName: string): string | undefined => {
  if (!PACKAGE_NAME.test(packageName)) {
    return `"${packageName}" is not a package name npm accepts: lowercase letters, digits and dashes, optionally under a @scope/.`;
  }

  if (!BASE.test(baseOf(packageName))) {
    return (
      `"${packageName}" has to name the plugin in words — lowercase letters and digits between single dashes, ` +
      'starting with a letter (seat-picker, chart2) — since the component and the type a space uses are made from it.'
    );
  }

  return undefined;
};

const words = (base: string): string[] => base.split('-');

const capitalised = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** The names, for a name `pluginNameProblem` accepted. */
export const pluginNames = (packageName: string): PluginNames => {
  const base = baseOf(packageName);
  const [first, ...rest] = words(base);

  return {
    packageName,
    base,
    type: `${first}${rest.map(capitalised).join('')}`,
    component: words(base).map(capitalised).join(''),
    title: words(base).map(capitalised).join(' ')
  };
};
