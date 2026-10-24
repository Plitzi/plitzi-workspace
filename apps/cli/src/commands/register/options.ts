import { Option } from 'commander';

import { SCHEMES } from '../../browser';
import { schemes, widths } from '../../options';

/** The flags several groups of commands share, said once. */

/** The widths a page is looked at, as one flag every command that opens a page shares. */
export const widthsOption = (description: string, fallback: number[]): Option =>
  new Option('--width <px,px>', description).argParser(widths).default(fallback, fallback.join(','));

export const schemeOption = (): Option =>
  new Option(
    '--scheme <scheme>',
    'The space’s theme, as a visitor’s toggle sets it. The space’s own default when left out'
  ).choices(SCHEMES);

/** The schemes a page is pictured in: one, or each of several. */
export const schemesOption = (): Option =>
  new Option(
    '--scheme <scheme,scheme>',
    'The space’s theme, as a visitor’s toggle sets it — or both, light,dark: a picture each. The space’s own default when left out'
  ).argParser(schemes);

/** What every command that writes or sends takes: say what it would do, and do none of it. */
export const DRY_RUN_OPTION = [
  '--dry-run',
  'Say what it would do — files, installs, what it sends — and do none of it'
] as const;

/** Where `check` and `shot` find the project's pages when `npm start` here is not where they are. */
export const URL_OPTION =
  'Where the project is served, when not by npm start here — a second server of it, staging, a deploy: https://host:port';

export const API_OPTION = [
  '--api <url>',
  'The platform’s API. Defaults to PLITZI_API_URL, else the one signed in to, else https://api.plitzi.com.'
] as const;
