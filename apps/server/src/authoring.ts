/**
 * Authoring a space in code, from the package a server already has.
 *
 * The same surface as `@plitzi/plitzi-sdk/authoring`, re-exported here because of where authoring actually happens:
 * a seed, a migration, a deployment that builds its pages rather than editing them, a self-hosted server that
 * never opens the builder at all. None of those install a browser SDK to write a page, and none of them should
 * have to.
 *
 * Re-exported rather than reassembled: one list of fragments, in the SDK, so the two entries cannot come to mean
 * different things. `authoring.test.ts` holds them to it.
 */

export * from '@plitzi/plitzi-sdk/authoring';
