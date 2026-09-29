import Button from '@plitzi/plitzi-ui/Button';

export type FunctionsOfferProps = {
  /** The template's name. */
  template: string;
  isInstalling?: boolean;
  onInstall?: () => void;
};

/**
 * The functions the space's template brought, offered to install: a space made from a template has no private CDN to
 * keep server code on at first, so they wait here until it has one. Installing saves them as the space's own.
 */
const FunctionsOffer = ({ template, isInstalling = false, onInstall }: FunctionsOfferProps) => (
  <div className="m-4 flex flex-col items-center gap-3 rounded-sm border-2 border-dashed border-gray-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
    <span>
      <b>{template}</b>, the template this space was made from, brings its own functions. Install them to run them here:
      they are kept on the space’s private CDN, so add one in Resources first if it has none.
    </span>
    <Button size="sm" disabled={isInstalling} onClick={onInstall}>
      {isInstalling ? 'Installing…' : 'Install the template’s functions'}
    </Button>
  </div>
);

export default FunctionsOffer;
