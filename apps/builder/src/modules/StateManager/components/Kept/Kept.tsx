import type { Persistence } from '../../helpers';

export type KeptProps = { persistence: Persistence };

/** How the space's settings keep a top-level key: a check when kept, the server and the browser when they hold it. */
const Kept = ({ persistence }: KeptProps) => (
  <span className="flex items-center justify-center gap-1 text-[11px]" title={persistence.reason}>
    {persistence.kept ? (
      <>
        <i className="fa-solid fa-check text-primary-text" aria-label="Kept" />
        {persistence.painted && <i className="fa-solid fa-server text-ui-fg-subtle text-[9px]" aria-label="painted" />}
        {persistence.browser && <i className="fa-solid fa-globe text-ui-fg-subtle text-[9px]" aria-label="browser" />}
      </>
    ) : (
      <span className="text-ui-fg-subtle" aria-label="Not kept">
        —
      </span>
    )}
  </span>
);

export default Kept;
