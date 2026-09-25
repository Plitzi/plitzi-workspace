import declaration from './declaration';
import SeismicMap from './SeismicMap';

export type { SeismicMapProps } from './SeismicMap';
export type { SeismicMapAttributes } from './declaration';

/** The component, carrying its declaration — what the SDK and the builder read the element's type and events from. */
export default Object.assign(SeismicMap, declaration);
