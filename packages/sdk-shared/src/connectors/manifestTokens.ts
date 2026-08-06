export type ConnectorTokenScope = 'request' | 'filter' | 'write';

export type ConnectorToken = {
  /** Written into a template as `{{value}}`. A trailing `.` marks a namespace whose keys the author names. */
  value: string;
  description: string;
  scopes: ConnectorTokenScope[];
};

/**
 * Every variable the engine binds when it renders a manifest template.
 *
 * This is the engine's contract stated once, so the builder can offer it as completions instead of asking authors
 * to learn it from a preset. A token missing here is a token the author cannot discover — keep it in step with the
 * `variables` maps in `fetchConnectorRecords` and `writeConnectorRecord`.
 */
export const connectorTokens: ConnectorToken[] = [
  {
    value: 'resource',
    description: 'Content type the element asked for, e.g. the "articles" in /api/articles.',
    scopes: ['request', 'write']
  },
  { value: 'limit', description: 'Page size the element asked for.', scopes: ['request'] },
  { value: 'offset', description: 'Records to skip. Zero-based; use it for offset paging.', scopes: ['request'] },
  { value: 'page', description: 'Page number. One-based; use it for page paging.', scopes: ['request'] },
  {
    value: 'cursor',
    description: 'Token the previous response returned. Use it for cursor paging.',
    scopes: ['request']
  },
  {
    value: 'credential.',
    description: 'A key from the credential this connector resolves, e.g. credential.token.',
    scopes: ['request', 'write']
  },
  {
    value: 'routeParams.',
    description: 'A parameter from the page URL, e.g. routeParams.slug for /blog/:slug.',
    scopes: ['request', 'filter']
  },
  {
    value: 'queryParams.',
    description: 'A parameter from the query string, e.g. queryParams.tag for ?tag=news.',
    scopes: ['request', 'filter']
  },
  {
    value: 'params.',
    description: 'Route and query parameters merged, route winning. Handy when either may carry the value.',
    scopes: ['request', 'filter']
  },
  { value: 'field', description: 'The field a filter targets. Only inside an operator template.', scopes: ['filter'] },
  { value: 'value', description: 'The value a filter compares. Only inside an operator template.', scopes: ['filter'] },
  { value: 'id', description: 'The record being written to. Only inside a write path.', scopes: ['write'] },
  { value: 'values.', description: 'A field of the record being written.', scopes: ['write'] }
];

export const getConnectorTokens = (scope: ConnectorTokenScope): ConnectorToken[] =>
  connectorTokens.filter(token => token.scopes.includes(scope));

export default connectorTokens;
