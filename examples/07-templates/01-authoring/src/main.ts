import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pricingCard } from './template';

/**
 * The whole build: author the template, write the JSON.
 *
 * There is no server here and no account anywhere — a template is a file. What this prints is the only thing a
 * template author cannot see by looking at their own declaration: the warnings, which are about what would NOT
 * travel with it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../dist');

const { template, warnings } = pricingCard();

await mkdir(outDir, { recursive: true });
const file = path.join(outDir, 'pricing-card.json');
await writeFile(file, `${JSON.stringify(template, null, 2)}\n`);

console.log(`[example] wrote ${path.relative(process.cwd(), file)}`);
console.log(`[example] ${Object.keys(template.schema.flat).length} elements, base "${template.definition.baseElementId}"`);

if (warnings.length > 0) {
  warnings.forEach(warning => console.warn(`[example] ${warning.code}: ${warning.message}`));
}
