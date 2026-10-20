import type { SpaceSpec } from '../../schema';
import type { Element, SpaceComponent } from '@plitzi/sdk-shared';

export type SpecCorrectionCode =
  | 'legacy-element-id'
  | 'legacy-element-type'
  | 'unknown-element-type'
  | 'dropped-field'
  | 'dropped-attribute'
  | 'fixed-attribute'
  | 'dropped-setting'
  | 'missing-element'
  | 'unreachable-element'
  | 'folded-state-selector'
  | 'dropped-selector'
  | 'unwritable-css'
  | 'folded-custom-css'
  | 'unknown-style-state'
  | 'broken-binding'
  | 'fixed-binding-source'
  | 'broken-flow'
  | 'dead-flow'
  | 'dead-step'
  | 'fixed-global-callback'
  | 'dropped-initial-state'
  | 'dropped-param'
  | 'missing-folder'
  | 'broken-layout';

export interface SpecCorrection {
  code: SpecCorrectionCode;
  message: string;
  /** The element, page or selector it concerns. */
  at?: string;
}

export interface SpecFromSpaceOptions {
  /** The space's name, when the document does not carry one. */
  name?: string;
  /** The space's permanent URL, when the document does not carry one. Ids and selector names derive from it. */
  permanentUrl?: string;
  /** Element types a plugin provides. Kept as they are, where any other type the SDK does not ship is reported. */
  pluginTypes?: readonly string[];
  /**
   * Keep every element's id, the positional ones nothing refers to included.
   *
   * Left out, an id like `container-19` that nothing names is dropped and derived again, which is right for a copy.
   * For a space people keep working in it is not: the builder's tree shows the id as the element's name, and a test
   * or a person may know an element by it.
   */
  keepIds?: boolean;
}

export interface SpecFromSpace {
  spec: SpaceSpec;
  corrections: SpecCorrection[];
}

/** What a document's trees hang off: its pages, its layout shells and its components. */
export type Roots = { pages: Element[]; layouts: Element[]; components: SpaceComponent[] };
