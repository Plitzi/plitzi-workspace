import Alert from '@plitzi/plitzi-ui/Alert';

import useNextPrune from '@pmodules/Space/hooks/useNextPrune';

import { pruneSentence } from './helpers';

export type SnapshotPruneNoticeProps = {
  /** The environment the snapshot is about to be taken into. */
  environment: string;
};

/** What the snapshot about to be taken removes, said before it is taken (RFC 0029 §6.1). Nothing when it removes none. */
const SnapshotPruneNotice = ({ environment }: SnapshotPruneNoticeProps) => {
  const prune = useNextPrune(environment);
  const sentence = prune ? pruneSentence(prune) : '';
  if (!sentence) {
    return null;
  }

  return (
    <Alert intent="warning" size="sm" solid={false}>
      {sentence}
    </Alert>
  );
};

export default SnapshotPruneNotice;
