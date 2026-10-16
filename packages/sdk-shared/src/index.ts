/**
 * The document every package reads and writes — a space, its elements, styles, flows and the contracts around them —
 * as types, and nothing else. What the package does is imported from the folder that does it
 * (`@plitzi/sdk-shared/helpers`, `@plitzi/sdk-shared/theme`…), so importing a type never loads the runtime.
 */
export * from './types';
