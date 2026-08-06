import type { ConnectorPagination } from '@plitzi/sdk-shared';

export type PaginationDoc = {
  value: ConnectorPagination;
  label: string;
  description: string;
};

/**
 * What each paging style means in the provider's own terms.
 *
 * The names come from the CMS vendors, not from Plitzi, and "offset" versus "page" is the single choice most likely
 * to be picked wrong — both look like paging, and getting it backwards returns the first window forever. The
 * descriptions name the token each style makes available so the choice and the query template stay connected.
 */
export const paginationDocs: PaginationDoc[] = [
  {
    value: 'offset',
    label: 'Offset',
    description:
      'The provider skips N records. Use {{offset}} and {{limit}} in the query — Strapi, Directus, Contentful.'
  },
  {
    value: 'page',
    label: 'Page number',
    description: 'The provider counts pages from 1. Use {{page}} and {{limit}} in the query — WordPress, Ghost.'
  },
  {
    value: 'cursor',
    label: 'Cursor',
    description:
      'The provider returns a token for the next window. Use {{cursor}}; pages cannot be jumped to, only walked.'
  }
];

/**
 * One line per manifest field, in the terms of the thing being described rather than the JSON key.
 *
 * These are the questions an author actually has — "where do the records live in the response?" — and answering them
 * in the panel is the difference between the basic editor being usable and being a prettier JSON editor.
 */
export const fieldDocs = {
  baseUrl: 'Where the CMS lives, e.g. https://cms.example.com. Every path below is appended to it.',
  credential:
    'The secret this connector authenticates with. It is stored encrypted and resolved on the server; the manifest only ever names it.',
  authIn: 'Whether the credential travels as a request header or as a query parameter.',
  authName: 'The header or parameter name, e.g. Authorization.',
  authValue: 'The value to send. Reference the secret as {{credential.token}} — never paste the token itself.',
  headers: 'Extra headers sent with every request. Values accept the same tokens.',
  method: 'HTTP method this endpoint expects. Reading is usually GET; a search endpoint often takes POST.',
  path: 'Path appended to the base URL, with {{resource}} where the collection name goes, e.g. /api/{{resource}}.',
  listQuery: 'Query parameters sent on every read. This is where paging tokens go, e.g. limit = {{limit}}.',
  writeQuery: 'Query parameters sent with this write.',
  endpointHeaders: 'Headers for this endpoint only, merged over the connection headers.',
  itemsPath: 'Where the records array lives in the response, e.g. data. Leave empty if the response is the array.',
  totalPath:
    'Where the total record count lives, e.g. meta.pagination.total. Without it a pager can only offer next and previous.',
  idPath: 'Where the id of each record lives, relative to the record. Defaults to id.',
  valuesPath: 'Where the fields of each record live, relative to the record. Use . when the record itself holds them.',
  operators:
    'How this provider spells each comparison. The element picks an operator by name; this template turns it into a query parameter.',
  mediaBaseUrl:
    'Host to prepend to relative image and file URLs the CMS returns. Only values under keys ending in url, src or href are rewritten.',
  writeBodyPath: 'Key to wrap the submitted values in, e.g. data. Leave empty to send them at the root.'
} as const;

export const CONNECTOR_SERVER_ONLY_NOTE =
  'Connectors resolve on the server before the page reaches the browser. A space published without server rendering has no server to resolve them.';
