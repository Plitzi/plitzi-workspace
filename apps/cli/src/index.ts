import { commandPath } from './commandPath';
import { unglued } from './glued';
import { bestEffortTypeOfService } from './http';
import { buildProgram } from './program';
import { startUsage } from './runs/core/usage';

bestEffortTypeOfService();
const program = buildProgram();
const { args, split } = unglued(process.argv.slice(2));
// Said, never silent: what was read otherwise than it arrived.
for (const arg of split) {
  process.stderr.write(`plitzi: read '${arg}' as its flags — a shell variable holding them arrived as one argument\n`);
}

startUsage(args, process.cwd(), commandPath(program, args));
await program.parseAsync([...process.argv.slice(0, 2), ...args]);
