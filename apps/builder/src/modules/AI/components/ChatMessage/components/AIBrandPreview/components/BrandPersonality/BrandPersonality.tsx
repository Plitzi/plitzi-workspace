export type BrandPersonalityProps = {
  personality: string[];
  primaryColor: string;
};

const BrandPersonality = ({ personality, primaryColor }: BrandPersonalityProps) => (
  <div className="px-3 pt-2">
    <div className="mb-1 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
      Personality
    </div>
    <div className="flex flex-wrap gap-1">
      {personality.map(trait => (
        <span
          key={trait}
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            backgroundColor: `${primaryColor}18`,
            color: primaryColor,
            border: `1px solid ${primaryColor}40`
          }}
        >
          {trait}
        </span>
      ))}
    </div>
  </div>
);

export default BrandPersonality;
