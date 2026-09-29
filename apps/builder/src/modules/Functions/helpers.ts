import type { FunctionsProblem } from '@plitzi/sdk-shared';

/** What a space's functions start as: one file and one task already written, to change rather than to learn from blank. */
export const STARTER_FILES: Record<string, string> = {
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-server/functions';

export default defineFunctions({
  // The hosts ctx.fetch may reach — anything else is refused before it leaves: ['api.example.com', '*.example.com']
  allow: { hosts: [] },
  tasks: [
    {
      namespace: 'hello',
      action: 'greet',
      title: 'Greet',
      description: 'Says hello, and counts how many times it has.',
      params: { name: { type: 'text', label: 'Name', defaultValue: 'world', canBind: true } },
      run: async ({ name }: { name: string }, ctx) => {
        const count = await ctx.kv.increment('greetings', 1);
        ctx.log('greeting', name, count);

        return { message: \`Hello, \${name}\`, count };
      }
    }
  ]
});
`
};

/** Where a problem is, as a person reads it: `lib/feed.ts:12:4`. */
export const problemPlace = ({ file, line, column }: FunctionsProblem): string =>
  file ? `${file}${line ? `:${String(line)}${column ? `:${String(column)}` : ''}` : ''}` : 'functions';

/** The params a Try sends, from what was typed: a JSON object, or the reason it is not one. */
export const readParams = (text: string): { params: Record<string, unknown> } | { error: string } => {
  try {
    const value: unknown = JSON.parse(text.trim() || '{}');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { params: Object.fromEntries(Object.entries(value)) };
    }
  } catch {
    // Answered below, the same as JSON that is not an object.
  }

  return { error: 'Params are a JSON object, by name: { "name": "Ada" }' };
};
