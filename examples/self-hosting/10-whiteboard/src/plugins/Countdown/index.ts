import Countdown from './Countdown';
import declaration from './declaration';

export type { CountdownProps } from './Countdown';
export type { CountdownAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and actions from. */
export default Object.assign(Countdown, declaration);
