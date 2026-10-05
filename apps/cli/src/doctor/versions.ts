/**
 * The versions a project declares and installs, read as far as the doctor needs them: the ranges `package.json`
 * holds — `^0.38.4`, `~1.2.0`, `>=22.18`, `1.2.3` — and nothing else. Anything else (a `workspace:`, a `portal:`, a tag)
 * is a choice of the project's, and is never called wrong.
 */

export type Version = [number, number, number];

/** The version a text starts with — `0.38.4`, `22.18` (as `22.18.0`), `v22.18.1` — or nothing when it holds none. */
export const versionOf = (text: string): Version | undefined => {
  const match = /^v?(\d+(?:\.\d+){0,2})/.exec(text.trim());
  if (!match) {
    return undefined;
  }

  const parts = match[1].split('.').map(Number);
  while (parts.length < 3) {
    parts.push(0);
  }

  return [parts[0], parts[1], parts[2]];
};

export const compareVersions = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const nextBreaking = ([major, minor, patch]: Version): Version => {
  if (major > 0) {
    return [major + 1, 0, 0];
  }

  return minor > 0 ? [0, minor + 1, 0] : [0, 0, patch + 1];
};

/**
 * Whether `version` is one `range` allows — or `undefined` when the range is not one of those read here, which says
 * nothing either way.
 */
export const satisfies = (version: string, range: string): boolean | undefined => {
  const installed = versionOf(version);
  const trimmed = range.trim();
  const floor = versionOf(trimmed.replace(/^(\^|~|>=|=)/, ''));
  if (!installed || !floor || !/^(\^|~|>=|=)?v?\d/.test(trimmed)) {
    return undefined;
  }

  const above = compareVersions(installed, floor) >= 0;
  if (trimmed.startsWith('>=')) {
    return above;
  }

  if (trimmed.startsWith('^')) {
    return above && compareVersions(installed, nextBreaking(floor)) < 0;
  }

  if (trimmed.startsWith('~')) {
    return above && compareVersions(installed, [floor[0], floor[1] + 1, 0]) < 0;
  }

  return compareVersions(installed, floor) === 0;
};

/** The lowest version a range allows — `^0.38.4` → `0.38.4` — or nothing for one that is not a plain range. */
export const floorOf = (range: string): Version | undefined =>
  /^(\^|~|>=|=)?v?\d/.test(range.trim()) ? versionOf(range.trim().replace(/^(\^|~|>=|=)/, '')) : undefined;

export const versionText = (version: Version): string => version.join('.');
