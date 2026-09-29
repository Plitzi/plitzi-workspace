// Every document here is a plain string, marked `/* GraphQL */` for the editor and Prettier. Parsing is the client's
// business: the builder's Apollo parses what it sends with its own `gql`, the SDK only ever sends the text — and a
// server importing this package loads no GraphQL parser and parses nothing at boot.
export * from './builder';
export * from './sdk';
