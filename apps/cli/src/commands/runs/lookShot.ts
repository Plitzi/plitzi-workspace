/**
 * A look's `page shot`, one picture of a page at a width and a scheme — each picture of a look made by this one: the
 * pictures set beside the run before, made apart, left out the look's steps, and a stalled player was pictured at rest
 * beside its check reading it stalled.
 */
export const lookShotArgs = ({
  route,
  url,
  reader,
  clip,
  steps,
  compare,
  width,
  scheme,
  out,
  json = true
}: {
  route: string;
  url: string;
  /** Who reads it, as the page commands take it: the visitor's flags, and the account or the guest. */
  reader: readonly string[];
  /** Its part, as `clipArgs` says it — none for the whole page. */
  clip: readonly string[];
  /** What the look plays on the page before it is pictured: what it is about. */
  steps: string | undefined;
  /** The run before it, served: the picture set beside it. */
  compare?: string;
  width: string;
  scheme: string;
  out: string;
  json?: boolean;
}): string[] => [
  'page',
  'shot',
  route,
  '--url',
  url,
  ...reader,
  ...(compare === undefined ? [] : ['--compare', compare]),
  ...clip,
  ...(steps === undefined ? [] : ['--steps', steps]),
  '--width',
  width,
  '--scheme',
  scheme,
  ...(json ? ['--json'] : []),
  '-o',
  out
];
