import { execFile } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Runs a command and hands back its stdout, trimmed. Rejects with stderr in the message when it fails. */
export const run = async (command: string, args: string[]): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 });

    return stdout.trim();
  } catch (error) {
    // Some tools report on stdout (tsc among them), so both say why.
    const output = ['stderr', 'stdout']
      .map(stream => (error instanceof Error && stream in error ? String(Reflect.get(error, stream)).trim() : ''))
      .filter(Boolean)
      .join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${output ? `: ${output}` : ''}`, { cause: error });
  }
};

/** Runs a command and hands back everything it printed, stdout then stderr — for logs, where both matter. */
export const runCapturingAll = async (command: string, args: string[]): Promise<string> => {
  const { stdout, stderr } = await execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 });

  return `${stdout}${stderr}`.trim();
};

/** A port nothing is listening on right now, chosen by the kernel. */
export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === 'string') {
          reject(new Error('the kernel handed back no port'));

          return;
        }

        resolve(address.port);
      });
    });
  });
