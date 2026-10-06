import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

/** The part of a declaration read here, which not every declaration has. */
type ProviderShape = { type: string; sourceType?: string; content?: { market?: { category?: string } } };

const declarations: Record<string, ProviderShape> = elementDeclarations;

/**
 * The built-in types that exist only to provide data, by the prefix their source is named under.
 *
 * Only these are listed when nothing reads them. A list, a modal or a form publishes a source too, but has a job of its
 * own besides — one whose source nobody reads is not one to clean up — so those are listed once something reads them.
 */
export const PROVIDER_TYPES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(declarations).flatMap(({ type, sourceType, content }) =>
    sourceType && content?.market?.category === 'provider' ? [[type, sourceType]] : []
  )
);
