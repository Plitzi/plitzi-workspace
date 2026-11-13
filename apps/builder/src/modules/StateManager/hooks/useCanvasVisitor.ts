import { useCallback } from 'react';

import { journeyAccount } from '@plitzi/sdk-authoring';
import { useBuilderStore, useBuilderStoreGetter } from '@plitzi/sdk-shared/store';

/** Who the canvas shows the page to: the editor's own session, a guest, or one of the space's test accounts. */
export type CanvasVisitor = { kind: 'editor' } | { kind: 'guest' } | { kind: 'account'; id: string };

/**
 * The canvas's visitor, as the State Manager chooses it. An account is laid over the page as the Tests' journeys lay
 * theirs (`runtime.testAccount`, its roles' permissions worked out by `journeyAccount`); a guest is `canvasGuest`. A
 * journey on the canvas decides its own visitor, and the choice waits until it is closed.
 */
const useCanvasVisitor = () => {
  const [[testAccount, canvasGuest = false, journeyOnCanvas = false, accounts]] = useBuilderStore([
    'runtime.testAccount',
    'canvasGuest',
    'journeyOnCanvas',
    'schema.tests.accounts'
  ]);
  const [, setTestAccount] = useBuilderStore('runtime.testAccount');
  const [, setCanvasGuest] = useBuilderStore('canvasGuest');
  const getSchema = useBuilderStoreGetter('schema');

  const visitor: CanvasVisitor = testAccount
    ? { kind: 'account', id: testAccount.id }
    : canvasGuest
      ? { kind: 'guest' }
      : { kind: 'editor' };

  /** Shows the page to `next`; an account the space no longer declares answers why, and nothing changes. */
  const choose = useCallback(
    (next: CanvasVisitor): string | undefined => {
      if (next.kind !== 'account') {
        setTestAccount(undefined);
        setCanvasGuest(next.kind === 'guest');

        return undefined;
      }

      const playsAs = journeyAccount({ as: next.id }, getSchema());
      if ('problem' in playsAs) {
        return playsAs.problem;
      }

      setCanvasGuest(false);
      setTestAccount(playsAs.account);

      return undefined;
    },
    [getSchema, setCanvasGuest, setTestAccount]
  );

  return { visitor, choose, accounts: accounts ?? [], journeyOnCanvas };
};

export default useCanvasVisitor;
