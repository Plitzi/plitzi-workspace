import { bestEffortTypeOfService } from './http';
import { buildProgram } from './program';
import { startUsage } from './runs/usage';

bestEffortTypeOfService();
const program = buildProgram();
startUsage(process.argv.slice(2), process.cwd());
await program.parseAsync(process.argv);
