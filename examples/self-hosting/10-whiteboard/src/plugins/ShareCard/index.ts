import declaration from './declaration';
import ShareCard from './ShareCard';

export type { ShareCardProps } from './ShareCard';
export type { ShareCardAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(ShareCard, declaration);
