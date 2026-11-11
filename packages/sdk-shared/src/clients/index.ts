/**
 * A client of the platform and its version — the CLI and the builder say theirs on every request, and the platform
 * judges it against the oldest it takes. Older than that is refused with the step that upgrades it; older than the
 * platform but not too old is answered, and told what is current, which the client says once. Released together, every
 * `@plitzi/*` package has the platform's version, so a client's version is compared with the platform's own.
 */

/** What a client sends: `<surface>/<version>` — `cli/0.39.3`. */
export const CLIENT_HEADER = 'x-plitzi-client';

/** What the platform answers a client older than itself with: its own version. */
export const CURRENT_HEADER = 'x-plitzi-current';

export const CLIENT_SURFACES = ['cli', 'builder'] as const;

export type ClientSurface = (typeof CLIENT_SURFACES)[number];

/** The step that brings each surface up to the platform. */
export const CLIENT_UPGRADE: Record<ClientSurface, string> = {
  cli: 'in a project, plitzi upgrade packages (the CLI is one of them); elsewhere, npx @plitzi/cli@latest',
  builder: 'reload the builder: it loads the platform’s own'
};

type Version = readonly [number, number, number];

const versionOf = (text: string): Version | undefined => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text.trim());

  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
};

const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const isSurface = (name: string): name is ClientSurface => CLIENT_SURFACES.some(surface => surface === name);

export const clientHeaderValue = (surface: ClientSurface, version: string): string => `${surface}/${version}`;

/** The client a request names, or nothing when it names none this platform knows — a browser, a script, a page. */
export const clientOf = (header: string | undefined): { surface: ClientSurface; version: string } | undefined => {
  const [surface = '', version = ''] = (header ?? '').split('/');

  return isSurface(surface) && versionOf(version) ? { surface, version } : undefined;
};

/**
 * The oldest client a platform of `current` takes when its deployment names none: the minor before its own, from its
 * first patch. A client one minor behind still works; two behind is refused.
 */
export const oldestByDefault = (current: string): string => {
  const parsed = versionOf(current);
  if (!parsed) {
    return current;
  }

  const [major, minor] = parsed;

  return minor > 0 ? `${String(major)}.${String(minor - 1)}.0` : `${String(major)}.0.0`;
};

export type ClientVerdict =
  /** No client of the platform's, or one as new as it: answered as any request is. */
  | { kind: 'current' }
  /** Older than the platform, not older than it takes: answered, and told what is current. */
  | { kind: 'behind'; surface: ClientSurface; version: string; current: string }
  /** Older than the oldest the platform takes: refused, with the step that upgrades it. */
  | { kind: 'refused'; surface: ClientSurface; version: string; oldest: string; current: string };

/**
 * A client judged against the platform: `current` is the platform's version, `oldest` the oldest of each surface it
 * takes. A patch behind is current — patches change no contract.
 */
export const judgeClient = (
  header: string | undefined,
  platform: { current: string; oldest: Record<ClientSurface, string> }
): ClientVerdict => {
  const client = clientOf(header);
  const version = client && versionOf(client.version);
  const current = versionOf(platform.current);
  if (!client || !version || !current) {
    return { kind: 'current' };
  }

  const oldest = versionOf(platform.oldest[client.surface]);
  if (oldest && compare(version, oldest) < 0) {
    return { kind: 'refused', ...client, oldest: platform.oldest[client.surface], current: platform.current };
  }

  return version[0] < current[0] || (version[0] === current[0] && version[1] < current[1])
    ? { kind: 'behind', ...client, current: platform.current }
    : { kind: 'current' };
};

/** What a refused client is told: what it is, what the platform takes, and the step. */
export const outdatedText = (verdict: Extract<ClientVerdict, { kind: 'refused' }>): string =>
  `This ${verdict.surface === 'cli' ? 'CLI' : 'builder'} is ${verdict.version}, and the platform (${verdict.current}) takes ${verdict.oldest} and later: ${CLIENT_UPGRADE[verdict.surface]}.`;

/** What a client behind is told, once. */
export const behindText = (surface: ClientSurface, version: string, current: string): string =>
  `Plitzi ${current} is out, and this ${surface === 'cli' ? 'CLI' : 'builder'} is ${version}: ${CLIENT_UPGRADE[surface]}.`;
