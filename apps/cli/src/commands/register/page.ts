import { Option } from 'commander';

import { expectation, fill, positiveInteger, statusCode, timeZone, width, widths } from '../../options';
import { check } from '../check';
import { importPage } from '../importPage';
import { measure, sameProperties } from '../measure';
import { keepBrowser } from '../measureKeeper';
import { outline } from '../outline';
import { play } from '../play';
import { pageSame } from '../same';
import { shotEach, SHOT_MOMENTS } from '../shot';
import { API_OPTION, DRY_RUN_OPTION, schemeOption, URL_OPTION, widthsOption } from './options';

import type { CheckOptions } from '../check';
import type { ImportOptions } from '../importPage';
import type { MeasureOptions } from '../measure';
import type { OutlineOptions } from '../outline';
import type { PlayOptions } from '../play';
import type { SameOptions } from '../same';
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
    .option(
      '--stand-ins',
      'Another site’s pictures stood in for, each by a colour of its own: a check of what the project changed, not of a third party’s CDN'
    )
    .option(
      '--themes',
      'Also each page in light and in dark: a ground the same in both under a text whose colour follows the theme — one scheme reads it on the wrong ground'
    )
    .option('--state', 'Also what the page holds: its state, and every source by name')
    .option(
      '--element <id>',
      'Also an element: what it reads, what it shows, its own state, whether it is on screen — once for each element',
      (id: string, before: string[] = []) => (before.includes(id) ? before : [...before, id])
    )
    .option('--ssr', 'Also the HTML the server sent against the hydrated page: what a server provider sent late')
    .option('--click <id>', 'Click one element once the page settles, and say what it changed — or that nothing did')
    .option(
      '--hover <id>',
      'Put the pointer over one element once the page settles, and say what it changed — its look and its elements’, what appeared — or that nothing did'
    )
    .addOption(
      new Option(
        '--expect <id~text>',
        'The element shows this text (any case), as the page was left — or the check fails: once per element; "<path> <id~text>" for one page'
      ).argParser(expectation)
    )
    .addOption(
      new Option(
        '--status <code>',
        'The status the page is meant to be sent with (404 for the page of an address nothing answers): any other fails'
      ).argParser(statusCode)
    )
    .option(
      '--redirects-to <path>',
      'The page is meant to send this visitor there (a guest of a signed-in page, to /sign-in): it fails unless it lands there, and what it lands on is checked'
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
    .addOption(
      new Option(
        '--timezone <zone>',
        'The visitor’s time zone (IANA: America/Mexico_City): the page as someone there sees its hours — the machine’s when left out'
      ).argParser(timeZone)
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
    .command('measure')
    .argument('<path>', 'The page: /pricing')
    .argument(
      '<elements...>',
      'Its elements, each by its id (pricing-card), #its-id or any selector — and, with --compare, the other page’s after "=>": "pricing-card => .plan-card". All measured in one call'
    )
    .description(
      'Elements’ computed styles — type, colours, borders, radii, shadows, size, spacing, motion, their ::before/::after — and, with --compare, beside another page’s: every element and width in one call'
    )
    .option('--compare <url>', 'Another page — the site a copy is made after — whose elements are measured beside them')
    .option('--there <selector>', 'With one element: the other page’s, by any selector (or write it "ours => theirs")')
    .option(
      '--hover <element>',
      'Hover an element on both pages first — "pricing-card => .plan-card" — and measure the rest as it leaves them, its transitions finished; with --click, after them: an item of the menu they opened'
    )
    .option('--focus <element>', 'Focus an element on both pages first, as --hover does — with --click, after them')
    .option(
      '--click <element...>',
      'Click elements on both pages first, in order — "menu-toggle => .menu-button" — and measure the open state they leave'
    )
    .addOption(
      new Option(
        '--same <properties>',
        'Fail unless these are as the other page’s — font-size,border,before:background-image (shorthands: border, font, size): an acceptance’s line, measured'
      ).argParser(sameProperties)
    )
    .addOption(widthsOption('The viewport widths, separated by commas: every element measured at each', [1440]))
    .addOption(schemeOption())
    .addOption(
      new Option('--timezone <zone>', 'The visitor’s time zone (IANA): the machine’s when left out').argParser(timeZone)
    )
    .option(
      '--fresh',
      'Read the other page again, not what an earlier call kept of it (kept 6 h: a reference does not change within a run)'
    )
    .option('--url <origin>', URL_OPTION)
    .option('--json', 'One object, for a tool or an agent')
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env (a task’s copy reads its project’s)'
    )
    .action((route: string, elements: string[], options: MeasureOptions) => measure(route, elements, options));

  // The browser `page measure` keeps the other site's pages open in, between commands: started by it, never by hand.
  pageGroup
    .command('keep-browser', { hidden: true })
    .requiredOption('--root <dir>', 'The project whose cache holds its record')
    .action((options: { root: string }) => keepBrowser(options.root));

  pageGroup
    .command('play')
    .argument('<path>', 'The page: /pricing')
    .description(
      'An interaction played step by step — and after each step how far each element read moved, whether it is shown and takes a press; beside another site with --compare, held to it with --same'
    )
    .requiredOption(
      '--steps <script>',
      'The steps, as page shot --steps writes them — click, hover, scroll, type (or fill: what the field held replaced), drag, press, wait, wait-for — each element "ours => theirs" with --compare'
    )
    .option('--read <element...>', 'The elements read after each step — "row => .slides" with --compare')
    .option('--compare <url>', 'Another page — the site a copy is made after — played beside it, step for step')
    .addOption(
      new Option(
        '--same <what>',
        'Fail unless each step leaves them as the other page’s: moved (its content’s offset), shown (a box, not hidden, not transparent), enabled (takes a press: not disabled, not inert, pointer-events not none — a closed panel hidden by display or visibility still takes one)'
      ).argParser((value: string) => value.split(',').map(each => each.trim()))
    )
    .addOption(widthsOption('The viewport widths, separated by commas: the steps played at each', [1440]))
    .addOption(schemeOption())
    .option('--url <origin>', URL_OPTION)
    .option('--json', 'One object, for a tool or an agent')
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env (a task’s copy reads its project’s)'
    )
    .action((route: string, options: PlayOptions) => play(route, options));

  pageGroup
    .command('outline')
    .argument('<path>', 'The page: /pricing')
    .description(
      'What a page is made of, as a visitor sees it — each element by a selector page measure takes, its box and first words; the other site’s with --compare'
    )
    .option('--compare <url>', 'The other site: its page outlined instead — what to name after "=>" in page measure')
    .option('--within <element>', 'One part alone — its element’s name, a tag or any selector')
    .addOption(new Option('--depth <levels>', 'How many levels under the part are listed').argParser(positiveInteger))
    .option(
      '--click <element...>',
      'Click elements first, in order — "menu-toggle => .menu-button", each page its own side — and outline what they open'
    )
    .addOption(new Option('--width <px>', 'The viewport width').argParser(width).default(1440))
    .addOption(schemeOption())
    .option('--url <origin>', URL_OPTION)
    .option('--json', 'One object, for a tool or an agent')
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env (a task’s copy reads its project’s)'
    )
    .action((route: string, options: OutlineOptions) => outline(route, options));

  pageGroup
    .command('same')
    .argument('[paths...]', 'The pages: /about /writers. The home page when left out')
    .description(
      'Whether pages draw the same on two servers of the project — every element on screen, its box and its style read, not pictured: the run before a task and its copy'
    )
    .requiredOption('--url <origin>', 'The server read: the task’s copy')
    .requiredOption('--than <origin>', 'The server it is held to: the run before it')
    .option(
      '--except <elements>',
      'Elements left out, comma-separated — a task’s own parts: that nothing else moved is what is read',
      (value: string) =>
        value
          .split(',')
          .map(each => each.trim())
          .filter(Boolean)
    )
    .addOption(new Option('--width <px>', 'The viewport width').argParser(width).default(1440, '1440'))
    .addOption(schemeOption())
    .option('--json', 'One object, for a tool or an agent')
    .action((paths: string[], options: SameOptions) => pageSame(paths, options));

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
    .option(
      '--compare <url>',
      'Another site: the same page there, side by side, and how much differs by section — as the open run kept it, when it did (plitzi run reference)'
    )
    .option('--live', 'With --compare: the site as it is now, not as the run kept it')
    .option(
      '--dress [look]',
      'With --compare: fail where a section (or the --clip one) lacks a look the other page dresses it in — a gradient across it, a shadow, an ornament, a filter, a background image; a text, only the looks naming it ("radial-gradient across", shadow, ::before)'
    )
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
    .option(
      '--hover <element>',
      'Hover an element once the page settles — after --click, an item of what they opened — and picture the page so'
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
      'An interaction, step by step: "click <el>; hover <el>; type <el> <text>; press <key>; wait <ms>; wait-for <el>; shot [label]; frames <n> [ms]" — or @file with one per line'
    )
    .option('--reduced-motion', 'As a visitor who asked for less motion')
    .option(
      '--as <username>',
      'Sign in first as this account, through the server’s /auth routes — the password from PLITZI_CHECK_PASSWORD, in .env'
    )
    .addOption(
      new Option(
        '--timezone <zone>',
        'The visitor’s time zone (IANA: America/Mexico_City): the page as someone there sees its hours — the machine’s when left out'
      ).argParser(timeZone)
    )
    .option(
      '--presence',
      'Take part in the page’s realtime channels as a visitor does — arrive, announce, send. Otherwise it only watches them'
    )
    .option('--url <origin>', URL_OPTION)
    .option('--json', 'One object, for a tool or an agent — { widths: [...] }, one each, at several widths')
    .action((path: string | undefined, options: Omit<ShotOptions, 'width'> & { width: number[] }) =>
      shotEach(path, options)
    );
};
