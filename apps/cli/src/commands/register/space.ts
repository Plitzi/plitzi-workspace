import { Option } from 'commander';

import { API_OPTION } from './options';
import { positiveInteger } from '../../options';
import { activity } from '../space/activity';
import { deploy, deploys, download, targets } from '../space/deploys';
import { PUBLISHED_ENVIRONMENTS, publish, releases, rollback, snapshot } from '../space/releases';

import type { ActivityOptions } from '../space/activity';
import type { DeployOptions, DownloadOptions } from '../space/deploys';
import type { PublishOptions, ReleaseOptions, RollbackOptions, SnapshotOptions } from '../space/releases';
import type { Command } from 'commander';

/**
 * `plitzi space snapshot | publish | rollback | releases` and `plitzi space activity`: what goes live on the
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
    .description(
      'Point a domain at a revision, recorded as a release: named (-r), it stays on it; left out, it follows the environment’s latest'
    )
    .addOption(
      new Option('-e, --environment <environment>', 'The revision’s environment')
        .choices(['main', ...PUBLISHED_ENVIRONMENTS])
        .default('production')
    )
    .addOption(
      new Option(
        '-r, --revision <n>',
        'The revision it stays on; left out, it follows the environment’s latest'
      ).argParser(positiveInteger)
    )
    .option('--deploy', 'On a domain whose site a provider holds, deploy it when the revision needs one')
    .option(
      '--at <moment>',
      'Publish later instead, at an ISO 8601 moment (2026-12-01T09:00Z): a plan with deploy automation'
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
    .command('targets')
    .description(
      'Every domain: where its site is (Plitzi, or a copy on GitHub Pages, AWS, Cloudflare…), what it serves, what it asks'
    )
    .option('--json', 'The targets, the providers and the plan’s limits as one object')
    .option(...API_OPTION)
    .action((options: DeployOptions) => targets(options));

  space
    .command('deploy')
    .argument('<domain>', 'A domain whose site a provider holds')
    .description('Build and ship again what the domain serves — --redeploy to bring it to the newest versions')
    .option('--redeploy', 'Say it is to update the versions the site runs')
    .option('-f, --follow', 'Stay, say its log as it runs, and end with how it ended (exit 1 when it failed)')
    .option('--json', 'The deploy as one object')
    .option(...API_OPTION)
    .action((domain: string, options: DeployOptions) => deploy(domain, options));

  space
    .command('deploys')
    .argument('[domain]', 'One domain’s deploys; every domain’s when left out')
    .description('The latest deploys, newest first: what each shipped and how it ended')
    .option('--json', 'The deploys as one object')
    .option(...API_OPTION)
    .action((domain: string | undefined, options: DeployOptions) => deploys(domain, options));

  space
    .command('download')
    .argument('<deploy>', 'The deploy, by its number (plitzi space deploys lists them)', positiveInteger)
    .description('Save a kept deploy’s site as a zip, to host it anywhere by hand')
    .option('-o, --out <file>', 'Where to save it; deploy-<n>.zip here when left out')
    .option(...API_OPTION)
    .action((deployId: number, options: DownloadOptions) => download(deployId, options));

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
