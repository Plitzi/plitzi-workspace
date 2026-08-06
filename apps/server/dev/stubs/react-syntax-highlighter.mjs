import { jsx } from 'react/jsx-runtime';

// Stub used only by the standalone source-loading dev server. react-syntax-highlighter registers
// refractor/prism languages as a top-level side effect, which throws under this ESM loader because the
// language modules arrive double-wrapped ({ default: { default: fn } }). Code blocks render as a plain
// <pre> here — highlighting is a dev-only cosmetic loss and the real bundled build is unaffected.
const SyntaxHighlighter = ({ children }) => jsx('pre', { children });
SyntaxHighlighter.registerLanguage = () => {};

export const PrismLight = SyntaxHighlighter;
export const PrismAsyncLight = SyntaxHighlighter;
export const Prism = SyntaxHighlighter;
export const PrismAsync = SyntaxHighlighter;
export const Light = SyntaxHighlighter;
export const LightAsync = SyntaxHighlighter;

export default SyntaxHighlighter;
