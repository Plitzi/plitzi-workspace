// An entry of its own, not in `helpers`: the browser's elements keep their data with it, and the page server, which
// loads `helpers` whole, never does (`apps/server/scripts/checkFootprint.mjs`).
export * from './replaceEqualDeep';
