export type Profile = {
  name: string;
  description: string;
  /** CPU quota in cores. Absent: no limit. */
  cpus?: number;
  /** Memory limit in MiB, swap included — the container is killed rather than swapping. Absent: no limit. */
  memoryMb?: number;
  /**
   * The Node flags this hardware should run with, measured with this bench.
   *
   * - The heap is sized to the limit minus what lives outside it (~45 MB for a page server: buffers, malloc, thread
   *   stacks). V8 sizes its heap from the machine, not the cgroup, and under load grows it to its limit even when
   *   the live set is a third of that — past what the container may use.
   * - Below one core, `--single-threaded`: V8's background GC and compiler threads bring no parallelism under a
   *   fraction of a core, only contention for the same quota, and each keeps a malloc arena of its own. At a quarter
   *   core it serves ~45% more pages in ~25 MB less.
   */
  nodeOptions: string[];
};

export const PROFILES: Profile[] = [
  {
    name: 'edge-128',
    description: 'Quarter of a core, 128 MB',
    cpus: 0.25,
    memoryMb: 128,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=2', '--max-old-space-size=48']
  },
  {
    name: 'edge-256',
    description: 'Quarter of a core, 256 MB',
    cpus: 0.25,
    memoryMb: 256,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=4', '--max-old-space-size=160']
  },
  {
    name: 'small',
    description: 'Half a core, 256 MB',
    cpus: 0.5,
    memoryMb: 256,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=4', '--max-old-space-size=160']
  },
  {
    name: 'standard',
    description: 'One core, 512 MB',
    cpus: 1,
    memoryMb: 512,
    nodeOptions: ['--max-old-space-size=384']
  },
  {
    name: 'unbounded',
    description: 'No limits: what the host gives it',
    nodeOptions: []
  }
];

export const findProfile = (name: string): Profile => {
  const profile = PROFILES.find(candidate => candidate.name === name);
  if (!profile) {
    throw new Error(`Unknown profile "${name}". Known: ${PROFILES.map(candidate => candidate.name).join(', ')}`);
  }

  return profile;
};
