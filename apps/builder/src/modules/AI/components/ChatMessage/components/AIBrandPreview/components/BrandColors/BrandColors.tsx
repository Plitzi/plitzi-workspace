import BrandColorItem from './BrandColorItem';

export type BrandColorsProps = {
  colorEntries: [string, string][];
  copied: string | null;
  onCopy: (hex: string) => void;
};

const BrandColors = ({ colorEntries, copied, onCopy }: BrandColorsProps) => (
  <div className="px-3 pt-2">
    <div className="mb-1.5 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
      Colors
    </div>
    <div className="flex flex-wrap gap-2">
      {colorEntries.map(([role, hex]) => (
        <BrandColorItem key={role} role={role} hex={hex} isCopied={copied === hex} onCopy={onCopy} />
      ))}
    </div>
  </div>
);

export default BrandColors;
