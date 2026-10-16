/**
 * A project on disk — its layout, its paths, its root — as the CLI and the page server read it. Node only, so never
 * part of the package's root, which a browser imports.
 */
export * from './layout';
export * from './network';
export * from './paths';
export * from './root';
