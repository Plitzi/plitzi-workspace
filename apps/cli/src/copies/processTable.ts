import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';

/**
 * What the machine says of its processes — which listens on which port, the folder each was started in, what each
 * started — read where it is said: `lsof` and `ps` where there are, Linux's `/proc` where there are not (a container
 * keeps neither), and `netstat` on Windows, which says the ports and the processes but never their folders. A run's
 * finish and `server stop` read nothing where `lsof` was missing, and said nothing of it.
 */

export interface Listening {
  pid: number;
  port: number;
}

const run = (command: string, args: readonly string[]): string | undefined => {
  const read = spawnSync(command, [...args], { encoding: 'utf-8' });

  return read.error === undefined && typeof read.stdout === 'string' ? read.stdout : undefined;
};

/** What `lsof -F` says of each process, by its field letter: `p` its pid, `n` a name (an address, a folder). */
export const lsofFields = (output: string): { pid: number; names: string[] }[] => {
  const found: { pid: number; names: string[] }[] = [];
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      found.push({ pid: Number(line.slice(1)), names: [] });
    } else if (line.startsWith('n')) {
      found.at(-1)?.names.push(line.slice(1));
    }
  }

  return found;
};

/** The sockets `/proc/net/tcp` (and `tcp6`) list as listening (`0A`): each one's port and inode. */
export const procListening = (table: string): { port: number; inode: string }[] =>
  table
    .split('\n')
    .slice(1)
    .flatMap(line => {
      const fields = line.trim().split(/\s+/);
      const port = Number.parseInt(fields[1]?.split(':').at(-1) ?? '', 16);
      const inode = fields.at(9);

      return fields.at(3) === '0A' && Number.isInteger(port) && inode !== undefined ? [{ port, inode }] : [];
    });

/** The ports Windows' `netstat -ano` lists as listening, each with its process. */
export const netstatListening = (output: string): Listening[] =>
  output.split('\n').flatMap(line => {
    const fields = line.trim().split(/\s+/);
    const port = Number(fields[1]?.split(':').at(-1));
    const pid = Number(fields[4]);

    return fields[0] === 'TCP' && fields[3] === 'LISTENING' && Number.isInteger(port) && Number.isInteger(pid)
      ? [{ pid, port }]
      : [];
  });

const procPids = (): number[] => {
  try {
    return readdirSync('/proc')
      .filter(name => /^\d+$/.test(name))
      .map(Number);
  } catch {
    return [];
  }
};

const readQuietly = (read: () => string): string | undefined => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

const hasProc = (): boolean =>
  process.platform === 'linux' && readQuietly(() => readFileSync('/proc/net/tcp', 'utf-8')) !== undefined;

/** Every listening port and its process — none where the machine says none. */
export const listeningPorts = (): Listening[] => {
  if (process.platform === 'win32') {
    return netstatListening(run('netstat', ['-ano']) ?? '');
  }

  const lsof = run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']);
  if (lsof !== undefined) {
    return lsofFields(lsof).flatMap(({ pid, names }) => {
      const port = Number(names.at(0)?.split(':').at(-1));

      return Number.isInteger(port) ? [{ pid, port }] : [];
    });
  }

  if (!hasProc()) {
    return [];
  }

  const sockets = ['/proc/net/tcp', '/proc/net/tcp6'].flatMap(file =>
    procListening(readQuietly(() => readFileSync(file, 'utf-8')) ?? '')
  );
  const byInode = new Map(sockets.map(each => [each.inode, each.port] as const));

  return procPids().flatMap(pid =>
    (readQuietly(() => readdirSync(`/proc/${String(pid)}/fd`).join('\n'))?.split('\n') ?? []).flatMap(fd => {
      const port = byInode.get(
        /^socket:\[(\d+)\]$/.exec(readQuietly(() => readlinkSync(`/proc/${String(pid)}/fd/${fd}`)) ?? '')?.[1] ?? ''
      );

      return port === undefined ? [] : [{ pid, port }];
    })
  );
};

/** Why the folders of processes cannot be read here — undefined where they can. */
export const foldersUnsaid = (): string | undefined =>
  process.platform === 'win32'
    ? 'Windows does not say the folder a process was started in'
    : run('lsof', ['-v']) === undefined && !hasProc()
      ? 'this machine has neither lsof nor /proc to say the folder a process was started in'
      : undefined;

/** The folder each process was started in, those the machine says. */
export const foldersOf = (pids: readonly number[]): Map<number, string> => {
  const unique = [...new Set(pids)];
  if (unique.length === 0 || process.platform === 'win32') {
    return new Map();
  }

  const lsof = run('lsof', ['-a', '-d', 'cwd', '-p', unique.join(','), '-Fn']);
  if (lsof !== undefined) {
    return new Map(
      lsofFields(lsof).flatMap(({ pid, names }) => {
        const cwd = names.at(0);

        return cwd === undefined ? [] : [[pid, cwd] as const];
      })
    );
  }

  return new Map(
    unique.flatMap(pid => {
      const cwd = readQuietly(() => readlinkSync(`/proc/${String(pid)}/cwd`));

      return cwd === undefined ? [] : [[pid, cwd] as const];
    })
  );
};

/** Each process's children, by its parent: `ps`, else `/proc/<pid>/stat`. */
export const childrenTable = (): Map<number, number[]> => {
  const children = new Map<number, number[]>();
  const add = (child: number, parent: number): void => {
    if (Number.isInteger(child) && Number.isInteger(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), child]);
    }
  };
  const ps = run('ps', ['-A', '-o', 'pid=,ppid=']);
  if (ps !== undefined) {
    for (const line of ps.split('\n')) {
      const [child, parent] = line.trim().split(/\s+/).map(Number);
      add(child, parent);
    }

    return children;
  }

  for (const pid of procPids()) {
    // `pid (name) state ppid …`: the name may hold spaces and parentheses, so the fields are read after its last `)`.
    const stat = readQuietly(() => readFileSync(`/proc/${String(pid)}/stat`, 'utf-8')) ?? '';
    add(pid, Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]));
  }

  return children;
};
