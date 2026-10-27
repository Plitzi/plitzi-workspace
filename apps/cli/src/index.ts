import { commandPath } from './commandPath';
import { bestEffortTypeOfService } from './http';
import { buildProgram } from './program';
import { startUsage } from './runs/core/usage';

bestEffortTypeOfService();
const program = buildProgram();
const args = process.argv.slice(2);
startUsage(args, process.cwd(), commandPath(program, args));
await program.parseAsync(process.argv);
