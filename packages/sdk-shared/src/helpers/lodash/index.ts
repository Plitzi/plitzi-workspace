/**
 * The lodash-like utilities sdk-shared reads paths and keys with — a copy of plitzi-ui's own, which keeps its for its 29
 * files (RFC 0032, D13): generic, with no Plitzi rule in them, so two copies are not two sources of truth for any rule,
 * and a server reaches neither React nor a UI library to read a path.
 */
export * from './get';
export * from './set';
export * from './omit';
export * from './has';
export * from './capitalize';
export * from './camelCase';
