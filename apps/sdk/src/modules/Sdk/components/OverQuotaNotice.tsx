import useRenderSettings from '@plitzi/sdk-shared/store/renderSettings';

/**
 * What a site says while it is over its plan's quota.
 *
 * The server decides this, not the page: `render.overQuota` is set from what metering answered for THIS render, so
 * a space cannot turn it off from its own settings — the same reason the "Made in Plitzi" badge is forced on while
 * degraded. It renders nothing at all the rest of the time, which is every render of every paid or in-quota space.
 *
 * Deliberately a line and a link rather than a modal or an interstitial: the site still works, its visitors are not
 * the ones who can fix this, and the person who can is the one who recognises their own site.
 */
const OverQuotaNotice = () => {
  const { overQuota } = useRenderSettings();
  if (!overQuota) {
    return null;
  }

  return (
    <div className="plitzi-over-quota" role="status">
      <span className="plitzi-over-quota__text">This site is over its monthly plan limit.</span>
      <a className="plitzi-over-quota__cta" href="https://plitzi.com/pricing" rel="noreferrer noopener" target="_blank">
        Upgrade
      </a>
    </div>
  );
};

export default OverQuotaNotice;
