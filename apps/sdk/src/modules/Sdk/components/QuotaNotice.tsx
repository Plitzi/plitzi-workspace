import { useRenderSettings } from '@plitzi/sdk-shared/store';

/**
 * What a site says while its plan's allowance is nearly spent, and once it is over.
 *
 * The server decides both, not the page: `render.quotaNear` and `render.overQuota` are set from what metering answered
 * for THIS render, so a space cannot turn them off from its own settings. It renders nothing at all the rest of the
 * time, which is every render of every space well inside its allowance.
 *
 * Deliberately a line and a link rather than a modal or an interstitial: the site still works, its visitors are not
 * the ones who can fix this, and the person who can is the one who recognises their own site. Nearly spent is said
 * plainly, without the amber of over: nothing has happened yet.
 */
const QuotaNotice = () => {
  const { overQuota, quotaNear } = useRenderSettings();
  if (!overQuota && !quotaNear) {
    return null;
  }

  return (
    <div className={`plitzi-quota-notice plitzi-quota-notice--${overQuota ? 'over' : 'near'}`} role="status">
      <span className="plitzi-quota-notice__text">
        {overQuota ? 'This site is over its monthly plan limit.' : 'This site is close to its monthly plan limit.'}
      </span>
      <a
        className="plitzi-quota-notice__cta"
        href="https://plitzi.com/pricing"
        rel="noreferrer noopener"
        target="_blank"
      >
        {overQuota ? 'Upgrade' : 'See plans'}
      </a>
    </div>
  );
};

export default QuotaNotice;
