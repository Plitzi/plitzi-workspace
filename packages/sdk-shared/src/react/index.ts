/**
 * What sdk-shared offers code that renders with React: a context that is one across every copy of the SDK a page loads
 * (`sharedContext`), the facade a plugin's element is drawn through, and whether a space is drawn inside another. Apart
 * from `/helpers`, which a server loads: nothing there reaches React (RFC 0032, D13).
 */
export * from './sharedContext';
export * from './generateFacade';
export * from './enclosingSpace';
