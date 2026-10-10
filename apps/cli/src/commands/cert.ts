import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { hostname, networkInterfaces } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { localNetworkName, networkAddresses } from '@plitzi/sdk-shared/project/network';

import { projectHere } from './existingProject';
import { projectSettings, withSetting } from './projectSettings';
import { atTerminal, fail } from './terminal';
import { TLS_CERT_FILE, TLS_KEY_FILE } from '../scaffold/paths';

import type { NetworkInterfaceInfo } from 'node:os';

/**
 * `plitzi cert`: HTTPS for the project while it is developed, for a phone or a tablet on the same Wi-Fi.
 *
 * Opened over plain http from another device, a page is not a secure context: its browser gives it no microphone,
 * camera, clipboard, geolocation or service worker, and keeps no `Secure` cookie. So the page is served over HTTPS with
 * a certificate for this machine as that network reaches it, signed by mkcert's local authority — trusted here by
 * `mkcert -install`, and on the phone by installing that authority once. The certificate goes in `tmp/tls/`, and
 * `.env` names it (`TLS_CERT`, `TLS_KEY`): the server, or Vite, serves HTTPS from it with no code of the project's.
 *
 * mkcert, rather than a certificate made here: trusting an authority is a change to the system's store, different on
 * each one (the keychain, NSS for Firefox, the Linux and Windows stores), and mkcert is what does it well everywhere.
 *
 *   plitzi cert
 *   plitzi cert --name studio.tailnet.ts.net    # a name of the machine's own too
 */

export interface CertOptions {
  name?: string[];
  json?: boolean;
}

const run = promisify(execFile);

const LOOPBACK = ['localhost', '127.0.0.1', '::1'];

/**
 * What the certificate names: this machine (loopback), its network addresses — what a phone opens today — its mDNS
 * name, which outlives the addresses, and any the person adds.
 */
export const certificateNames = (
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
  machine: string,
  extra: readonly string[] = []
): string[] => [...new Set([...LOOPBACK, ...networkAddresses(interfaces), localNetworkName(machine), ...extra])];

const INSTALL_MKCERT: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'brew install mkcert',
  linux: 'apt install mkcert (or your distribution’s package; see https://github.com/FiloSottile/mkcert)',
  win32: 'choco install mkcert, or scoop install mkcert'
};

/** mkcert's authority folder, or `undefined` when mkcert is not installed. */
const authorityFolder = async (): Promise<string | undefined> => {
  try {
    const { stdout } = await run('mkcert', ['-CAROOT']);

    return stdout.trim();
  } catch {
    return undefined;
  }
};

/** `mkcert -install`, at the terminal: it may ask for the password that lets it trust its authority on this machine. */
const trustHere = (): Promise<boolean> =>
  new Promise(resolve => {
    spawn('mkcert', ['-install'], { stdio: 'inherit' })
      .on('error', () => resolve(false))
      .on('exit', code => resolve(code === 0));
  });

export const cert = async (options: CertOptions): Promise<void> => {
  const project = await projectHere('to serve over HTTPS');
  if (!project) {
    return;
  }

  const { root } = project;
  const authority = await authorityFolder();
  if (authority === undefined) {
    fail(
      `mkcert is not installed: it makes the certificate, and the authority your devices trust. Install it — ${
        INSTALL_MKCERT[process.platform] ?? 'see https://github.com/FiloSottile/mkcert'
      } — and run plitzi cert again.`
    );

    return;
  }

  // Nobody at the terminal (an agent, CI) cannot type the password trusting it asks for: the certificate is made all
  // the same, and the step is said for the person to take.
  const trusted = atTerminal() && !options.json ? await trustHere() : false;
  const names = certificateNames(networkInterfaces(), hostname(), options.name);
  await fs.mkdir(path.join(root, path.dirname(TLS_CERT_FILE)), { recursive: true });
  try {
    await run('mkcert', ['-cert-file', TLS_CERT_FILE, '-key-file', TLS_KEY_FILE, ...names], { cwd: root });
  } catch (error) {
    fail(`mkcert could not make the certificate: ${error instanceof Error ? error.message : String(error)}`);

    return;
  }

  const envFile = path.join(root, '.env');
  const env = await fs.readFile(envFile, 'utf-8').catch(() => '');
  await fs.writeFile(envFile, withSetting(withSetting(env, 'TLS_CERT', TLS_CERT_FILE), 'TLS_KEY', TLS_KEY_FILE));

  const rootCa = path.join(authority, 'rootCA.pem');
  const settings = await projectSettings(root);
  const open = settings.value('HOST') !== '' && !LOOPBACK.includes(settings.value('HOST'));
  const port =
    settings.value('PORT') ||
    (project.plitzi?.kind === 'project' && project.plitzi.mode === 'client' ? '5173' : '8080');
  const urls = names.filter(name => !LOOPBACK.includes(name)).map(name => `https://${name}:${port}/`);
  if (options.json) {
    console.log(
      JSON.stringify(
        { cert: TLS_CERT_FILE, key: TLS_KEY_FILE, names, authority: existsSync(rootCa) ? rootCa : null, open, urls },
        null,
        2
      )
    );

    return;
  }

  console.log(`${chalk.green('✓')} ${TLS_CERT_FILE} for ${names.join(', ')} — .env serves it (TLS_CERT, TLS_KEY).`);
  if (!trusted) {
    console.log(
      `  This machine’s browsers trust it once mkcert’s authority is installed here: run ${chalk.bold('mkcert -install')} at a terminal (it may ask for your password).`
    );
  }

  console.log('');
  if (!open) {
    console.log(
      `Open it to your network: ${chalk.bold('HOST=0.0.0.0')} in .env — anyone on that network can then reach it.`
    );
  }

  console.log(`Start it, and on the phone open ${urls.map(url => chalk.bold(url)).join(' or ')}`);
  console.log('');
  console.log(
    `The phone has to trust the authority that signed it: ${chalk.bold(rootCa)} — that file only, never rootCA-key.pem beside it, which signs for anything.`
  );
  console.log(
    '  iPhone, iPad: AirDrop or mail it, install the profile (Settings › General › VPN & Device Management), then turn on full trust in Settings › General › About › Certificate Trust Settings.'
  );
  console.log('  Android: Settings › Security › Encryption & credentials › Install a certificate › CA certificate.');
  console.log(
    `A certificate names the addresses it was made for: when the router gives this machine another, run plitzi cert again — or open ${localNetworkName(hostname())}, which stays.`
  );
};
