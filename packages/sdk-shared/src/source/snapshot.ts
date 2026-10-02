import { isRecord } from '../helpers/isRecord';
/**
 * A source snapshot: the files of a project that one artifact — a plugin, a runtime — was built from, as the platform
 * keeps them beside what was built, so the space can be taken back out as a project (`plitzi create --from`).
 *
 * The files are the ones the build reached from its entries, by their path in the project: a plugin and a runtime that
 * import the same `board/model.ts` each carry it under that one path, and a project put back together from both has it
 * once. Nothing under `node_modules` is in one — the packages are `dependencies`, by name and range.
 *
 * One shape for everybody that touches one: the CLI that packs it, the seeder, and the platform that refuses one it
 * should not keep.
 */

export const SOURCE_SNAPSHOT_FORMAT = 1;

export type SourceSnapshotKind = 'plugin' | 'runtime';

export type SourceSnapshot = {
  format: typeof SOURCE_SNAPSHOT_FORMAT;
  kind: SourceSnapshotKind;
  /** The plugin's type, or `runtime`. */
  name: string;
  /** Where the build started, by path in the project: a plugin of several elements has one per element. */
  entries: string[];
  /** Every file the build reached, by path in the project, its bytes in base64 — fonts and pictures travel too. */
  files: Record<string, string>;
  /** The packages those files import, by name, with the range the project asked for. */
  dependencies: Record<string, string>;
};

/** How much one snapshot may hold: source, not data. */
export const SOURCE_SNAPSHOT_LIMITS = { files: 2000, fileBytes: 4 * 1024 * 1024, totalBytes: 24 * 1024 * 1024 };

const SNAPSHOT_KINDS: readonly SourceSnapshotKind[] = ['plugin', 'runtime'];

/** Files that hold credentials by what they are, whatever is in them. */
const SECRET_FILES = [/(^|\/)\.env(\.|$)/, /\.(pem|key|p12|pfx)$/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/];

/**
 * Credentials by their shape, the kinds no source has a reason to hold: a private key, and the tokens of the services a
 * project most often talks to. Kept to shapes that cannot be mistaken for code, so a constant named `PASSWORD_MIN` is
 * never refused.
 */
const SECRET_SHAPES: readonly { what: string; pattern: RegExp }[] = [
  { what: 'a private key', pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { what: 'an AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { what: 'a Stripe live key', pattern: /\b[sr]k_live_[0-9a-zA-Z]{20,}\b/ },
  { what: 'a GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { what: 'a Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ }
];

/**
 * Why `file` is not a path a snapshot may hold, or nothing: relative to the project, inside it, never in a package or a
 * repository's own folder, and never a file of credentials.
 */
export const sourcePathProblem = (file: string): string | undefined => {
  const segments = file.split('/');
  if (!file || file.startsWith('/') || /^[a-zA-Z]:/.test(file) || file.includes('\\')) {
    return `"${file}" is not a path relative to the project, with forward slashes`;
  }

  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    return `"${file}" climbs out of the project, or has an empty part`;
  }

  if (segments.some(segment => segment === 'node_modules' || segment === '.git')) {
    return `"${file}" is in node_modules or .git: a package is a dependency, not a file of the project`;
  }

  if (SECRET_FILES.some(pattern => pattern.test(file))) {
    return `"${file}" is a file of credentials: they stay where the project runs, never in what Plitzi keeps`;
  }

  return undefined;
};

/** What in `text` looks like a credential, by what it is — or nothing. */
export const secretIn = (text: string): string | undefined =>
  SECRET_SHAPES.find(({ pattern }) => pattern.test(text))?.what;

const isKind = (value: unknown): value is SourceSnapshotKind =>
  typeof value === 'string' && SNAPSHOT_KINDS.some(known => known === value);

const isName = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);

const isEntries = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(entry => typeof entry === 'string');

/** Bytes of base64, without decoding them: four characters are three bytes, less what the padding says. */
const decodedLength = (base64: string): number =>
  Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

export type SourceSnapshotReading = { ok: true; snapshot: SourceSnapshot } | { ok: false; problems: string[] };

/**
 * A snapshot read from what was sent, checked whole: its shape, every path, the limits, and no credentials in any file
 * — `decode` turns a file's base64 into text for that last check, since how is the reader's (Node or the browser).
 * Every problem is said at once, so one round fixes them all.
 */
export const readSourceSnapshot = (value: unknown, decode: (base64: string) => string): SourceSnapshotReading => {
  if (!isRecord(value) || value.format !== SOURCE_SNAPSHOT_FORMAT) {
    return { ok: false, problems: [`Not a source snapshot of format ${String(SOURCE_SNAPSHOT_FORMAT)}`] };
  }

  const { kind, name, entries, files, dependencies } = value;
  const problems: string[] = [];
  if (!isKind(kind)) {
    problems.push(`Its kind is one of ${SNAPSHOT_KINDS.join(', ')}`);
  }

  if (!isName(name)) {
    problems.push('Its name is a plugin type or "runtime": letters, digits, dashes and underscores');
  }

  if (!isStringRecord(files) || !isStringRecord(dependencies)) {
    return { ok: false, problems: [...problems, 'Its files and dependencies are maps of text'] };
  }

  if (!isEntries(entries)) {
    problems.push('It names at least one entry');
  } else {
    entries
      .filter(entry => !Object.hasOwn(files, entry))
      .forEach(entry => problems.push(`Its entry "${entry}" is not among its files`));
  }

  const paths = Object.keys(files);
  if (paths.length > SOURCE_SNAPSHOT_LIMITS.files) {
    problems.push(
      `It holds ${String(paths.length)} files; a snapshot holds at most ${String(SOURCE_SNAPSHOT_LIMITS.files)}`
    );
  }

  let total = 0;
  paths.forEach(file => {
    const pathProblem = sourcePathProblem(file);
    if (pathProblem) {
      problems.push(pathProblem);

      return;
    }

    const bytes = decodedLength(files[file]);
    total += bytes;
    if (bytes > SOURCE_SNAPSHOT_LIMITS.fileBytes) {
      problems.push(`"${file}" is ${(bytes / 1024 / 1024).toFixed(1)} MB; a file of source is at most 4 MB`);

      return;
    }

    const secret = secretIn(decode(files[file]));
    if (secret) {
      problems.push(`"${file}" holds ${secret}: take it out of the code and give it to the project as a variable`);
    }
  });
  if (total > SOURCE_SNAPSHOT_LIMITS.totalBytes) {
    problems.push(`It holds ${(total / 1024 / 1024).toFixed(1)} MB of files; a snapshot holds at most 24 MB`);
  }

  if (problems.length > 0 || !isKind(kind) || !isName(name) || !isEntries(entries)) {
    return { ok: false, problems };
  }

  return { ok: true, snapshot: { format: SOURCE_SNAPSHOT_FORMAT, kind, name, entries, files, dependencies } };
};
