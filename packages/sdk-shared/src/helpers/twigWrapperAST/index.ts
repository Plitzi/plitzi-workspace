// AST-based Twig template engine implementation.
// Same API as the regex-based twigWrapper — parse once, evaluate many.
export { processTwig } from './processTwig';
export type { ASTNode, Expression } from './AST';
