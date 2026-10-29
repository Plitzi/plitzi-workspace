import { useRenderSettings } from '@plitzi/sdk-shared/store';

/**
 * The deployment's "Made with Plitzi" badge, with the way to report a site that abuses the address it is served on.
 *
 * The server decides it, as it decides `overQuota`: `render.badge` is set from what metering answered for THIS render,
 * so a space cannot remove it from its own settings — a plan that includes serving without it is the only way. It
 * renders nothing the rest of the time, which is every render of a self-hosted server, whose metering never sets it.
 */
const PlitziBadge = () => {
  const { badge } = useRenderSettings();
  if (!badge) {
    return null;
  }

  return (
    <div className="plitzi-badge">
      <a className="plitzi-badge__made" href="https://plitzi.com" rel="noreferrer noopener" target="_blank">
        Made with Plitzi
      </a>
      <a
        className="plitzi-badge__report"
        href="https://plitzi.com/report-abuse"
        rel="noreferrer noopener nofollow"
        target="_blank"
      >
        Report
      </a>
    </div>
  );
};

export default PlitziBadge;
