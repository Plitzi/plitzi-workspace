import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { platformFetch } from '@pmodules/Network/helpers/platformVersion';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { deploySteps, deployWords } from './helpers';
import SheetFrame from './SheetFrame';
import Notice from '../../components/Notice';
import { revisionName } from '../../helpers/environments';

import type { SpaceDeployDetail } from '@plitzi/sdk-shared';

export type DeployProgressProps = {
  deployId: number;
  domain: string;
  /** What the deploy follows: "example.com now serves production r12." */
  said: string;
  onRollBack?: () => void;
  onDone: () => void;
};

const QUIET_BUTTON = 'border-transparent bg-transparent text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover';

const detailOf = (response: { SpaceDeployDetail: SpaceDeployDetail } | undefined) => response?.SpaceDeployDetail;

/**
 * A deploy as it runs (RFC 0034 §11.3 "Pressed, the sheet becomes the progress"): its steps ticked, its log behind a
 * toggle, a way to stop it; done, the site to open and the rollback beside it; failed, why, in its own words.
 */
const DeployProgress = ({ deployId, domain, said, onRollBack, onDone }: DeployProgressProps) => {
  const { mutate, server, userKey, webId } = useBuilderNetwork();
  const [downloadProblem, setDownloadProblem] = useState<string>();
  const [showLog, setShowLog] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const { data: deploy, mutate: refresh } = useGraphQL(
    'SpaceDeployDetail',
    detailOf,
    { id: deployId },
    {
      revalidateOnMount: true,
      refreshInterval: latest => (latest && deployWords(latest.SpaceDeployDetail.status).going ? 1_500 : 0)
    }
  );

  const handleCancel = useCallback(async () => {
    setCanceling(true);
    await mutate('SpaceCancelDeploy', { id: deployId }, true);
    await refresh();
    setCanceling(false);
  }, [deployId, mutate, refresh]);

  /** The kept site, a zip: asked of the API as the person, and handed to the browser to save. */
  const handleDownload = useCallback(async () => {
    setDownloadProblem(undefined);
    const response = await platformFetch(
      `${server.apiServer}/spaces/${String(webId)}/deploys/${String(deployId)}/artifact`,
      { credentials: 'include', headers: { 'plitzi-access-token': userKey } }
    ).catch(() => undefined);
    if (!response?.ok) {
      const body: unknown = await response?.json().catch(() => undefined);
      setDownloadProblem(
        body !== null && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'The site could not be downloaded'
      );

      return;
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = `${domain}-deploy-${String(deployId)}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [deployId, domain, server.apiServer, userKey, webId]);

  if (!deploy) {
    return (
      <SheetFrame>
        <span className="text-ui-fg-subtle text-sm">Reading the deploy…</span>
      </SheetFrame>
    );
  }

  const { words, going } = deployWords(deploy.status);
  const url = deploy.url ?? `https://${domain}`;

  return (
    <SheetFrame
      footer={
        <div className="flex items-center justify-end gap-2">
          {going && (
            <Button
              size="sm"
              intent="custom"
              className={clsx(QUIET_BUTTON, 'mr-auto')}
              disabled={canceling}
              onClick={() => void handleCancel()}
            >
              {canceling ? 'Stopping…' : 'Stop the deploy'}
            </Button>
          )}
          {!going && onRollBack && (
            <Button
              size="sm"
              intent="secondary"
              className="mr-auto whitespace-nowrap"
              iconPlacement="before"
              onClick={onRollBack}
            >
              <Button.Icon icon="fa-solid fa-rotate-left" />
              Roll back
            </Button>
          )}
          {deploy.status === 'succeeded' && deploy.kept && deploy.provider === 'download' && (
            <Button size="sm" intent="secondary" onClick={() => void handleDownload()}>
              Download the site
            </Button>
          )}
          {deploy.status === 'succeeded' && deploy.provider !== 'download' && (
            <Button size="sm" intent="secondary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
              Open the site
            </Button>
          )}
          <Button size="sm" onClick={onDone}>
            {going ? 'Close — it goes on' : 'Done'}
          </Button>
        </div>
      }
    >
      <p className="text-ui-fg text-sm">{said}</p>
      <div className="border-ui-line flex flex-col gap-2 rounded-lg border p-3">
        <span className="text-ui-fg flex items-center justify-between gap-2 text-sm font-semibold">
          <span>
            Deploy #{deploy.id} · {revisionName(deploy.environment, deploy.revision)}
          </span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              deploy.status === 'succeeded' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
              deploy.status === 'failed' && 'bg-red-500/15 text-red-700 dark:text-red-300',
              going && 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
              deploy.status === 'canceled' && 'bg-ui-raised text-ui-fg-subtle'
            )}
          >
            {words}
          </span>
        </span>
        <ol className="flex items-center gap-1" aria-label="Steps">
          {deploySteps(deploy.status).map((step, index) => (
            <li key={step.label} className="flex min-w-0 grow items-center gap-1">
              <span
                className={clsx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                  step.state === 'done' && 'bg-emerald-500 text-white',
                  step.state === 'current' && 'bg-primary-500 animate-pulse text-white',
                  step.state === 'failed' && 'bg-red-500 text-white',
                  step.state === 'todo' && 'bg-ui-raised text-ui-fg-subtle'
                )}
                aria-hidden
              >
                {step.state === 'done' ? (
                  <i className="fa-solid fa-check" />
                ) : step.state === 'failed' ? (
                  <i className="fa-solid fa-xmark" />
                ) : (
                  index + 1
                )}
              </span>
              <span className={clsx('truncate text-xs', step.state === 'todo' ? 'text-ui-fg-subtle' : 'text-ui-fg')}>
                {step.label}
              </span>
              {index < 3 && <span className="bg-ui-line h-px min-w-2 grow" />}
            </li>
          ))}
        </ol>
        {deploy.error && <Notice tone="danger">{deploy.error}</Notice>}
        {downloadProblem && <Notice tone="danger">{downloadProblem}</Notice>}
        <button
          type="button"
          className="text-ui-fg-subtle hover:text-ui-fg w-fit text-xs"
          aria-expanded={showLog}
          onClick={() => setShowLog(value => !value)}
        >
          <i className={clsx('fa-solid mr-1 text-[10px]', showLog ? 'fa-chevron-down' : 'fa-chevron-right')} />
          {showLog ? 'Hide the log' : `Show the log (${String(deploy.log.length)} lines)`}
        </button>
        {showLog && (
          <pre className="bg-ui-raised max-h-56 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {deploy.log.map(line => (
              <span
                key={`${String(line.at)}-${line.line}`}
                className={clsx(
                  'block',
                  line.level === 'error' && 'text-red-600 dark:text-red-400',
                  line.level === 'warn' && 'text-amber-700 dark:text-amber-300'
                )}
              >
                {new Date(line.at * 1000).toISOString().slice(11, 19)} {line.line}
              </span>
            ))}
          </pre>
        )}
      </div>
    </SheetFrame>
  );
};

export default DeployProgress;
