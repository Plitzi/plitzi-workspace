/**
 * Dates as a page shows them — formatted, parsed, relative to now — in the locales a space speaks. Apart from `helpers`
 * because date-fns is heavy to load (a hundred modules), and only what shows a date should pay for it.
 */
export * from './formatDate';
export * from './isDate';
