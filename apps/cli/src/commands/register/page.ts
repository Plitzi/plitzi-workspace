import { Option } from 'commander';

import { API_OPTION, DRY_RUN_OPTION, schemeOption, schemesOption, widthsOption, withVisitorOptions } from './options';
import { expectation, fill, pagePath, pagePathList, positiveInteger, scale, statusCode, widths } from '../../options';
import { check } from '../page/check';
import { importPage } from '../page/importPage';
import { expectedOf, measure, onlyProperties, sameProperties } from '../page/measure';
import { keepBrowser } from '../page/measureKeeper';
import { outline } from '../page/outline';
import { play } from '../page/play';
import { shotEach, SHOT_MOMENTS } from '../page/shot';

import type { CheckOptions } from '../page/check';
import type { ImportOptions } from '../page/importPage';
import type { MeasureOptions } from '../page/measure';
import type { OutlineOptions } from '../page/outline';
import type { PlayOptions } from '../page/play';
import type { ShotEachOptions } from '../page/shot';
import type { Command } from 'commander';

/** `plitzi page …`: a page of the running project checked, pictured, made and imported. */
export const registerPage = (pageGroup: Command): void => {
  withVisitorOptions(
    pageGroup
      .command('check')
      .argument('[paths...]', 'The pages: /about /writers, in one browser. The home page when left out', pagePathList)
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
      .option(
        '--state [names]',
        'Also what the page holds: its state, and every source by name — or only those named (--state siteUnread,draft)'
      )
      .option(
        '--element <id>',
        'Also an element: what it reads, what it shows, its own state, whether it is on screen — once for each element',
        (id: string, before: string[] = []) => (before.includes(id) ? before : [...before, id])
      )
      .option(
        '--sight <ids>',
        'Also where a visitor sees each of these elements, separated by commas — in sight, out of sight until a box is scrolled, clipped by a box that does not scroll, under another element: a box drawn is not one seen',
        (value: string) =>
          value
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
      )
      .option('--ssr', 'Also the HTML the server sent against the hydrated page: what a server provider sent late')
      .option(
        '--steps <script>',
        'Played once the page settles, before it is checked, as page play writes them — "click open-panel; type chat-input hi; press Enter": what only a visitor’s steps make, checked where it is drawn'
      )
      .option('--click <id>', 'Click one element once the page settles, and say what it changed — or that nothing did')
      .option(
        '--hover <id>',
        'Put the pointer over one element once the page settles, and say what it changed — its look and its elements’, what appeared — or that nothing did'
      )
      .addOption(
        new Option(
          '--expect <id~text>',
          'The element shows this text (any case) — any copy of it, a list\'s rows — as the page was left, or the check fails: once per element; "!<id>" none shown; "<path> <id~text>" for one page — with --then, one naming none holds on the last; "<id>[href]~next=" what an attribute holds'
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
        '--space <module>',
        'Hold the pages to this space module instead of the project’s — what --url serves, an agent’s page — authored in a process of its own'
      )
      .option('--json', 'One object per page and width, for a tool or an agent')
  ).action((paths: string[], options: CheckOptions) => check(paths, options));

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

  const measureCommand = pageGroup
    .command('measure')
    .argument('<path>', 'The page: /pricing', pagePath)
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
      '--press <element>',
      'Hold an element down on both pages first — the mouse pressed and kept — and measure it as :active draws it: a key that pops up when pressed'
    )
    .option(
      '--click <element...>',
      'Click elements on both pages first, in order — "menu-toggle => .menu-button" — and measure the open state they leave'
    )
    .addOption(
      new Option(
        '--same <properties>',
        'Fail unless these are as the other page’s — font-size,border,before:background-image, or any CSS property by name (shorthands: border, font, size): an acceptance’s line, measured'
      ).argParser(sameProperties)
    )
    .option(
      '--expect <property=value>',
      'Fail unless each element measured computes this property to this value, at every width — "transform=matrix(1, 0, 0, 1, 0, 3)"; one a flag: an acceptance line holding one page’s value',
      expectedOf
    )
    .addOption(
      new Option(
        '--only <properties>',
        'Only these of each element, printed — box (x, y, width, height, padding, margin), font, border, size, or any CSS property by name (overflow-x, after:margin-left): a fit asks for its box'
      ).argParser(onlyProperties)
    )
    .option(
      '--each',
      'Every copy the page draws of each element asked — a component’s instances, a list’s rows — measured apart: the first alone hides how they differ'
    )
    .option(
      '--motion',
      'Read as a visitor who asked for no less motion: what an animation is — held still by default, a page’s reduced-motion rules read none'
    )
    .option(
      '--all',
      'Every property of each, its initial values and what it inherits too — left out otherwise, and counted'
    )
    .option(
      '--steps <script>',
      'Played on the page before it is measured, as page play takes them — "type chat-input hi; press Enter": what only a visitor’s steps make, measured where it is drawn'
    )
    .addOption(widthsOption('The viewport widths, separated by commas: every element measured at each', [1440]))
    .addOption(schemesOption())
    .option('--json', 'One object, for a tool or an agent');
  withVisitorOptions(measureCommand).action((route: string, elements: string[], options: MeasureOptions) =>
    measure(route, elements, options)
  );

  // The browser `page measure` keeps the other site's pages open in, between commands: started by it, never by hand.
  pageGroup
    .command('keep-browser', { hidden: true })
    .requiredOption('--root <dir>', 'The project whose cache holds its record')
    .action((options: { root: string }) => keepBrowser(options.root));

  const playCommand = pageGroup
    .command('play')
    .argument('<path>', 'The page: /pricing', pagePath)
    .description(
      'An interaction played step by step — and after each step how far each element read moved, whether it is shown and takes a press; beside another site with --compare, held to it with --same'
    )
    .option(
      '--steps <script>',
      'The steps — left out with --read, the page as it rests — as page shot --steps writes them — click, hover, scroll <el> [dx] [dy] (into view — or its own content by so many pixels: scroll genres 200), type (or fill: what the field held replaced), drag, press, wait, wait-for <el> [time] (until it shows — 10 s, or the time said up to 60 s; a selector waits for a state: [data-state="stalled"]), reload, goto <path>, store, state, clock, tick, action <id> [json] (one of the space’s actions run as the page’s visitor), as <account> <step> (played by another account on a page of its own), shot [label] (the page pictured where it stands, in tmp/shots — in a task’s copy, the run’s pictures of it) — a ";" inside quotes is the text’s — each element "ours => theirs" with --compare'
    )
    .option(
      '--read <element...>',
      'The elements read after each step, by spaces or commas — "row => .slides" with --compare; a list\'s row by :2 or :last (card-name:last); state.<key> reads a key of the page\'s state (state.cart.items), here'
    )
    .option('--compare <url>', 'Another page — the site a copy is made after — played beside it, step for step')
    .addOption(
      new Option(
        '--same <what>',
        'Fail unless each step leaves them as the other page’s: moved (its content’s offset), shown (a box, not hidden, not transparent), enabled (takes a press: not disabled, not inert, pointer-events not none — a closed panel hidden by display or visibility still takes one)'
      ).argParser((value: string) => value.split(',').map(each => each.trim()))
    )
    .addOption(widthsOption('The viewport widths, separated by commas: the steps played at each', [1440]))
    .addOption(schemeOption())
    .option('--json', 'One object, for a tool or an agent');
  withVisitorOptions(playCommand).action((route: string, options: PlayOptions) => play(route, options));

  withVisitorOptions(
    pageGroup
      .command('outline')
      .argument('<path>', 'The page: /pricing', pagePath)
      .description(
        'What a page is made of, as a visitor sees it — each element by a selector page measure takes, its box and first words; the other site’s with --compare'
      )
      .option('--compare <url>', 'The other site: its page outlined instead — what to name after "=>" in page measure')
      .option('--within <element>', 'One part alone — its element’s name, a tag or any selector')
      .option(
        '--find <word>',
        'The elements whose name, selector or words hold it — the whole page searched, its matches alone listed: an element found by a word you know'
      )
      .addOption(new Option('--depth <levels>', 'How many levels under the part are listed').argParser(positiveInteger))
      .option(
        '--click <element...>',
        'Click elements first, in order — "menu-toggle => .menu-button", each page its own side — and outline what they open'
      )
      .option(
        '--steps <script>',
        'Played on the project’s page before it is outlined, as page play writes them — "type search pasta; press Enter": what only a visitor’s steps open'
      )
      .addOption(widthsOption('The viewport width — or several, separated by commas: an outline each', [1440]))
      .addOption(schemeOption())
      .option('--json', 'One object, for a tool or an agent — a list of them for several widths')
  ).action((route: string, options: OutlineOptions) => outline(route, options));

  withVisitorOptions(
    pageGroup
      .command('shot')
      .argument('[paths...]', 'The pages: /about /pricing. The home page when left out', pagePathList)
      .description(
        'A picture of a page of the running project — or several — and, asked, how it differs from another or what moves'
      )
      .addOption(
        new Option('--width <px,px>', 'The viewport width — or several, separated by commas: a picture each')
          .argParser(widths)
          .default([1280], '1280')
      )
      .addOption(schemesOption())
      .addOption(
        new Option(
          '--scale <n>',
          'The picture n times as large, laid out as at its width — a small drawing read up close, cell by cell (1 to 4)'
        ).argParser(scale)
      )
      .option('-o, --out <file>', 'Where the picture goes. tmp/shots/<page>[-<clip>]-<width>-<scheme>.png by default')
      .option(
        '--compare <url>',
        'Another site: the same page there, side by side, and how much differs by section — as the open run kept it, when it did (plitzi run reference)'
      )
      .option(
        '--dress [look]',
        'With --compare: fail where a section (or the --within one) lacks a look the other page dresses it in — a gradient across it, a shadow, an ornament, a filter, a background image; a text, only the looks naming it ("radial-gradient across", shadow, ::before)'
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
        '--within <element>',
        'Only this element — its name or a CSS selector — scrolled to wherever it is; with --compare, the section of the report kept'
      )
      .option(
        '--showing <elements>',
        'With --within drawn more than once (a component in several states): the copy of it that shows the most of these elements, comma-separated',
        (value: string) =>
          value
            .split(',')
            .map(each => each.trim())
            .filter(Boolean)
      )
      .option(
        '--scroll-to <element>',
        'The page scrolled until this element is in view; the picture is the screen there'
      )
      .option('--viewport', 'Only what fits the viewport (--height tall), not the whole page')
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
        'An interaction, step by step: "click <el>; hover <el>; scroll <el> [dx] [dy]; type <el> <text>; press <key>; wait <ms|3s>; wait-for <el>; action <id> [json]; as <account> <step>; shot [label]; frames <n> [ms]" — or @file with one per line'
      )
      .option('--reduced-motion', 'As a visitor who asked for less motion')
      .option('--json', 'One object, for a tool or an agent — { widths: [...] }, one each, for several pages or widths')
  ).action((paths: string[], options: ShotEachOptions) => shotEach(paths, options));
};
