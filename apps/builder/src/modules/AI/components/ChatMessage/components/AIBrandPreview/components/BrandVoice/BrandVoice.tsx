import type { BrandData } from '../../../../helpers/getBrandResult';

export type BrandVoiceProps = {
  voice: NonNullable<BrandData['voice']>;
};

const BrandVoice = ({ voice }: BrandVoiceProps) => (
  <div className="px-3 py-2.5 pt-2">
    <div className="mb-1 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
      Voice & Tone
    </div>
    <p className="text-zinc-600 italic dark:text-zinc-400">"{voice.tone}"</p>
    {voice.keywords && voice.keywords.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-1">
        {voice.keywords.map(kw => (
          <span
            key={kw}
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {kw}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default BrandVoice;
