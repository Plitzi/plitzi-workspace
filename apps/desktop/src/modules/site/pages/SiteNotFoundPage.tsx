import Button from '@plitzi/plitzi-ui/Button';
import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';

const SiteNotFoundPage = () => {
  usePageLayout({ intent: 'empty', title: 'Not found', className: 'items-center justify-center' });

  return (
    <div className="flex flex-col items-center gap-4 p-12 text-center">
      <div className="text-7xl font-bold text-zinc-300 dark:text-zinc-700">404</div>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        There is nothing at that address. If you got here from a link inside the app, that is a bug worth telling us
        about.
      </p>
      <Link to="/">
        <Button>Take me home</Button>
      </Link>
    </div>
  );
};

export default SiteNotFoundPage;
