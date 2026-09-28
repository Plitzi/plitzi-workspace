import declaration from './declaration';
import StickyStack from './StickyStack';

export type { StickyStackProps } from './StickyStack';
export type { StickyStackAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(StickyStack, declaration);
