import declaration from './declaration';
import Notifier from './Notifier';

export type { NotifierProps } from './Notifier';
export type { NotifierAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(Notifier, declaration);
