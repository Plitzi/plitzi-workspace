import DomainCard from './DomainCard';

import type { SpaceTarget } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type DomainListProps = {
  /** The space's own address, first: where the site is before any domain, with nothing to publish. */
  own: ReactNode;
  domains: readonly SpaceTarget[];
  chosen: string | undefined;
  loading: boolean;
  /** Where the space's domains are added: the console's Domains tab. */
  addUrl: string;
  /** The plan that includes domains of the space's own, when its own does not. */
  lockedBy?: string;
  /** Choosing one is what publishing is about: absent in the history, which only reads them. */
  publishing: boolean;
  onChoose: (domain: string) => void;
  onSettings: (domain: string) => void;
};

/**
 * Where the site is, in one list: the space's own address — always the latest saved edits — then the domains, one
 * chosen to publish to, and the way to connect another. Before there is any, what one is for.
 */
const DomainList = ({
  own,
  domains,
  chosen,
  loading,
  addUrl,
  lockedBy,
  publishing,
  onChoose,
  onSettings
}: DomainListProps) => (
  <section className="flex flex-col gap-2" aria-label="Where your site is">
    <div className="flex flex-col gap-0.5">
      <h5 className="text-ui-fg text-sm font-semibold">Where your site is</h5>
      {publishing && domains.length > 0 && (
        <span className="text-ui-fg-subtle text-xs">Choose the domain to publish to.</span>
      )}
    </div>
    <ul className="border-ui-line divide-ui-line flex flex-col divide-y overflow-hidden rounded-lg border">
      {own}
      {loading && <li className="text-ui-fg-subtle px-3 py-2.5 text-xs">Reading the domains…</li>}
      {domains.length > 0 && (
        <li>
          <ul role="radiogroup" aria-label="Domain to publish to" className="divide-ui-line flex flex-col divide-y">
            {domains.map(domain => (
              <DomainCard
                key={domain.domain}
                target={domain}
                chosen={domain.domain === chosen}
                onChoose={onChoose}
                {...(domain.plitziOwned ? {} : { onSettings })}
              />
            ))}
          </ul>
        </li>
      )}
      <li>
        <a
          href={addUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-600 dark:text-primary-300 hover:bg-ui-hover flex items-start gap-2.5 px-3 py-2.5 text-sm font-medium"
        >
          <span className="border-primary-500/50 flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed text-xs">
            <i className="fa-solid fa-plus" aria-hidden />
          </span>
          <span className="flex flex-col gap-0.5">
            Connect a domain you own
            {!loading && domains.length === 0 && (
              <span className="text-ui-fg-subtle text-xs font-normal">
                www.example.com instead of the Plitzi address: it shows what you publish on it, and changes only when
                you publish again.
                {lockedBy ? ` Included in the ${lockedBy} plan.` : ''}
              </span>
            )}
          </span>
        </a>
      </li>
    </ul>
  </section>
);

export default DomainList;
