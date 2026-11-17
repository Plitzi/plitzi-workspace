import { connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';

import type { DeployLog, SiteUploader, UploadResult } from './types';
import type { Socket } from 'node:net';
import type { TLSSocket } from 'node:tls';

/**
 * A site written to a host by FTP (the oldest of them, kept for the hosts that offer nothing else): every
 * file stored over a passive data connection, over TLS when the host offers it (`explicit`, AUTH TLS on port 21) or
 * asks for it (`implicit`, port 990). Files are replaced one by one — not atomic, said before the first deploy and in
 * every log — and a file the site no longer has is left on the host.
 */

export interface FtpTarget {
  host: string;
  port?: number;
  user: string;
  password: string;
  /** `explicit` (AUTH TLS, the default), `implicit` (TLS from the first byte), or `none` — the password in the clear. */
  secure?: 'explicit' | 'implicit' | 'none';
  /** The folder the site goes into, from the account's home. */
  folder?: string;
  /** Accept a certificate no authority vouches for (a host's own): said in the log when used. */
  allowSelfSigned?: boolean;
  /** How long one answer is waited for. */
  timeoutMs?: number;
}

type Reply = { code: number; text: string };

/** One control connection: commands sent, answers read whole (a multi-line answer is one). */
class Control {
  private buffer = '';
  private waiting: ((reply: Reply) => void)[] = [];
  private replies: Reply[] = [];
  private failure: Error | undefined;

  constructor(
    public socket: Socket | TLSSocket,
    private readonly timeoutMs: number
  ) {
    this.listen(socket);
  }

  listen(socket: Socket | TLSSocket): void {
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.read(chunk));
    socket.on('error', (error: Error) => {
      this.failure = error;
    });
  }

  private read(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const match = /^(\d{3}) [^\r\n]*\r?\n/m.exec(this.buffer);
      if (!match) {
        return;
      }

      const end = match.index + match[0].length;
      const reply = { code: Number(match[1]), text: this.buffer.slice(0, end).trim() };
      this.buffer = this.buffer.slice(end);
      const next = this.waiting.shift();
      if (next) {
        next(reply);
      } else {
        this.replies.push(reply);
      }
    }
  }

  next(): Promise<Reply> {
    const ready = this.replies.shift();
    if (ready) {
      return Promise.resolve(ready);
    }

    if (this.failure) {
      return Promise.reject(this.failure);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The FTP host stopped answering')), this.timeoutMs);
      this.waiting.push(reply => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
  }

  async send(command: string, expect: number[], said = command.split(' ')[0]): Promise<Reply> {
    this.socket.write(`${command}\r\n`);
    const reply = await this.next();
    if (!expect.includes(reply.code)) {
      throw new Error(`The FTP host refused ${said}: ${reply.text}`);
    }

    return reply;
  }
}

const opened = (socket: Socket | TLSSocket, event: 'connect' | 'secureConnect', timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('The FTP host did not answer'));
    }, timeoutMs);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

