import { BUILTIN_TRANSFORMERS, GLOBAL_SOURCES } from '@plitzi/sdk-authoring';

// Generated from sdk-authoring, which the linter validates against, so what the guide teaches is what a save accepts.
export const GLOBALS = GLOBAL_SOURCES.map(source => `\`${source}\``).join(', ');
export const OTHER_TRANSFORMERS = Object.keys(BUILTIN_TRANSFORMERS)
  .filter(action => action !== 'twigTemplate')
  .map(action => `\`${action}\``)
  .join(', ');
