import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { Schema, Style } from '@plitzi/sdk-shared';

const SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dev/sample');
// JSON.parse answers unknown: these are the files `yarn start` and the agent benchmark serve, in the shapes they load.
const schema = (JSON.parse(readFileSync(path.join(SAMPLE, 'space.json'), 'utf-8')) as { schema: Schema }).schema;
const style = JSON.parse(readFileSync(path.join(SAMPLE, 'style.json'), 'utf-8')) as Style;

describe('the dev sample', () => {
  // Its headings once wore classes nothing defined: they rendered unstyled, and an agent asked to give one heading's
  // class to another was refused by the MCP — rightly — on a task the benchmark counted as the agent's failure.
  it('dresses every element with a class the space defines', () => {
    const classes = new Set(
      Object.values(style.platform).flatMap(breakpoint =>
        Object.entries(breakpoint)
          .filter(([, item]) => item.type === 'class')
          .map(([name]) => name)
      )
    );
    const undefinedClasses = Object.values(schema.flat).flatMap(element => {
      const worn = Object.values(element.definition.styleSelectors).flatMap(names => names.split(' '));

      return worn.filter(name => name !== '' && !classes.has(name)).map(name => `${element.id}: ${name}`);
    });

    expect(undefinedClasses).toEqual([]);
  });
});
