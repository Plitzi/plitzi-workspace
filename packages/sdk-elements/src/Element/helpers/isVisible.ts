// `visibility` reaches the element state either as a boolean (set from an interaction) or as the string a binding or
// a twig token produced, so both spellings of hidden have to be recognised. Anything else — including the state key
// being absent, which is the common case — means visible.
export const isVisible = (visibility: unknown): boolean => visibility !== false && visibility !== 'false';
