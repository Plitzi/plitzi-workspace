import Button from '@plitzi/plitzi-ui/Button';

import EmptyState from '@pmodules/App/components/EmptyState';

export type FunctionsOfferProps = {
  /** The template's name. */
  template: string;
  isInstalling?: boolean;
  onInstall?: () => void;
};

/**
 * The functions the space's template brought, offered to install: a space made from a template has no private bucket to
 * keep server code on at first, so they wait here until it has one. Installing saves them as the space's own.
 */
const FunctionsOffer = ({ template, isInstalling = false, onInstall }: FunctionsOfferProps) => (
  <div className="mx-auto w-full max-w-5xl px-6 py-6">
    <EmptyState
      icon="fa-solid fa-code"
      title="The template's functions are waiting"
      description={
        <>
          <b>{template}</b>, the template this space was made from, brings its own functions. Install them to run them
          here: they are kept in the space’s private bucket, so add one in Assets → Files first if it has none.
        </>
      }
      action={
        <Button size="sm" disabled={isInstalling} onClick={onInstall}>
          {isInstalling ? 'Installing…' : 'Install the template’s functions'}
        </Button>
      }
    />
  </div>
);

export default FunctionsOffer;
