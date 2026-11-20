/**
 * What the builder shows beside an element: each one's settings panel, keyed by type. The panels live with their
 * elements; this entry is apart so a page that renders elements, and a server that reads them, load none of them.
 */
export { defaultElementsSettings } from '../elements/settings';
// The fields a flag's or an audience's rule is written over, for the builder's rule editors.
export * from './ruleFields';
