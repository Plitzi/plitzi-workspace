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
   *   core it serves ~45% more pages in ~25 MB less. From one core up they run beside the main thread, and stay on.
   * - From two cores the server runs a worker per core (`workers`, on in production), and the heap flag is each
   *   worker's — so it stays the one-core size however large the machine.
   */
  nodeOptions: string[];
};

export const PROFILES: Profile[] = [
  {
    name: 'micro-64',
    description: 'An eighth of a core, 64 MB — the extreme floor',
    cpus: 0.125,
    memoryMb: 64,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=1', '--max-old-space-size=24']
  },
  {
    name: 'micro-128',
    description: 'An eighth of a core, 128 MB',
    cpus: 0.125,
    memoryMb: 128,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=2', '--max-old-space-size=48']
  },
  {
    name: 'edge-64',
    description: 'Quarter of a core, 64 MB — the floor being probed',
    cpus: 0.25,
    memoryMb: 64,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=1', '--max-old-space-size=24']
  },
  {
    name: 'edge-96',
    description: 'Quarter of a core, 96 MB',
    cpus: 0.25,
    memoryMb: 96,
    nodeOptions: ['--single-threaded', '--max-semi-space-size=1', '--max-old-space-size=32']
  },
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
    name: 'medium',
    description: 'Two cores, 1 GB',
    cpus: 2,
    memoryMb: 1024,
    nodeOptions: ['--max-old-space-size=384']
  },
  {
    name: 'large',
    description: 'Four cores, 2 GB',
    cpus: 4,
    memoryMb: 2048,
    nodeOptions: ['--max-old-space-size=384']
  },
  {
    name: 'enterprise',
    description: 'Eight cores, 4 GB',
    cpus: 8,
    memoryMb: 4096,
    nodeOptions: ['--max-old-space-size=384']
  },
  {
    name: 'unbounded',
    description: 'No limits: what the host gives it',
    nodeOptions: []
  }
];

/** Every profile with limits, smallest to largest — what `--profile all` and `yarn bench:report` measure. */
export const LIMITED_PROFILES = PROFILES.filter(profile => profile.cpus !== undefined);

export const findProfile = (name: string): Profile => {
  const profile = PROFILES.find(candidate => candidate.name === name);
  if (!profile) {
    throw new Error(`Unknown profile "${name}". Known: ${PROFILES.map(candidate => candidate.name).join(', ')}`);
  }

  return profile;
};
