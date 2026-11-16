import { Option } from 'commander';

import { API_OPTION } from './options';
import { positiveInteger } from '../../options';
import { activity } from '../space/activity';
import { PUBLISHED_ENVIRONMENTS, publish, releases, rollback, snapshot } from '../space/releases';

import type { ActivityOptions } from '../space/activity';
import type { PublishOptions, ReleaseOptions, RollbackOptions, SnapshotOptions } from '../space/releases';
import type { Command } from 'commander';

/**
 * `plitzi space snapshot | publish | rollback | releases` (RFC 0034) and `plitzi space activity`: what goes live on the
 * space's domains, and what happened on it.
 */
export const registerSpace = (space: Command): void => {
  space
    .command('snapshot')
    .description(
      'Keep the draft as the next revision of an environment — nothing a visitor sees changes until it is published'
    )
    .addOption(
      new Option('-e, --environment <environment>', 'Where it goes')
        .choices([...PUBLISHED_ENVIRONMENTS])
        .default('production')
    )
    .option('-m, --message <words>', 'What it is for: the words the list of revisions shows')
    .option('--json', 'The snapshot as one object')
    .option(...API_OPTION)
    .action((options: SnapshotOptions) => snapshot(options));

  space
    .command('publish')
    .argument('<domain>', 'One of the space’s domains: example.com')
    .description('Point a domain at a revision — the environment’s latest unless one is named — recorded as a release')
    .addOption(
      new Option('-e, --environment <environment>', 'The revision’s environment')
        .choices(['main', ...PUBLISHED_ENVIRONMENTS])
        .default('production')
    )
    .addOption(
      new Option('-r, --revision <n>', 'The revision; the environment’s latest when left out').argParser(
        positiveInteger
      )
    )
    .option('--json', 'The release as one object')
    .option(...API_OPTION)
    .action((domain: string, options: PublishOptions) => publish(domain, options));

  space
    .command('rollback')
    .argument('<domain>', 'One of the space’s domains: example.com')
    .description('Put back on a domain what it served right before its latest release — or the version named with --to')
    .option('--to <version>', 'A version from its history, as environment@revision: production@9')
    .option('--json', 'The release as one object')
    .option(...API_OPTION)
    .action((domain: string, options: RollbackOptions) => rollback(domain, options));

  space
    .command('releases')
    .argument('[domain]', 'One domain’s history, newest first; every domain with what it serves when left out')
    .description('What each domain serves and what a rollback would put back — or one domain’s releases')
    .option('--json', 'The answer as one object')
    .option(...API_OPTION)
    .action((domain: string | undefined, options: ReleaseOptions) => releases(domain, options));

  space
    .command('activity')
    .description(
      'What happened on the space: the draft changed (a person in the builder, an agent, the autofix), a version went out, an action failed — your own pushes left out'
    )
    .option('-f, --follow', 'Stay, and say each as it happens: what an agent runs in the background to hear of them')
    .option('--after <cursor>', 'From where a previous read left off — the cursor it gave — not from the latest')
    .option('--mine', 'Keep your own pushes too')
    .addOption(new Option('--limit <n>', 'At most this many a page').argParser(positiveInteger))
    .option('--json', 'One page as one object — with --follow, one a line as it arrives — for a tool or an agent')
    .option(...API_OPTION)
    .action((options: ActivityOptions) => activity(options));
};
