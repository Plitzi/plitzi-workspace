import { InvalidArgumentError, Option } from 'commander';

import { SCHEMES } from '../../browser';
import { AUTOPLAY_CONDITIONS, STORAGE_CONDITIONS } from '../../browser/conditions';
import { schemes, widths } from '../../options';
import { instantMs } from '../shotSteps';

import type { BrowserConditions } from '../../browser/conditions';
import type { Command } from 'commander';

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

/** What the browser-condition flags leave on a command's options. */
export interface ConditionOptions {
  clock?: number;
  block?: string[];
  autoplay?: BrowserConditions['autoplay'];
  storage?: BrowserConditions['storage'];
}

const instant = (value: string): number => {
  const ms = instantMs(value);
  if (ms === undefined) {
    throw new InvalidArgumentError(`"${value}" is no instant: ISO 8601 with its zone, --clock 2026-10-25T20:00:00Z.`);
  }

  return ms;
};

/**
 * The browser a page is read in, where it is not a visitor's ordinary one — its clock held, a request failing, autoplay
 * or storage refused — as the flags every command that plays a page shares.
 */
export const withConditionOptions = (command: Command): Command =>
  command
    .addOption(
      new Option(
        '--clock <instant>',
        'The page’s clock held at this instant (ISO, with its zone) from its first script — moved by the steps clock and tick'
      ).argParser(instant)
    )
    .addOption(
      new Option(
        '--block <text>',
        'Each request whose address holds this fails, as one the network could not make — a player, a script, a font; once per text'
      ).argParser((value: string, previous: string[] | undefined) => [...(previous ?? []), value])
    )
    .addOption(
      new Option(
        '--autoplay <rule>',
        'Media playing with sound refused until a press, as a browser’s autoplay rule does'
      ).choices(AUTOPLAY_CONDITIONS)
    )
    .addOption(
      new Option(
        '--storage <rule>',
        'localStorage and sessionStorage throw when read, as with the site’s data blocked'
      ).choices(STORAGE_CONDITIONS)
    );

/** The browser conditions a command's options ask for. */
export const conditionsOf = (options: ConditionOptions): BrowserConditions => ({
  ...(options.clock === undefined ? {} : { clock: options.clock }),
  ...(options.block?.length ? { block: options.block } : {}),
  ...(options.autoplay ? { autoplay: options.autoplay } : {}),
  ...(options.storage ? { storage: options.storage } : {})
});
