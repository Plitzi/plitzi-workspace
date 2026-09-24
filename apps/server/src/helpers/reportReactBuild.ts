import { serverLog } from './serverLog';

let reported = false;

/**
 * Says, once per process, that a production server is rendering with React's development build.
 *
 * React picks its build from `NODE_ENV` when it is first imported, not from anything a server is configured with, so
 * `devMode: false` without `NODE_ENV=production` renders every page with the development build — measured at about 40%
 * fewer pages a second. An `error` because it is the only level a production server shows, and a deployment that
 * never sees this line never learns why it needs twice the CPU.
 */
export const reportReactBuild = (devMode: boolean | undefined, nodeEnv = process.env.NODE_ENV): void => {
  if (reported || devMode || nodeEnv === 'production') {
    return;
  }

  reported = true;
  serverLog.error(
    'server',
    `NODE_ENV is ${nodeEnv === undefined ? 'unset' : `"${nodeEnv}"`}: React renders with its development build. ` +
      'Start the process with NODE_ENV=production.'
  );
};
