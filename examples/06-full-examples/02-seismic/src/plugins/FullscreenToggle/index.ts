import declaration from './declaration';
import FullscreenToggle from './FullscreenToggle';

export type { FullscreenToggleProps } from './FullscreenToggle';
export type { FullscreenToggleAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type from. */
export default Object.assign(FullscreenToggle, declaration);
