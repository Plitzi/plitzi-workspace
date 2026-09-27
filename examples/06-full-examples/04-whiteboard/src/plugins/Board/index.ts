import Board from './Board';
import declaration from './declaration';

export type { BoardProps } from './Board';
export type { BoardAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(Board, declaration);
