// The name of an element's data source: `<type>_<idRef>`, the exact key a binding targets (`<source>.<field>`).
// Empty when the element has no idRef — it then publishes no source at all. That is deliberate: keeping the opaque
// id out of source names is what lets an idRef be assigned later without invalidating an existing binding.
const getSourceName = (type: string, element: { idRef?: string }): string =>
  element.idRef ? `${type}_${element.idRef}` : '';

export default getSourceName;
