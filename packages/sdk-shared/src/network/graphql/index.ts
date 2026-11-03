// Every document here is a plain string, marked `/* GraphQL */` for the editor and Prettier. Parsing is the client's
// business: the builder's Apollo parses what it sends with its own `gql` — and a server importing this package loads no
// GraphQL parser and parses nothing at boot. The SDK sends none: it asks the page server for the space
// (`/_plitzi/space.json`), the document a page drawn there fetches.
export * from './builder';
