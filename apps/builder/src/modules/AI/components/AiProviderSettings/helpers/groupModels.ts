import type { OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { AiModelInfo } from '@pmodules/AI/types';

const groupModels = (models: AiModelInfo[]): OptionGroup[] => {
  const map = new Map<string, AiModelInfo[]>();
  for (const m of models) {
    const key = m.providerName ?? 'Other';
    const group = map.get(key) ?? [];
    group.push(m);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, models]) => ({
      label,
      options: models.map(m => ({
        value: m.id,
        label: `${m.name}${m.free === true ? ' (free)' : ''}`
      }))
    }));
};

export default groupModels;
