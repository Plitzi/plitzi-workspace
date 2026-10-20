import { Option } from 'commander';

import { expectation, fill, positiveInteger, widths } from '../../options';
import { check } from '../check';
import { importPage } from '../importPage';
import { shotEach, SHOT_MOMENTS } from '../shot';
import { API_OPTION, DRY_RUN_OPTION, schemeOption, URL_OPTION, widthsOption } from './options';

import type { CheckOptions } from '../check';
import type { ImportOptions } from '../importPage';
import type { ShotOptions } from '../shot';
import type { Command } from 'commander';

/** `plitzi page …`: a page of the running project checked, pictured, made and imported. */
export const registerPage = (pageGroup: Command): void => {
  pageGroup
    .command('check')
    .argument('[paths...]', 'The pages: /about /writers, in one browser. The home page when left out')
    .description(
      'Whether a page of the running project is whole, in text: every element on screen, no broken image, no console error, no failed flow'
    )
    .addOption(widthsOption('The widths to check it at, separated by commas', [1440, 390]))
    .addOption(schemeOption())
    .option('--state', 'Also what the page holds: its state, and every source by name')
    .option(
      '--element <id>',
      'Also an element: what it reads, what it shows, its own state, whether it is on screen — once for each element',
      (id: string, before: string[] = []) => (before.includes(id) ? before : [...before, id])
    )
    .option('--ssr', 'Also the HTML the server sent against the hydrated page: what a server provider sent late')
    .option('--click <id>', 'Click one element once the page settles, and say what it changed — or that nothing did')
    .addOption(
      new Option(
        '--expect <id~text>',
        'The element shows this text (any case), as the page was left — or the check fails: once per element; "<path> <id~text>" for one page'
      ).argParser(expectation)
    )
    .option(
      '--then <paths...>',
      'Go on from the page as a visitor does — a click on its own link to each, no reload — and check each the same way'
    )
    .addOption(
      new Option(
        '--fill <id=value>',
        'Fill a field as a visitor types in it — before the --click, or alone, saying what typing in it changed (a search box); once per field, a box takes true or false'
      ).argParser(fill)
    )
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env'
    )
    .option(
      '--presence',
      'Take part in the page’s realtime channels as a visitor does — arrive, announce, send. Otherwise it only watches them'
    )
    .option('--url <origin>', URL_OPTION)
    .option(
      '--space <module>',
      'Hold the pages to this space module instead of the project’s — what --url serves, an agent’s page — authored in a process of its own'
    )
    .option('--json', 'One object per page and width, for a tool or an agent')
    .action((paths: string[], options: CheckOptions) => check(paths, options));

  pageGroup
    .command('import')
    .argument('<url>', 'The page to start from: https://example.com/pricing')
    .description(
      'A page of a site you verified, as a place to start writing from: its tokens, the outline of its blocks per breakpoint, its lists as JSON — never its words'
    )
    .option('-o, --out <dir>', 'Where it is written, inside the project', 'src/imported')
    .addOption(
      widthsOption('The widths it is measured at: the widest is desktop, then tablet and mobile', [1440, 768, 390])
    )
    .option('-f, --force', 'Write over what --out already holds')
    .option(
      '--account',
      'A site not served from this machine: ask your Plitzi account whether one of your spaces verified its domain (signs in)'
    )
    .option('--json', 'One object, for a tool or an agent')
    .option(...API_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((url: string, options: ImportOptions) => importPage(url, options));

  pageGroup
    .command('shot')
    .argument('[path]', 'The page: /about. The home page when left out')
    .description('A picture of one page of the running project — and, asked, how it differs from another or what moves')
    .addOption(
      new Option('--width <px,px>', 'The viewport width — or several, separated by commas: a picture each')
        .argParser(widths)
        .default([1280], '1280')
    )
    .addOption(
      new Option(
        '--height <px>',
        'The viewport height (the picture is the whole page unless --viewport, --scroll-to or --clip)'
      )
        .argParser(positiveInteger)
        .default(800)
    )
    .addOption(schemeOption())
    .option('-o, --out <file>', 'Where the picture goes. tmp/shots/<page>-<width>-<scheme>.png by default')
    .option('--compare <url>', 'Another site: the same page there, side by side, and how much differs by section')
    .addOption(
      new Option(
        '--frames <n>',
        'Pictures taken one after another: which sections move (a marquee, an autoplay)'
      ).argParser(positiveInteger)
    )
    .addOption(new Option('--every <ms>', 'How far apart --frames are taken').argParser(positiveInteger).default(500))
    .addOption(
      new Option(
        '--from <moment>',
        'When --frames start: once the page settles, or as soon as its HTML is in (load) — what plays as it arrives'
      )
        .choices([...SHOT_MOMENTS])
        .default('settled')
    )
    .option('--wait-for <element>', 'An element to wait for first: its name (data-plitzi-el) or a CSS selector')
    .option(
      '--clip <element>',
      'Only this element — its name or a CSS selector — scrolled to wherever it is; with --compare, the section of the report kept'
    )
    .option('--scroll-to <element>', 'The page scrolled until this element is in view; the picture is the screen there')
    .option('--viewport', 'Only what fits the viewport, not the whole page')
    .option(
      '--click <element...>',
      'Click these in order once the page settles — each its name or a CSS selector, inside a plugin too — picturing what each changed (--frames pictures --every ms apart after each)'
    )
    .addOption(
      new Option(
        '--fill <id=value>',
        'Type into a field first, as page check --fill does — before each --click, or alone, then pictured: once per field'
      ).argParser(fill)
    )
    .option('--sheet', 'Every picture taken — before, after each click, each frame — on one contact sheet')
    .option(
      '--steps <script>',
      'An interaction, step by step: "click <el>; type <el> <text>; press <key>; wait <ms>; wait-for <el>; shot [label]; frames <n> [ms]" — or @file with one per line'
    )
    .option('--reduced-motion', 'As a visitor who asked for less motion')
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env'
    )
    .option(
      '--presence',
      'Take part in the page’s realtime channels as a visitor does — arrive, announce, send. Otherwise it only watches them'
    )
    .option('--url <origin>', URL_OPTION)
    .option('--json', 'One object, for a tool or an agent')
    .action((path: string | undefined, options: Omit<ShotOptions, 'width'> & { width: number[] }) =>
      shotEach(path, options)
    );
};
