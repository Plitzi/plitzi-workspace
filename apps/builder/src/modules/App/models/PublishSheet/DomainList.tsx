import DomainCard from './DomainCard';

import type { SpaceTarget } from '@plitzi/sdk-shared';

export type DomainListProps = {
  domains: readonly SpaceTarget[];
  chosen: string | undefined;
  loading: boolean;
  /** Where the space's domains are added: the console's Domains tab. */
  addUrl: string;
  /** The plan that includes domains of the space's own, when its own does not. */
  lockedBy?: string;
  onChoose: (domain: string) => void;
  onSettings: (domain: string) => void;
};

/**
 * The domains a version is published to, one chosen — or, before the space has any, what one is for and where to add
 * it: publishing means nothing until there is somewhere to publish.
 */
const DomainList = ({ domains, chosen, loading, addUrl, lockedBy, onChoose, onSettings }: DomainListProps) => (
  <section className="flex flex-col gap-2" aria-label="Your domains">
    <span className="flex items-center justify-between gap-2">
      <h5 className="text-ui-fg text-sm font-semibold">Your domains</h5>
      {domains.length > 0 && (
        <a
          href={addUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-600 dark:text-primary-300 text-xs font-medium hover:underline"
        >
          Add a domain
        </a>
      )}
    </span>
    {loading && <span className="text-ui-fg-subtle text-xs">Reading the domains…</span>}
    {!loading && domains.length === 0 && (
      <div className="border-ui-line flex flex-col items-start gap-2 rounded-lg border border-dashed p-3">
        <span className="text-ui-fg text-sm">Put the site on a domain of your own</span>
        <span className="text-ui-fg-subtle text-xs">
          www.example.com instead of the Plitzi address. A domain shows the version you publish on it, and changes only
          when you publish again.
          {lockedBy ? ` Included in the ${lockedBy} plan.` : ''}
        </span>
        <a
          href={addUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="bg-primary-600 hover:bg-primary-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white"
        >
          <i className="fa-solid fa-plus text-[10px]" aria-hidden />
          Add a domain
        </a>
      </div>
    )}
    {domains.length > 0 && (
      <div role="radiogroup" aria-label="Domain" className="flex flex-col gap-1.5">
        {domains.map(domain => (
          <DomainCard
            key={domain.domain}
            target={domain}
            chosen={domain.domain === chosen}
            onChoose={onChoose}
            {...(domain.plitziOwned ? {} : { onSettings })}
          />
        ))}
      </div>
    )}
  </section>
);

export default DomainList;
