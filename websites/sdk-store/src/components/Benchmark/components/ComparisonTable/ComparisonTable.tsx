import { COMPARISON_COLUMNS, COMPARISON_ROWS } from '../../../../content';
import ComparisonCell from '../ComparisonCell';

const ComparisonTable = () => (
  <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-900/50">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-ink-700">
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Feature</th>
          {COMPARISON_COLUMNS.map((column, index) => (
            <th
              key={column}
              className={`px-3 py-3 text-center text-[11px] font-semibold ${
                index === 0 ? 'text-brand-300' : 'text-zinc-400'
              }`}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {COMPARISON_ROWS.map(row => (
          <tr key={row.feature} className="border-b border-ink-800 last:border-0">
            <td className="px-4 py-2.5 text-left text-xs text-zinc-300">{row.feature}</td>
            {row.values.map((value, index) => (
              <td
                key={`${row.feature}-${index}`}
                className={`px-3 py-2.5 text-center ${index === 0 ? 'bg-brand-900/10' : ''}`}
              >
                <ComparisonCell value={value} highlight={index === 0} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ComparisonTable;
