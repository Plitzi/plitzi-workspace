import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The authoring skill, copied in at publish time.
 *
 * It is owned by `@plitzi/sdk-authoring` — the package that implements what it teaches — and it ships here as well
 * because of who installs this one: a self-hoster has `@plitzi/sdk-server` and an agent, and should find the skill
 * without first having to learn that an authoring package exists. That makes it the one thing in two tarballs, and
 * it is a file rather than an API, so it is COPIED from the single source on `prepack` instead of checked in twice
 * and kept in sync by hand.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.resolve(here, '../../../packages/sdk-authoring/skills/plitzi-authoring');
const to = path.resolve(here, '../skills/plitzi-authoring');

await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });

console.log(`Copied the authoring skill from ${path.relative(process.cwd(), from)}`);
