import { buildProgram } from './program';
import { startUsage } from './runs/usage';

const program = buildProgram();
startUsage(process.argv.slice(2), process.cwd());
await program.parseAsync(process.argv);
