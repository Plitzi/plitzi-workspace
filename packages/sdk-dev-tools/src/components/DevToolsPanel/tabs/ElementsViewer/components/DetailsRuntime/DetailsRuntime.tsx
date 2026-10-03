import { useContext } from 'react';

import { StoreContext } from '@plitzi/nexus/react';

import { elementReport } from '../../../../../../agentInspector/report';
import { useSecondsClock } from '../../../../../../freshness';
import DetailsRow from '../DetailsRow';

import type { ElementReport } from '../../../../../../agentInspector/report';

export type DetailsRuntimeProps = {
  id: string;
};

const boxText = ({ visible, box }: ElementReport): string =>
  `${visible ? 'Yes' : 'No'}${box ? ` · ${String(box.width)}×${String(box.height)} at ${String(box.x)}, ${String(box.y)}` : ''}`;

const bindingText = ({ category, to, source, template }: NonNullable<ElementReport['bindings']>[number]): string =>
  `${category === 'attributes' ? '' : `${category} · `}${to} ← ${source}${template ? ` · ${template}` : ''}`;

/**
 * The element as the page has it now — the same report `window.__plitzi.element()` and `plitzi check --element` give:
 * its own state, what it binds to, how many copies are on the page and where. Read again every second.
 */
const DetailsRuntime = ({ id }: DetailsRuntimeProps) => {
  const root = useContext(StoreContext);
  useSecondsClock(true);
  const report = root && typeof document !== 'undefined' ? elementReport(root.getState(), id, document) : undefined;

  if (!report) {
    return (
      <div className="text-sm text-zinc-400 dark:text-zinc-500">Neither the document nor the page has “{id}”.</div>
    );
  }

  return (
    <div className="w-full text-sm">
      <DetailsRow name="Type">{report.type}</DetailsRow>
      {report.inComponent && <DetailsRow name="In component">{report.inComponent}</DetailsRow>}
      {report.instanceOf && <DetailsRow name="Places component">{report.instanceOf}</DetailsRow>}
      <DetailsRow name="Copies on the page">{report.copies}</DetailsRow>
      <DetailsRow name="On screen">{boxText(report)}</DetailsRow>
      {report.state !== undefined && <DetailsRow name="Own state">{JSON.stringify(report.state)}</DetailsRow>}
      {(report.bindings ?? []).map(binding => (
        <DetailsRow key={`${binding.category}-${binding.to}`} name="Reads">
          {bindingText(binding)}
        </DetailsRow>
      ))}
    </div>
  );
};

export default DetailsRuntime;
