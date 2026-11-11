/**
 * The run's commands, loaded when one of them runs: registering them reads their names, options and help alone, so a
 * command that is not one of them never loads the harness — the CLI's own bundle keeps it in a chunk of its own.
 */
export const runCommands = () => import('..');
