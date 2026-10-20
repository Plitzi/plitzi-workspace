export type SchemaValidationOptions = {
  /** Validates `flat` as a fragment hung off this element — a component's tree — instead of as the pages' tree. */
  baseElementId?: string;
  /**
   * Element type → the source name it publishes under.
   *
   * Without it a binding's source can only be half-checked: the type half is compared against the types that
   * happen to be in this document, so a typo'd id is caught only when some element of that same type is present,
   * and a prefix that is simply the wrong word for the element it names is never caught at all.
   */
  sourceTypes?: Record<string, string>;
};

export type SchemaValidationError = {
  code: string;
  message: string;
  elementId?: string;
  /** The component whose tree the error is in; absent for the pages' tree. */
  componentId?: string;
  /** The name an element points at that no element answers to — what a suggestion of the nearest one is made from. */
  missing?: string;
  /** The step the missing element was to answer (`openModal`): a suggestion is drawn from the elements that do. */
  wantedBy?: string;
  details?: unknown;
};

export type SchemaValidationResult = {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
};

/**
 * The errors that are a reference to something no longer there, rather than the document being broken.
 *
 * An editor produces them in the ordinary course of editing: delete a provider and the binding that read it names
 * nothing, delete an element and the step aimed at it has no target. The next edit is what settles them — rebind, or
 * drop the step — so a writer that edits one change at a time reports them and refuses them only when the space is
 * about to be served. Every other error is the tree itself broken — an orphan, a cycle, two ids for one element — and
 * no sequence of edits should ever leave one behind.
 */
export const REFERENCE_ERROR_CODES: ReadonlySet<string> = new Set([
  'UNRESOLVED_BINDING_SOURCE',
  'MISMATCHED_BINDING_SOURCE',
  'UNRESOLVED_INTERACTION_TARGET',
  'UNRESOLVED_COMPONENT',
  'UNKNOWN_COMPONENT_SLOT'
]);

/** Whether an error is the document itself being broken, as opposed to a reference an edit left dangling. */
export const isIntegrityError = (error: SchemaValidationError): boolean => !REFERENCE_ERROR_CODES.has(error.code);
