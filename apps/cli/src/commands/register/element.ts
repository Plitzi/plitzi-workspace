import { Option } from 'commander';

import { move, remove } from '../arrange';
import { edit } from '../edit';
import { elements } from '../spaceReading';
import { where, WHERE_READINGS } from '../where';

import type { MoveOptions, RemoveOptions } from '../arrange';
import type { EditOptions } from '../edit';
import type { WhereOptions } from '../where';
import type { Command } from 'commander';

/** `plitzi element …`: an element of the space added, edited, removed and moved where it is written. */
export const registerElement = (elementGroup: Command): void => {
  elementGroup
    .command('where')
    .argument('<query>', 'An element’s id, a class it wears, or words it shows: hero-cta, navLink, "Get started"')
    .description('Where the project’s code writes an element: the file, the line and the call itself')
    .addOption(
      new Option(
        '--by <reading>',
        'Read the query one way only, not the first of id, class and words that matches'
      ).choices(WHERE_READINGS)
    )
    .option('--json', 'One object, for a tool or an agent')
    .action((query: string, options: WhereOptions) => where(query, options));

  elementGroup
    .command('edit')
    .argument('<id>', 'The element, by its id: hero-cta')
    .description('Change an element’s attributes in the call that writes it, then check the space still authors')
    .option('--set <key=value...>', 'An attribute to write: content="Start free", required=true')
    .option('--remove <key...>', 'An attribute to take out')
    .option('--every', 'The call writes other elements too, and the change is for every one')
    .option('--json', 'One object, for a tool or an agent')
    .action((id: string, options: EditOptions) => edit(id, options));

  elementGroup
    .command('remove')
    .argument('<id>', 'The element, by its id: ent-trust')
    .description('Take an element out of the code that writes it, with what only it used, then check the space')
    .option('--json', 'One object, for a tool or an agent')
    .action((id: string, options: RemoveOptions) => remove(id, options));

  elementGroup
    .command('move')
    .argument('<id>', 'The element, by its id: ent-faq')
    .description('Put an element before or after a sibling in the code that writes them, then check the space')
    .option('--before <id>', 'The sibling it goes before')
    .option('--after <id>', 'The sibling it goes after')
    .option('--json', 'One object, for a tool or an agent')
    .action((id: string, options: MoveOptions) => move(id, options));

  // What `element edit`, `remove` and `move` read the space with in a fresh process, after they changed a file: not a
  // command for a person.
  elementGroup.command('readings', { hidden: true }).action(() => elements());
};
