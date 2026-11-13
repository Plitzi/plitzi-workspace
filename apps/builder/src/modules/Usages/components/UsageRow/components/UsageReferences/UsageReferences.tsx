import type { SpaceReference } from '../../../../helpers/usageIndex';

export type UsageReferencesProps = {
  references: SpaceReference[];
};

/** What uses the item and is not an element: the selectors and tokens that read it, the custom CSS, computed values. */
const UsageReferences = ({ references }: UsageReferencesProps) => (
  <div className="flex flex-col gap-1">
    <span className="text-ui-fg-subtle text-[11px] tracking-wider uppercase">Read by</span>
    <div className="flex flex-wrap gap-1">
      {references.map(reference => (
        <span
          key={`${reference.kind}:${reference.name}`}
          className="bg-ui-raised text-ui-fg rounded px-1.5 py-0.5 font-mono text-[11px]"
        >
          {reference.name}
        </span>
      ))}
    </div>
  </div>
);

export default UsageReferences;
