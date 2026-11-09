import { useActionRuns } from '@plitzi/sdk-shared/store';

/**
 * What a page says while one of its calls waits in the queue: no worker or runner could run it when it was asked, and
 * it runs on its own as soon as one can — the visitor's click was not lost. The run reads `queued` until then.
 *
 * Calm on purpose: nothing failed, nothing is the visitor's to do, and leaving the page does not undo it. It renders
 * nothing the rest of the time, which is every page whose server answers.
 */
const QueuedNotice = () => {
  const { runs } = useActionRuns();
  const waiting = runs.filter(run => run.status === 'queued').length;
  if (waiting === 0) {
    return null;
  }

  return (
    <div className="plitzi-queued-notice" role="status" aria-live="polite">
      <span className="plitzi-queued-notice__dot" aria-hidden="true" />
      <span>
        {waiting === 1
          ? 'Your request is waiting for the server — it will finish on its own.'
          : `${String(waiting)} requests are waiting for the server — they will finish on their own.`}
      </span>
    </div>
  );
};

export default QueuedNotice;