/** The data address a `227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)` answer names. */
export const passiveAddress = (text: string): { host: string; port: number } => {
  const numbers = /(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/.exec(text);
  if (!numbers) {
    throw new Error(`The FTP host answered PASV with no address: ${text}`);
  }

  const [, a, b, c, d, high, low] = numbers;

  return { host: `${a}.${b}.${c}.${d}`, port: Number(high) * 256 + Number(low) };
};

export const ftpUploader = (target: FtpTarget): SiteUploader => {
  const secure = target.secure ?? 'explicit';
  const port = target.port ?? (secure === 'implicit' ? 990 : 21);
  const timeoutMs = target.timeoutMs ?? 30_000;
  const folder = (target.folder ?? '').replace(/^\/+|\/+$/g, '');
  const tlsOptions = { servername: target.host, rejectUnauthorized: !target.allowSelfSigned };

  return {
    name: `FTP ${target.user}@${target.host}${folder ? `/${folder}` : ''}`,
    atomic: false,
    upload: async (files, log: DeployLog, signal): Promise<UploadResult> => {
      log('FTP replaces the files one by one: while they go up, a visitor may get some of each version', 'warn');
      if (secure === 'none') {
        log('This FTP host is reached without TLS: its password and the site travel in the clear', 'warn');
      }

      if (target.allowSelfSigned) {
        log('The host’s certificate is accepted without an authority vouching for it', 'warn');
      }

      const socket =
        secure === 'implicit'
          ? connectTls({ host: target.host, port, ...tlsOptions })
          : connectTcp({ host: target.host, port });
      await opened(socket, secure === 'implicit' ? 'secureConnect' : 'connect', timeoutMs);
      const control = new Control(socket, timeoutMs);
      let session: Buffer | undefined;
      const abort = () => control.socket.destroy(new Error('Canceled'));
      signal?.addEventListener('abort', abort, { once: true });

      try {
        await control.next().then(reply => {
          if (reply.code !== 220) {
            throw new Error(`The FTP host did not greet: ${reply.text}`);
          }
        });
        if (secure === 'explicit') {
          await control.send('AUTH TLS', [234]);
          control.socket.removeAllListeners('data');
          const upgraded = connectTls({ socket: control.socket, ...tlsOptions });
          await opened(upgraded, 'secureConnect', timeoutMs);
          control.listen(upgraded);
        }

        if (secure !== 'none') {
          session = (control.socket as TLSSocket).getSession();
          await control.send('PBSZ 0', [200]);
          await control.send('PROT P', [200]);
        }

        await control.send(`USER ${target.user}`, [230, 331], 'the user');
        await control.send(`PASS ${target.password}`, [230, 202], 'the password');
        await control.send('TYPE I', [200]);

        const made = new Set<string>();
        const makeFolders = async (path: string): Promise<void> => {
          const parts = path.split('/').slice(0, -1);
          for (let depth = 1; depth <= parts.length; depth += 1) {
            const dir = parts.slice(0, depth).join('/');
            if (!made.has(dir)) {
              made.add(dir);
              // 550: it is there already, or cannot be made — the STOR that needs it says which.
              await control.send(`MKD ${dir}`, [257, 550, 521]);
            }
          }
        };

        let bytes = 0;
        for (const file of files) {
          signal?.throwIfAborted();
          const path = folder ? `${folder}/${file.path}` : file.path;
          await makeFolders(path);
          const pasv = await control.send('PASV', [227]);
          const address = passiveAddress(pasv.text);
          // A host behind NAT names its private address: the control connection's is the one that reaches it.
          const host = /^(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(address.host) ? target.host : address.host;
          const raw = connectTcp({ host, port: address.port });
          await opened(raw, 'connect', timeoutMs);
          const data =
            secure === 'none' ? raw : connectTls({ socket: raw, ...tlsOptions, ...(session ? { session } : {}) });
          if (secure !== 'none') {
            await opened(data, 'secureConnect', timeoutMs);
          }

          control.socket.write(`STOR ${path}\r\n`);
          const started = await control.next();
          if (started.code !== 150 && started.code !== 125) {
            data.destroy();
            throw new Error(`The FTP host refused to store ${path}: ${started.text}`);
          }

          await new Promise<void>((resolve, reject) => {
            data.once('error', reject);
            data.end(Buffer.from(file.body), () => resolve());
          });
          const stored = await control.next();
          if (stored.code !== 226 && stored.code !== 250) {
            throw new Error(`The FTP host did not keep ${path}: ${stored.text}`);
          }

          bytes += file.body.byteLength;
        }

        await control.send('QUIT', [221, 200]).catch(() => undefined);
        log(`Stored ${String(files.length)} files (${String(Math.round(bytes / 1024))} KB) on ${target.host}`);

        return { files: files.length, bytes, reference: folder || '/' };
      } finally {
        signal?.removeEventListener('abort', abort);
        control.socket.destroy();
      }
    }
  };
};
