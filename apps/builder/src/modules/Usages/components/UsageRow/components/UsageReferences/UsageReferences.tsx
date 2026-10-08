import type { SpaceReference } from '../../../../helpers/usageIndex';

export type UsageReferencesProps = {
  references: SpaceReference[];
};

/** What uses the item and is not an element: the selectors and tokens that read it, the custom CSS, computed values. */
const UsageReferences = ({ references }: UsageReferencesProps) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Read by</span>
    <div className="flex flex-wrap gap-1">
      {references.map(reference => (
        <span
          key={`${reference.kind}:${reference.name}`}
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {reference.name}
        </span>
      ))}
    </div>
  </div>
);

export default UsageReferences;
