import CopyText from './CopyText';
import declaration from './declaration';

export type { CopyTextProps } from './CopyText';
export type { CopyTextAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(CopyText, declaration);
