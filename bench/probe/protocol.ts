/** What the probe prints, one per line: the process's own view of its memory, in bytes. */
export type ProbeSample = {
  t: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  codeSpace: number;
};

export const PROBE_PREFIX = '[bench-probe] ';

const FIELDS = ['t', 'rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers', 'codeSpace'] as const;

const isProbeSample = (value: unknown): value is ProbeSample =>
  typeof value === 'object' && value !== null && FIELDS.every(field => typeof Reflect.get(value, field) === 'number');

/** Every probe sample in a server's output, in order; its other lines are left alone. */
export const parseProbeOutput = (output: string): ProbeSample[] =>
  output.split('\n').flatMap(line => {
    const start = line.indexOf(PROBE_PREFIX);
    if (start === -1) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(line.slice(start + PROBE_PREFIX.length));

      return isProbeSample(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
