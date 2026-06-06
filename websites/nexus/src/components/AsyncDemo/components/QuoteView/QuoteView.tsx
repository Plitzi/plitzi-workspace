import { useAsyncValue } from '@plitzi/nexus';

import type { Quote } from '../../asyncStore';
import type { AsyncResource } from '@plitzi/nexus';

const QuoteView = ({ resource }: { resource: AsyncResource<Quote | null, []> }) => {
  const quote = useAsyncValue(resource);

  if (!quote) {
    return <p className="text-sm text-zinc-500">No quote yet.</p>;
  }

  return (
    <figure className="space-y-2">
      <blockquote className="text-sm leading-relaxed text-white">“{quote.text}”</blockquote>
      <figcaption className="font-mono text-xs text-brand-300">— {quote.author}</figcaption>
    </figure>
  );
};

export default QuoteView;
