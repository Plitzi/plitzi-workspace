import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cert, certificateNames } from './cert';
import { withSetting } from './projectSettings';

import type { NetworkInterfaceInfo } from 'node:os';

const v4 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  family: 'IPv4',
  internal,
  netmask: '',
  mac: '',
  cidr: null
});

describe('what the certificate names', () => {
  it('names this machine, its network addresses, its mDNS name and what the person adds — each once', () => {
    expect(
      certificateNames({ lo0: [v4('127.0.0.1', true)], en0: [v4('192.168.1.20')] }, 'Studio.local', [
        'studio.tail.ts.net',
        '192.168.1.20'
      ])
    ).toEqual(['localhost', '127.0.0.1', '::1', '192.168.1.20', 'studio.local', 'studio.tail.ts.net']);
  });
});

describe('a setting written to .env', () => {
  it('replaces its line where it is, the commented one .env.example offers too', () => {
    expect(withSetting('# what it is\n# HOST=0.0.0.0\nPORT=1\n', 'HOST', '0.0.0.0')).toBe(
      '# what it is\nHOST=0.0.0.0\nPORT=1\n'
    );
    expect(withSetting('TLS_CERT=old.pem\n', 'TLS_CERT', 'tmp/tls/cert.pem')).toBe('TLS_CERT=tmp/tls/cert.pem\n');
  });

  it('adds it at the end when there is no line for it', () => {
    expect(withSetting('PORT=1', 'TLS_KEY', 'tmp/tls/key.pem')).toBe('PORT=1\nTLS_KEY=tmp/tls/key.pem\n');
    expect(withSetting('', 'TLS_KEY', 'k')).toBe('TLS_KEY=k\n');
  });
});

/**
 * mkcert, as the command calls it: `-CAROOT` says its folder, and a certificate request writes the two files it names,
 * recording the names asked for — so a test reads what the command asked mkcert for.
 */
const FAKE_MKCERT = `#!/bin/sh
if [ "$1" = "-CAROOT" ]; then echo "$FAKE_CAROOT"; exit 0; fi
if [ "$1" = "-install" ]; then exit 0; fi
cert="$2"; key="$4"; shift 4
echo "$@" > "$cert"; echo key > "$key"
`;

describe('plitzi cert', () => {
  let root: string;
  let bin: string;
  let savedPath: string | undefined;
  let said: string[];

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'plitzi-cert-'));
    bin = await mkdtemp(path.join(os.tmpdir(), 'plitzi-cert-bin-'));
    await writeFile(path.join(root, 'package.json'), '{ "name": "shop" }\n');
    await writeFile(path.join(root, '.env'), 'PLITZI_SIGNING_SECRET=s\n\n# HOST=0.0.0.0\n');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    savedPath = process.env.PATH;
    said = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => said.push(line));
    vi.spyOn(console, 'error').mockImplementation((line: string) => said.push(line));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env.PATH = savedPath;
    Reflect.deleteProperty(process.env, 'FAKE_CAROOT');
    process.exitCode = undefined;
    await rm(root, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  });

  it('says how to install mkcert when there is none, and writes nothing', async () => {
    process.env.PATH = bin;

    await cert({});

    expect(process.exitCode).toBe(1);
    expect(said.join('\n')).toContain('mkcert is not installed');
    expect(await readFile(path.join(root, '.env'), 'utf-8')).not.toContain('TLS_CERT');
  });

  it('makes the certificate in tmp/tls and names it in .env', async () => {
    await writeFile(path.join(bin, 'mkcert'), FAKE_MKCERT);
    await chmod(path.join(bin, 'mkcert'), 0o755);
    process.env.PATH = `${bin}${path.delimiter}${savedPath ?? ''}`;
    process.env.FAKE_CAROOT = '/authority';

    await cert({ json: true, name: ['studio.tail.ts.net'] });

    expect(process.exitCode).toBeUndefined();
    expect(await readFile(path.join(root, 'tmp/tls/cert.pem'), 'utf-8')).toContain('localhost 127.0.0.1 ::1 ');
    expect(await readFile(path.join(root, 'tmp/tls/cert.pem'), 'utf-8')).toContain('studio.tail.ts.net');
    expect(await readFile(path.join(root, '.env'), 'utf-8')).toBe(
      'PLITZI_SIGNING_SECRET=s\n\n# HOST=0.0.0.0\nTLS_CERT=tmp/tls/cert.pem\nTLS_KEY=tmp/tls/key.pem\n'
    );
    const answer: unknown = JSON.parse(said.join('\n'));
    expect(answer).toMatchObject({ cert: 'tmp/tls/cert.pem', key: 'tmp/tls/key.pem', open: false });
    expect(answer).toHaveProperty('urls', expect.arrayContaining(['https://studio.tail.ts.net:8080/']));
  });
});
