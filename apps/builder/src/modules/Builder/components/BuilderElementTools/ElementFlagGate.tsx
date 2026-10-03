import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ElementFlagGate as TElementFlagGate } from '@plitzi/sdk-shared';

export type ElementFlagGateProps = {
  gate?: TElementFlagGate;
  /** The flags the space declares, which are the ones a gate may name. */
  flagNames: string[];
  isPage?: boolean;
  /** `undefined` removes the gate: the element is rendered whatever the flags say. */
  onUpdate?: (key: string, value: TElementFlagGate | undefined, isDefinition?: boolean) => void;
};

/**
 * The feature flag an element exists under — not a visibility: gated off, it is not rendered at all, on the server or
 * in the browser, and none of its markup is in the page. Offered only once the space declares a flag,
 * and kept on screen for an element still naming one the space removed, so the author can see why it is gone.
 */
const ElementFlagGate = ({ gate, flagNames: names, isPage = false, onUpdate }: ElementFlagGateProps) => {
  const undeclared = gate !== undefined && !names.includes(gate.name);

  const handleChangeName = useCallback(
    (name: string) => onUpdate?.('flag', name ? { name, is: gate?.is ?? true } : undefined, true),
    [gate?.is, onUpdate]
  );

  const handleChangeIs = useCallback(
    (is: string) => {
      if (gate) {
        onUpdate?.('flag', { name: gate.name, is: is === 'on' }, true);
      }
    },
    [gate, onUpdate]
  );

  if (names.length === 0 && !gate) {
    return null;
  }

  const offWhile = gate ? `${gate.name} is ${gate.is ? 'off' : 'on'}` : '';
  const effect = isPage
    ? `This page is not found while ${offWhile}.`
    : `Not rendered at all while ${offWhile} — in the canvas too. Force the flag in Feature Flags to see the other side.`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Select className="grow" size="xs" label="Feature flag" value={gate?.name ?? ''} onChange={handleChangeName}>
          <option value="">Always rendered</option>
          {names.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {undeclared && <option value={gate.name}>{`${gate.name} (not declared)`}</option>}
        </Select>
        {gate && (
          <Select size="xs" label="Rendered when" value={gate.is ? 'on' : 'off'} onChange={handleChangeIs}>
            <option value="on">On</option>
            <option value="off">Off</option>
          </Select>
        )}
      </div>
      {gate && <span className="text-xs text-gray-500 dark:text-zinc-400">{effect}</span>}
      {undeclared && (
        <span className="text-xs text-red-600 dark:text-red-400">
          The space does not declare this flag, so it reads as off.
        </span>
      )}
    </div>
  );
};

export default ElementFlagGate;
