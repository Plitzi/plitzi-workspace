import { contentAttributesOf } from '@plitzi/sdk-elements/elements/declarations';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

/**
 * The content attributes of a type, read where the server's gate reads them: a plugin's in its manifest — over a
 * built-in type of the same name — and a built-in's in its declaration (`contentAttributesOf`).
 */
const contentAttributesFor = (type: string, registered: ComponentDefinition | undefined): readonly string[] =>
  registered && 'manifest' in registered ? (registered.contentAttributes ?? []) : contentAttributesOf(type);

export default contentAttributesFor;
