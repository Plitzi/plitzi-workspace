// The name of an element's data source: `<type>_<id>`, the exact key a binding targets (`<source>.<field>`).
// Every element has an id and every id is a name a person chose, so a source name is readable and an element always
// publishes one. The first `_` separates the two halves (element types are camelCase), so an id's own underscores
// stay unambiguous.
const getSourceName = (type: string, id: string): string => `${type}_${id}`;

export default getSourceName;
