import { useCallback, use, useMemo } from 'react';

import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';
import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import { stateCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StateInteractionsProps = {
  children?: ReactNode;
};

const StateInteractions = ({ children }: StateInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  // `unknown` covers both forms the store accepts here: a value for `setState`, and the updater `toggleState` needs
  // to flip what is already there. The typed hook cannot express an arbitrary runtime path, hence the cast.
  const setState = useCommonStoreSetter() as (path: string, value: unknown) => void;

  const handleSetState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; type: string; value: string | boolean | number }>) => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        // The picker in the builder writes the WORD, and a bound or interpolated value arrives as whatever it
        // already was — a step reading `{{ someAction.output.done }}` hands over a real boolean. Reading only the
        // word turned every one of those into `false`, which is the answer that looks like it worked.
        value = value === true || value === 'true';
      } else if (type === 'number') {
        value = parseInt(value as string, 10);
      }

      setState(`runtime.state.${key}`, value);
    },
    [setState]
  );

  // Read and written in one pass through the store's updater form, so the value flipped is the one that is there at
  // that instant. A read-then-write would take the value from the flow's own snapshot, which is what made the
  // two-branch toggle depend on being one step behind.
  const handleToggleState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string }>) => {
      const { key } = params;
      if (!key) {
        return;
      }

      setState(`runtime.state.${key}`, (prev: unknown) => !(prev === true || prev === 'true'));
    },
    [setState]
  );

  /**
   * The two operations a LIST needs, which `setState` cannot express.
   *
   * `setState` stores a scalar at a path, so a space could hold a fixed set of flags and nothing else — a checklist
   * whose items were written by whoever authored the space, with no way for the person using it to add one or take
   * one away. Everything else was already here: the store's setter takes an updater, which is how `toggleState`
   * reads and writes in one pass, and a controlled `list` renders whatever array it is bound to.
   *
   * Through the updater form for the same reason `toggleState` is: two rows removed in the same tick would
   * otherwise both compute from the flow's own snapshot, and the second would put the first one back.
   */
  const handleAppendState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; value: unknown }>) => {
      const { key, value } = params;
      if (!key) {
        return;
      }

      // A key nobody has written yet appends to nothing rather than failing, so a list needs no priming step.
      setState(`runtime.state.${key}`, (prev: unknown): unknown[] => [
        ...(Array.isArray(prev) ? (prev as unknown[]) : []),
        value
      ]);
    },
    [setState]
  );

  /**
   * Drops one entry, by VALUE or by position.
   *
   * By value wherever the list can change under the person: a position is only true for as long as nothing before
   * it moves, and a row's position is captured when the row renders. Pressing a row's button twice — which is what
   * anybody does to a control that seems not to have answered — then acted on whatever had shifted into that slot:
   * a double-click on the first row removed the first row AND the one that took its place.
   *
   * Position is still there because it is the honest answer when there is nothing else to go on: a list of
   * duplicates, or one whose entries are not comparable.
   */
  const handleRemoveState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; index?: string | number; value?: unknown }>) => {
      const { key, index, value } = params;
      if (!key) {
        return;
      }

      if (value !== undefined && value !== '') {
        setState(`runtime.state.${key}`, (prev: unknown): unknown[] =>
          Array.isArray(prev) ? (prev as unknown[]).filter(entry => entry !== value) : []
        );

        return;
      }

      // The index arrives interpolated from a row, so it is a string — and `''`, which `parseInt` reads as NaN, is
      // exactly what a token that resolved to nothing looks like. Removing "position NaN" would empty the list.
      const at = typeof index === 'number' ? index : parseInt(index ?? '', 10);
      if (Number.isNaN(at)) {
        return;
      }

      setState(`runtime.state.${key}`, (prev: unknown): unknown[] =>
        Array.isArray(prev) ? (prev as unknown[]).filter((_, position) => position !== at) : []
      );
    },
    [setState]
  );

  /**
   * Moves one entry from one list to another, and does nothing at all if it is not in the first.
   *
   * The operation a checkbox needs, and the reason it is ONE step rather than an append beside a remove: written as
   * two, pressing the box twice ran the pair twice, and the second run appended an entry the first had already
   * moved — the same task in both lists, or twice in the second. Here the second press finds nothing to move.
   *
   * The flag is read inside the first updater and used after it, which is sound because the store applies an
   * updater synchronously — the same property `toggleState` depends on to flip a value where it is read.
   */
  const handleMoveState = useCallback(
    (params: InteractionCallbackParamValues<{ from: string; to: string; value: unknown }>) => {
      const { from, to, value } = params;
      if (!from || !to || value === undefined || value === '') {
        return;
      }

      // `let` read back after the updater ran, which is sound because the store applies one synchronously — the
      // same property `toggleState` depends on. Typed loosely so the narrowing does not read it as always false.
      const outcome: { moved: boolean } = { moved: false };
      setState(`runtime.state.${from}`, (prev: unknown): unknown[] => {
        const list = Array.isArray(prev) ? (prev as unknown[]) : [];
        outcome.moved = list.includes(value);

        return outcome.moved ? list.filter(entry => entry !== value) : list;
      });

      if (!outcome.moved) {
        return;
      }

      setState(`runtime.state.${to}`, (prev: unknown): unknown[] => {
        const list = Array.isArray(prev) ? (prev as unknown[]) : [];

        return list.includes(value) ? list : [...list, value];
      });
    },
    [setState]
  );

  /**
   * The checkbox, as one step: in the list if it was not, out of it if it was.
   *
   * A SET rather than a list — the same value is never in it twice — which is what makes it safe to press twice.
   * The alternative, an append guarded by a check, reads the list as it was when the flow started, so two presses
   * in the same tick both found it absent and added it twice.
   */
  const handleToggleInState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; value: unknown }>) => {
      const { key, value } = params;
      if (!key || value === undefined || value === '') {
        return;
      }

      setState(`runtime.state.${key}`, (prev: unknown): unknown[] => {
        const list = Array.isArray(prev) ? (prev as unknown[]) : [];

        return list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
      });
    },
    [setState]
  );

  const handleClearState = useCallback(() => {
    setState('runtime.state', {});
  }, [setState]);

  const interactionCallbacks = useMemo(
    () =>
      toInteractionCallbacks(stateCallbacks, {
        setState: handleSetState,
        toggleState: handleToggleState,
        appendState: handleAppendState,
        removeState: handleRemoveState,
        moveState: handleMoveState,
        toggleInState: handleToggleInState,
        clearState: handleClearState
      }),
    [handleSetState, handleToggleState, handleAppendState, handleRemoveState, handleMoveState, handleToggleInState, handleClearState]
  );

  useInteractions({ id: 'state', callbacks: interactionCallbacks });

  return children;
};

export default StateInteractions;
