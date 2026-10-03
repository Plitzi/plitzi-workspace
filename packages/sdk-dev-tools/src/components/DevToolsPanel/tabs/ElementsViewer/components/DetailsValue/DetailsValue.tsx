import ElementLink from '../ElementLink';

export type DetailsValueProps = {
  attribute: string;
  value: unknown;
  isDefinition?: boolean;
  onSelectElement?: (id: string) => void;
};

/** The definition's fields that name other elements: shown as links to them. */
const LINKS = new Set(['rootId', 'parentId']);

/** A value as text: a definition's selectors by their classes, anything else as JSON would say it. */
const textOf = (attribute: string, value: unknown, isDefinition: boolean): string => {
  if (typeof value === 'object' && value !== null) {
    return isDefinition && attribute === 'styleSelectors' ? Object.values(value).join(', ') : JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

/** A value of a definition or an attribute as one line: the elements it names as links, anything else as text. */
const DetailsValue = ({ attribute, value, isDefinition = false, onSelectElement }: DetailsValueProps) => {
  if (isDefinition && attribute === 'items' && Array.isArray(value)) {
    return (
      <div className="flex flex-col">
        {value
          .filter(item => typeof item === 'string')
          .map(item => (
            <ElementLink key={item} id={item} onSelect={onSelectElement} />
          ))}
      </div>
    );
  }

  if (isDefinition && LINKS.has(attribute) && typeof value === 'string') {
    return <ElementLink id={value} onSelect={onSelectElement} />;
  }

  return <>{textOf(attribute, value, isDefinition)}</>;
};

export default DetailsValue;
